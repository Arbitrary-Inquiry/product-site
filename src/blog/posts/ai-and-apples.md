---
title: "A Tale of AI and Apples"
date: 2026-02-04
author: Andrew Wright
topics:
  - AI
  - Development
  - Embedded Systems
---

It was a hardware problem, it was a software problem.
It was a Python project, it was a C project.
There were simple bugs, there were difficult bugs.
At times, everything worked perfectly. At times, nothing worked at all.

In other words, it was a project exactly like any other AI assisted project: one where scripts could be generated and iterated in mere seconds, but one where bugs that humans never would have written were prolific.

Nearly a year ago at this point, I was in need of a new mechanical keyboard. The $20 keyboard I had used to get through school was sufficient, certainly, but by then keys were starting to break and connections were spotty. Those weren't the only frustrations, however: updating the keyboard layout necessitated the use of proprietary software (that struggled on Linux builds), and even though it included RBG LEDs, they could only run a few basic presets.

That's when I discovered the QMK project. An open source project, allowing full, manual control of both the keymaps and the LEDs? Plenty of support for layers and macros, and the option to add on custom code, working across a variety of mechanical keyboards? This was perfect! I instantly added QMK compatibility to my list of keyboard requirements (along with things ISO layout with numpad, and media control keys). The keyboard I eventually found that met all of these requirements was the Keychron V6 Max. Not sponsored, though I do recommend it; I mention the model mainly because it will be important later.

Before the keyboard arrived, I decided exactly what I wanted to do with full RBG control. The same thing any denizen of the internet with a low resolution matrix of LEDs would do: play the Bad Apple!! music video. Unfortunately, I have very little experience with frame extraction scripts, and quite a lot of experience with procrastination. Hence, the project stayed on the back burner, even as I used the keyboard daily.

That's when a colleague of mine introduced me to Claude, an LLM by Anthropic marketed towards development projects. Up to that point, I was fairly "anti-AI". I had messed around with ChatGPT a time or too, but was skeptical of LLM-generated content. I knew it handled programming better, as the often consistent, structured nature of common implementations is where LLMs thrive in training. After some more pushing, I decided to get my feet wet. "Don't knock it 'til you try it", many say.

Of course, that's when I recalled the Bad Apple!! project I had tumbling around in my brain. The project was simple, just an automated script to convert an mp4 into a series of matrices, something I figured the AI would almost certainly have seen in its training data. The rest of it was implementing it with QMK, which, being an open source project, had all of the code readily available to analyse. I'd get my script, Claude would get a problem it was optimised for, and my friend would see the results of my AI experiment. A win-win-win.

I started out with a simple prompt:

> I have an RGB keyboard that supports the QMK framework, and I want to write a script that will take a video file and output a QMK script that will play a low quality resizing of the video on the keyboard's RGB LEDs.

Claude started chugging away, and before I knew it, it was done! The script was in Python, which I expected, because I had seen similar projects (many of which were also to implement Bad Apple!!), almost all of them in Python. That was part of my hesitancy. I stayed away from Py where possible as the whitespace being part of the syntax annoyed my formatting-addicted writer's brain, and I wasn't a fan of weakly typed languages, either. Luckily Claude had neither of those opinions, and so was able to come up with a working script in less than a minute!

Funnily enough, even though my prompt mentioned nothing about the video, Claude's generated readme file emphatically suggested Bad Apple!! as a test video. I suspect some of those other Python scripts I mentioned for implementing the very same were included in its training. Pleasantly surprised that Claude and I were already on the same page, I moved on to flashing the program onto the keyboard.

This is where the first issue began. As I said, the keyboard is a V6 Max, but a typo in Claude led it to believe it was simply the V6. Combine this with the fact that the public QMK repo only has support for the v6, and you get a recipe for disaster... The keyboard wouldn't flash at all, and after trying a couple of writes, it stopped working entirely. Between first consulting Claude via mobile and then pulling out an old keyboard, we did eventually stumble upon the issue.

While the QMK repo didn't have support for the V6 Max, Keychron luckily had their own fork with all of their keyboards— another pleasant surprise. It's always nice when a company supports an open source project, and I suspect it built goodwill with many of their other customers, same as it did for me. After downloading the v6 Max's firmware from the Keychron repo, the new animation successfully flashed! Admittedly it was my fault for making the typo and not double checking, but I suspect a human would have suggested doing so long before Claude did.

