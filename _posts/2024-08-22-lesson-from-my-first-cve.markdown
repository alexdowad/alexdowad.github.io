---
layout: post
title:  "A Lesson From My First CVE"
date:   2024-08-22
categories:
  - fuzzing
  - security
  - stuff i have learned
---

In May 2024, for the first time (to my knowledge), a [CVE ID](https://en.wikipedia.org/wiki/Common_Vulnerabilities_and_Exposures) was created for a security vulnerability which I accidentally introduced into a high-profile software project. This is it: [CVE-2024-2757](https://nvd.nist.gov/vuln/detail/CVE-2024-2757). I took some scant comfort in the fact that it was a denial-of-service vulnerability and not something worse, such as arbitrary code execution. Even so, this was unpleasant and I don’t wish to repeat the experience.

The story of what led to this mistake has never been told... until now.

In February 2023, I refactored and optimized PHP's built-in function `mb_encode_mimeheader`. Earlier, in mid-2022, I had come to a new appreciation for fuzz testing and started fuzzing virtually all my new code. Of course, the new implementation of `mb_encode_mimeheader` was no exception. The testing process for that patch was lengthy, including extensive fuzz testing. I was almost ready to conclude testing and proclaim the new code “ready to merge”... when, after running for a long time, my fuzzer discovered a very obscure test case which caused an assertion failure.

This is where the big mistake happened.

After all the testing and debugging which had been done, the feeling that the new code was “almost ready” had grown strong in my mind, and this feeling was not dispelled by the late discovery of another fuzzer crash. So, I tweaked the code a bit to fix that failure, added a regression test, and submitted the final version of the patch for inclusion in the `master` branch. *What a blunder!* 🤦🏻‍♂️

The right thing to do, of course, was to restart the entire testing process after the code was changed, even though the change seemed minor. As it turned out, that tiny bit of code which I adjusted to “fix” the last fuzzer crash was exactly the bit which led to CVE-2024-2757. If I had just done one last good, long fuzzer run, it’s almost certain that the issue would have been found *before* it went to production.

To reiterate, the moral of the story is: ***Any change to software code, even a small change, can cause bugs and should be thoroughly tested.*** If you have already built up a measure of confidence that your code is right, that confidence must be reset every time you make a change. This is a good reason to use automated testing as much as possible!

CVE-2024-2757 left me with another lesson as well, which I may write about another time.
