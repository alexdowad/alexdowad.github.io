---
layout: post
title:  "Fast Bulk Record Updates in Rails"
date:   2024-11-28
categories:
  - stuff i have learned
---

Today I investigated a performance issue in a client’s Rails application. The problem code was taking about 40 seconds to create and/or update several thousand database records, resulting in HTTP request timeouts. After taking some measurements, reorganizing the code a bit, and applying some standard optimizations, that went down to 8 seconds.

A 5× speed boost isn't bad, and the client would certainly have been happy. But 8 seconds still seemed too long to me. The code was roughly like:

```ruby
class MyController < ApplicationController
  def my_action
    parent = MyModel.find(params[:id])
    parent.children.where(some_condition).includes(:all, :needed, :associations).each do |child|
      other = child.other_model || OtherModel.new(child_id: child.id)
      other.property1 = some_computation
      other.property2 = another_computation
      other.save!
    end
  end
end
```

At this point, the bottleneck was the sheer number of calls to `#save!` (too many round-trips to the database). That could be avoided by dropping Active Record and building a raw SQL query instead, but I didn't want to go quite that far.

This is what I ended up doing:

```ruby
class ApplicationModel
  # Build SQL to save changes to this record
  def update_sql
    self.updated_at = Time.now
    table = Arel::Table.new(self.class.table_name)
    update_manager = Arel::UpdateManager.new
    update_manager.table(table)
    update_manager.set(changes.map { |name, (_, val)| [table[name], val] })
    update_manager.where(table[:id].eq(self.id))
    update_manager.to_sql
  end

  # Build SQL to create this record
  def create_sql
    self.created_at = self.updated_at = Time.now
    table = Arel::Table.new(self.class.table_name)
    insert_manager = Arel::InsertManager.new
    insert_manager.into(table)
    insert_manager.insert(attributes.reject { |name, val| name == 'id' }.map { |name, val| [table[name], val] })
    insert_manager.to_sql
  end

  def save_sql
    if persisted?
      update_sql
    else
      create_sql
    end
  end
end

class MyController < ApplicationController
  def my_action
    sql = ''

    parent = MyModel.find(params[:id])
    parent.children.where(some_condition).includes(:all, :needed, :associations).each do |child|
      other = child.other_model || OtherModel.new(child_id: child.id)
      other.property1 = some_computation
      other.property2 = another_computation
      if other.valid?
        sql << other.save_sql << ";\n"
      else
        # Handle error
      end
    end

    ::ActiveRecord::Base.connection.execute(sql) unless sql.empty?
  end
end
```

That controller code still benefits from existing Rails model validations, but all the database queries occur in a single round-trip rather than thousands. A caveat is that Active Record hooks are not invoked. However, in this case, `OtherModel` didn't have any hooks.

That cut the runtime of `#my_action` down to one second. So instead of a 5× speedup, we got a 40× speedup. I would have loved to deliver a 100× speedup; maybe next time.

<b>Postscript:</b> The application in question was running on Rails 6.1, with a PostgreSQL database. Your mileage may vary.
