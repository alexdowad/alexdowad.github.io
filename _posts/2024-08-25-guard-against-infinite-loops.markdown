---
layout: post
title:  "Another Lesson From My First CVE: Use Assertions to Guard Against Infinite Loops"
date:   2024-08-25
categories:
  - security
  - stuff i have learned
---

(This article follows on [the previous one about lessons from CVE-2024-2757](/lesson-from-my-first-cve/).)

After going through the experience of accidentally introducing a denial-of-service vulnerability into PHP (due to an unintentional infinite loop), I adopted a software development practice which I haven’t seen others write about. The short version is: ***use assertions to ensure that non-trivial loops terminate***. The rest of this article will expand on that idea.

## Isn’t an assertion failure just as bad as an infinite loop?

Well, converting an unintentional infinite loop into an assertion failure certainly doesn’t fix the underlying problem. But a program which exits with an assertion failure message (and stack trace) is a lot easier to debug than one which just hangs and becomes unresponsive. Between those two choices, I’ll take the assertion failure.

## What is a “non-trivial loop”?

In this article, a “non-trivial loop” is any loop which forces the author to stop and think in order to convince themselves that it will eventually terminate. A loop which uses an index variable to count up to a constant value is definitely trivial:

```c
for (int i = 0; i < 10; i++) {
  /* Move on, no infinite loop here */
}
```

Loops which use an iterator to traverse a data structure are also trivial:

```javascript
for (const item of array) {
  /* Definitely no infinite loop here */
}
```

Example of a *non*-trivial loop: The loop iterates over a byte array, where some number of consecutive bytes represents an “object” of some kind, but the object encoding is variable-length. On each iteration, the loop must compute the number of bytes in the next object and bump a pointer forward to pass over it. That loop will never terminate if it ever wrongly computes the length of the next object as zero bytes (perhaps due to integer overflow or underflow).

2<sup>nd</sup> example of a non-trivial loop: The loop repeatedly removes items from a work queue and processes them. Processing one item may cause more new items to be pushed onto the queue. An infinite loop can occur if processing one item creates another, and then that one creates another, and so on ad infinitum.

3<sup>rd</sup> example of a non-trivial loop: The loop repeatedly applies some transformation(s) to a data structure, until there are no more changes. For concreteness, say the data structure is an [AST](https://en.wikipedia.org/wiki/Abstract_syntax_tree), being processed by a compiler. Perhaps the compiler is applying optimizations like [copy propagation](https://en.wikipedia.org/wiki/Copy_propagation). It often happens that applying such optimizations creates opportunities to apply them in other sites, which then creates still more opportunities to optimize other sites. That is the reason for repeatedly applying the same transformation(s) in a loop. However, this can lead to an infinite loop if there exist any two ASTs *A* and *B*, where the loop transforms *A* to *B*, and *B* to *A*.

## But how do you assert “this loop must terminate”?

Method #1: find an upper bound on the number of iterations which the loop should execute for. Then do something like this:

```c
int max_iterations = compute_upper_bound_on_iterations();
while (tricky_termination_condition()) {
  assert(max_iterations-- > 0);
  /* Body of loop */
}
```

In the 1<sup>st</sup> example above, the loop was stepping through a byte array, with a variable number of bytes encoding each object in the array. Since each object presumably occupies at least one byte, a good value for `max_iterations` in that case would simply be the total number of bytes in the array.

Note that it is *not* necessary to find a tight upper bound. It’s better to use a loose upper bound which is straightforward to compute, rather than a tighter upper bound which is tricky to compute. Remember, the `max_iterations` counter is just a fail-safe; it doesn't matter if its starting value is somewhat higher than necessary.

Method #2: find some boolean condition which guarantees that the loop has made progress toward eventual termination, and assert that. In the 1<sup>st</sup> example above, a good assertion would be that the computed “next object size” is at least one byte or more.

For many loops, you can find some quantity which should increase or decrease monotonically as the loop moves towards termination; that may provide the basis for a good assertion.

## In conclusion

I don’t follow this practice religiously, but just apply it when it seems to make sense. Even when I am quite certain that a certain non-trivial loop will in fact always terminate, sometimes I add an assertion just to future-proof the code, for the benefit of other developers who come later.
