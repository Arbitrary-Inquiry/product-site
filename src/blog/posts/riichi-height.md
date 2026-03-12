---
title: "Riichi-ing New Heights with Claude Code"
date: 2026-03-11
author: Andrew Wright
topics:
  - AI
  - Mahjong
  - Android Development
---

Mahjong is one of my favourite games of all time.

Combining the risk/reward element of poker, the hand-building and discarding strategy of rummy, with the tactile appeal and beautiful art found in games like hanafuda, it’s truly unique. Every tile has weight, texture, and meaning, and every decision you make echoes through the rest of the round.

The only issue I’ve had with it, as an American in the midwest, is that not many other people know how to play it.
Even as it slowly grows in popularity worldwide, there are still places where it's relatively obscure. A big part of that is that Mahjong — especially Japanese riichi mahjong — can be overwhelming to learn.

It took me a while to learn it myself, even as someone who absolutely loved it from the beginning. And even now, after many games, I’m still only about 50% confident whenever I calculate a score by hand.
So you can imagine how intimidating it can be for someone completely new. There are dozens of yaku (valid scoring patterns) to learn, multiple types of melds, fu calculations, dora indicators, and that’s before someone even understands the difference between a pon and a kan.

Whenever I tried teaching friends, the same thing always happened: they enjoyed the tile play immediately, but the scoring system created a wall. Once a hand ended, everyone would pause while someone tried to calculate the score, flipping through rule pages and second-guessing every step.
I searched for apps to solve this problem before, but I couldn’t find an English-language tool that really did what I wanted. There are great Mahjong clients and some calculators, but very few tools designed specifically to help new players understand why a hand scores the way it does while still being fast enough for experienced players who just want to verify a result.

But you've seen the title. You know where this is going.

We live in an age where you don't just give up when the weirdly specific app you wanted doesn't exist. You build it yourself.
This used to be a much taller order than it is today. Even for experienced developers, personal projects often die in the gap between "cool idea" and "weeks of implementation time." Building a polished tool requires design work, boilerplate, debugging, edge case handling, and a hundred other little details.
Large language models are quietly changing that.

LLM-assisted development doesn’t replace programmers, but it dramatically lowers the friction involved in turning an idea into something real. Instead of staring at a blank editor and scaffolding everything from scratch, you can iterate rapidly: describe a component, refine it, test it, and improve it in minutes.
This shift makes something possible that used to be rare: highly personalized software. Tools that exist simply because someone wanted them to exist.
Want a utility tailored to a niche hobby? A calculator for an obscure game rule? A personal knowledge tool that works exactly the way your brain works?
Instead of hoping someone builds it someday, you can increasingly just make it.

I’ve always been the "build it yourself" type, but even with some wonderful Mahjong APIs out there, I was never able to create something I was satisfied with. The scoring logic alone is complicated enough that projects like this tend to stall halfway through.
Recently, though, I’ve had the opportunity to use Anthropic’s Claude Code as part of my job, with full permission to experiment with it on the silliest side projects I can think of.
That made this the perfect project to revisit.

The result is a small tool I’m calling the Riichi Companion: a Mahjong learning aid and score calculator designed to be just as useful for someone learning their first yaku as it is for someone who has played a hundred thousand hanchan.

The goal was to make something that sits comfortably between a rulebook and a calculator.
For new players, it helps visualize what makes a valid winning hand, how melds fit together, and which yaku apply. Instead of just outputting a number, it breaks down the reasoning so players can learn the scoring system naturally as they play.
For experienced players, it functions as a fast verification tool. Input the tiles, indicate the melds, and it calculates the full score — han, fu, and final point values — without having to mentally step through the entire ruleset.

Some of the things I tried to focus on while building it include:

Clear visualization of tile groups and melds
Automatic yaku detection
Accurate han and fu calculation
A fast workflow so it doesn’t slow down real games
An interface that makes sense even if you’ve never played Mahjong before
In other words: something you could hand to a brand new player without overwhelming them, but that still respects the complexity and beauty of the game.

And honestly, projects like this are exactly the kind of thing that LLM-assisted development excels at. It's the perfect example of software that might never have existed otherwise — not because it was impossible, but because it was too niche to justify the effort.
Now those barriers are disappearing.
Which means more personal tools, more hobby software, and more strange little projects built simply because someone thought, “I wish this existed.”
And now, here we are.
A Mahjong companion app that helps new players learn the game and helps experienced players score hands quickly and accurately.

Try a [live demo](https://tomaranai.pro/riichi-companion/analyzer) or [download the app here](https://github.com/gamingTimewarp/riichi-companion/releases)! 




