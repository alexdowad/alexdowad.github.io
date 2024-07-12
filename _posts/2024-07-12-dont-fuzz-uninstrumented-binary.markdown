---
layout: post
title:  "Stuff I have learned: Don't use a coverage-guided fuzzer on an uninstrumented binary"
date:   2024-07-12
categories:
  - fuzzing
  - stuff i have learned
---

<i><b>Subtitle:</b> ...unless you really have to...</i>

Coverage-guided fuzzing tools, such as [LLVM's libFuzzer](https://llvm.org/docs/LibFuzzer.html), run a target program on many random inputs, record the path of control flow each time the target program executes (for example, which branch of each `if` statement is taken), and mutate the input in an effort to find as many unique control-flow paths as possible. It turns out that this heuristic is incredibly effective at guiding the random search to find interesting test cases.

But it only works if the fuzzer *can* actually trace the path of control flow through the target program! As I was so forcefully reminded today...

Before I go further, let me explain how coverage-guided fuzzers are able to record the path of program execution. Generally, these tools require the target program to be compiled with special options, which tell the compiler to insert some instrumentation code before every instance of certain machine instructions. For example, instrumentation code might be added before every conditional branch instruction.

For [clang](https://clang.llvm.org/), the special option needed is `-fsanitize=fuzzer`. When you compile a C program with that option, the resulting binary will contain code like:

    % objdump --disassemble testprogram

    ...output elided...
    1b6995:       e8 36 79 e9 ff          call   4e2d0 <__sanitizer_cov_trace_const_cmp4>
    1b699a:       8b 85 24 f7 ff ff       mov    -0x8dc(%rbp),%eax
    1b69a0:       83 f8 00                cmp    $0x0,%eax
    ...more output elided...

Do you see the call to `__sanitizer_cov_trace_const_cmp4`? `clang -fsanitize=fuzzer` inserts the definitions of a couple dozen such functions into your binary, and adds function calls before every instance of an instruction which libFuzzer is interested in. The functions record what libFuzzer needs to know, in a place where libFuzzer can find it.

A while ago, I contributed some new functions to a certain open-source library, and also contributed fuzzers to test them. However, while the test driver programs were compiled with `clang -fsanitize=address,fuzzer,undefined`, the dynamically-linked library (`.so` file) with the definitions of the target functions was compiled by GCC, without any instrumentation!

Today, more than a year after the fact, I happened to look at my code and realized what was happening. After I adjusted the Makefile to build the dynamic library with `clang -fsanitize=fuzzer-no-link` (which is the right option for libraries, as opposed to executables), re-built the library and test drivers, and ran one of them for 10 seconds... it found a bug.

After I fixed that bug and ran the same fuzzer for another 10 seconds... it found another bug.

🤦🏻‍♂️

I sure hope I never pull one like that again!

***⸻But why did the fuzzer originally seem to work?***

Coverage-guided fuzzers, such as those based on libFuzzer, will not crash or print a warning or anything like that if part of the binary code under test is not instrumented. They just won't be able to tell which way the path of execution is going in the uninstrumented part. Effectively, your “coverage-guided” fuzzer will degenerate into an unguided fuzzer which just throws random inputs at the code under test. This can make the fuzzer orders of magnitude less likely to find obscure bugs.

That's why this article is subtitled “...unless you really have to...”; if you have no way of instrumenting a binary (maybe because you don't have the source code), but need to fuzz it, there's nothing to say that you *can't* use a coverage-guided fuzzer on it; you will just lose the benefit of coverage guidance.
