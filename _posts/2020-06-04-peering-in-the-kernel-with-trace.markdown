---
layout: post
title:  "Peering into the Linux Kernel with trace"
date:   2020-06-04
categories:
  - linux
  - stuff i have learned
---

Recently, I was working on a patch for a popular open-source project, and discovered that the test suite was failing intermittently. A closer look revealed that the [last access time](https://en.wikipedia.org/wiki/Stat_(system_call)) for some files in the project folder were changing unexpectedly, and this was causing a test to fail. (The failing test was not related to my patch.)

Looking at the project code, it seemed impossible for it to be unexpectedly accessing those files during the test in question. Running the test case under [`strace`](https://strace.io/) confirmed that this was not happening. But incontrovertibly, the access times *were* changing. Could another process on the same machine be reading those files? But why? Could it be a bug in the operating system? Were my tools lying to me?

Faced with a puzzle like this, the inclination might be to shrug one's shoulders and forget about it, perhaps with a dismissive remark about the general brokenness of most software. (I've done that many times.) Anyways, it wasn't *my* code which was failing. And yet, it seemed prudent to clear up the mystery, rather than bumbling along and *hoping* that what I didn't know wouldn't hurt me.

This seemed like a good opportunity to try out the [BCC tools](https://iovisor.github.io/bcc/). This is a powerful suite for examining and monitoring Linux kernel activity in real-time. Support is built in to the kernel (starting from 4.1), so you can immediately investigate when a problem is occurring, without needing to install a special kernel or reboot with special boot parameters.

One of the more than 100 utilities included in the BCC tools is `trace`. Using this program, one can monitor when *any* function in the kernel is called, what arguments it receives, what processes are causing those calls, and so on. Having `trace` is really like having a superpower.

Of course, the argument(s) of interest might not just be integers or strings. They might be pointers to C structs, which might contain pointers to other structs, and so on... but `trace` still has you covered. If you point it to the appropriate C header files which your kernel was compiled with, it can follow those pointers, pick out fields of interest, and print them at the console. (The header files enable `trace` to figure out the layout of those structs in memory.)

The invocation of `trace` which did the job for me turned out to be:

    sudo /usr/share/bcc/tools/trace -I/home/alex/Programming/linux/include/linux/path.h -I/home/alex/Programming/linux/include/linux/dcache.h 'touch_atime(struct path *path) "%s", path->dentry->d_name.name'

That says that every time a function called `touch_atime` (with parameter `struct path *path`) is called in the kernel, I want to see the string identified by the C expression `path->dentry->d_name.name`. In response, `trace` prints out a stream of messages like:

    2135    2135    sublime_text    touch_atime      ld.so.cache
    2076    2076    chrome          touch_atime
    2494    2497    Chrome_ChildIOT touch_atime
    1071    1071    Xorg            touch_atime
    2135    2135    sublime_text    touch_atime      Default.sublime-package
    1566    1566    pulseaudio      touch_atime

As you can see, it very helpfully shows some additional information for each call. From the left, that is the process ID, thread ID, command, function name, and then the requested string. Piping that into ripgrep revealed (within minutes) that my text editor had a background thread which was scanning the project files for changes, as part of its git integration. *That* is what was updating the access times and causing the erratic test failures.

What a difference it makes to be able to directly look inside a system and see what it is doing, instead of blindly groping using trial and error! This was the first time I harnessed the formidable power of `trace`, but it won't be the last. It has a permanent home in my debugging toolbox now.

[Eric Raymond's "Rule of Transparency"](http://www.catb.org/~esr/writings/taoup/html/ch01s06.html#id2878054) sagely advises programmers: "Design for visibility to make inspection and debugging easier". You said it, Eric, you said it.

***⸻But how did you know the function to trace was touch_atime?***

Just poking around in the kernel source a bit. I knew there should be a function somewhere in the `fs` subfolder, and grepped for functions with `atime` in their name. There are just a few, and `touch_atime` almost jumped out. Reading the code confirmed that it was the right one.

***⸻OK. So how does `trace` work under the hood?***

First, it parses the "probe specifications" which you provide, converts them to a little C program, and uses BCC to convert that C program into eBPF bytecode. (The VM which runs this bytecode is built-in to the Linux kernel.) A special system call is used to load the bytecode into the kernel.

<span id="kprobe">Next, it registers a **kprobe** with the kernel. The "kprobe" mechanism allows arbitrary callbacks to be associated with almost any function (actually, any machine instruction) in the kernel binary, which will fire whenever that instruction is executed. When a kprobe is registered, the kernel stores the original instruction somewhere and overwrites it with a breakpoint instruction (such as an `INT3` instruction on x86). Then it sets things up so that when the breakpoint fires, all the callbacks will be executed. Of course, the instruction which was overwritten will also be executed, so as not to break the function which is being traced.</span>

There are a couple different APIs which user programs can use to create kprobes; one of them is by writing some specially formatted data to a "magic" file called `/sys/kernel/debug/tracing/kprobe_events`.

Then `trace` uses another API to tell the kernel to use the previously loaded eBPF bytecode as a callback for the new kprobe. Then it uses another API to get a file descriptor from the kernel, from which it can read the output generated by the BPF program.

It's an intricate mechanism, but very, very flexible. Just thinking of the possibilities boggles the mind...
