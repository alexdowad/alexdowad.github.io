---
layout: post
title:  "Stuff I Have Learned: Transmit records in column-major order for better compression"
date:   2024-11-09
categories:
  - stuff i have learned
---

The other day I achieved a 25% reduction in load time for a [single-page application](https://en.wikipedia.org/wiki/Single-page_application) which requires a large amount of initial data, with just a few lines of added code. If the technique described below seems obvious, well... sorry. I’m writing it down in case it’s interesting to some readers.

The web application in question needs many records from a back-end database, which are serialized to JSON and loaded on start-up. At one time in the past, this JSON looked something like:

```
  [
    {
      "id": 100,
      "name": "Chocolate chip cookies",
      "flavor": "sweet"
    },
    {
      "id": 101,
      "name": "Potato chips",
      "flavor": "salty"
    },
    {
      "id": 102,
      "name": "Yaki purin",
      "flavor": "sweet"
    },
    ...
  ]
```

(No, that's not real data. The actual application data has nothing to do with snack food.)

Later, that big hunk of JSON was reformatted as:

```
  [
    [100,"Chocolate chip cookies","sweet"],
    [101,"Potato chips","salty"],
    [102,"Yaki purin","sweet"],
    ...
  ]
```

The payload size got smaller, load time got faster, and everyone was happy. But could it be made faster still by just rearranging that data a bit more?

The latest iteration does this:

```
  [
    [100,101,102,...],
    ["Chocolate chip cookies","Potato chips","Yaki purin",...],
    ["sweet","salty",sweet",...]
  ]
```

That is <b>column-major order</b>; instead of each sub-array representing one database record (or “row”), each sub-array carries all the values from one database column. The purpose is to bring similar values together; we now have long runs of integers, runs of booleans, runs of personal name strings, address strings, and so on. Compression algorithms like gzip and brotli are more effective on data formatted like that, so the on-wire size of the data becomes smaller.

Converting the array of arrays from row-major order to column-major order is a single line of code in Ruby:

```ruby
  records = records.transpose
```

...and then there's a few lines of JavaScript on the client to transpose the arrays back to row-major order.

<b>Caveat:</b> Don't bother trying this if you don't have HTTP compression enabled on your web server. The point is to make the data more easily compressible. Also, don't bother if your data is already small.