We then encountered the first problem with the actual code: the frames weren't displaying on the keyboard correctly. Claude was happy to help debug (actually, I found debugging to be one of its strongest skills), and we determined that the keyboard layout wasn't directly a matrix. Keychron's layout included blank spaces in places like the function and arrow keys. While this did break the code, it was great for our project: we can't control keys where there are no LEDs, after all. A major use case of QMK is for simple animation, so it helps to be able to directly map the keys to an actual rectangular matrix.

Claude fixed the bug to properly take into account the gaps in the keyboard, and added the option to provide your own matrix layout in the form of a .txt file so that it would work properly with any QMK compatible keyboard.

The next bug was that the frames would only flash briefly, and then instantly vanish. Claude updated the code so that it would draw the current video frame every actual frame, and the animation was finally smooth! At this point we had essentially an entire graphics engine in the keymap file, and were running out of room for how long the video could be.

As much as I've praised the V6 Max, one issue I did encounter was that the microcontroller only had 256KB of flash memory. Of course, that's probably plenty for most use cases, and I doubt too many people are using it for something as traditionally data heavy as video files... But there is a version of the same microcontroller with 1.6MB available for $10 from the OEM, so I'm seriously considering upgrading.

That aside, those of you who've worked in memory constrained environments might be thinking something along the lines of "Why is this guy complaining about the memory size when all of the frames are full bitmaps?" ...Well, hypothetical critical reader, that's a great point. Since this whole project was me demoing Claude to myself, I went ahead and asked:

> Everything works great, but even a slow animation is cutting it close to the file size limit. Is there a way we can implement compression to play these animations more memory efficiently?

It gladly complied, and implemented a simple run-length-encoding compression to the script. This nearly halved the file size, but I wasn't impressed. After all, Bad Apple!! is a largely black and white video. On a resolution with 109 total pixels, the gradients weren't of huge concern to me. If we could get a monochrome version going, every frame would have a bit depth of 1— already pretty small, and excellent for compression!

Prompting Claude with the monochrome idea as a way to decrease file size, it came up with a simple algorithm to convert to black and white and then compress. This compression algorithm worked great, and regularly got above 20× compression! Now that we were getting such great ratios, it turned out that you could, in fact, have too much of a good thing.

Even at 109 pixels per frame, it turns out when you can fit 3000+ frames, you get a few more than 65,535 pixels. Given that Claude was using shorts, this caused some issues. Giving it the console outputs, however, made it quickly realise and update everything to use ints capable of storing up to 64 bits instead.

I was finally able to flash the full video onto the keyboard! (Well, skipping every third frame.) That allowed me to check the entire animation, and I realised quite a few frames were unrecognisable... This was a visual problem, so quite difficult to explain to Claude. I prompted it to adjust the scaling algorithm, but nothing it did would work well. I noticed the problems were largely random pixels being black or white, far away from the main chunks of colour. I prompted Claude to implement an algorithm that would adjust the threshold based on whether the image was majority black or white, it quickly did, and suddenly everything worked great!

I took a quick demo video, then had Claude update the readme to be sure it included all of the features and options we had implemented. At this point I had seen results, and was convinced of the value of Claude, so I subscribed to the pro plan that gives access to Claude code. Everything up to this point is fully possible using the free, online version of Claude, and you can try a similar project yourself if you'd like. The final stretch, however, fully leveraged Claude Code, a version of the model that can read code on your local machine and integrate with other services.

I had Claude Code tidy up my local repo, then push a "version 1.0" to my GitHub using Claude Pro's GitHub connection. I then had it make a basic GUI, so any potential users wouldn't need to navigate through the spaghetti of flags needed to get the terminal version working correctly. Finally, I let it compile the finished product into binaries for both Linux and Windows using whatever tools it decided on, and then push to GitHub as a release. Both versions execute great, and the source code and binaries are available to try [here](https://github.com/gamingTimewarp/claude-keyboard-animation).

At the time of writing, I've currently just pushed release 1.2, and I don't plan to do anything further. If I think of any more options for conversion or compression features, or want to polish the GUI, you may see more in the future. For now, I think the [results speak for themselves](https://youtu.be/BknmBhSrVjE).


