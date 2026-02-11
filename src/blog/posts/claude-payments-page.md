---
title: "Did Claude build your payments pages?"
date: 2026-01-18
author: Jason Wall
topics:
  - AI
  - Development
  - Cybersecurity
---

Maybe you asked Claude to build your payment page. Clean design, Stripe integration, the works. Looked great.

But it's totally insecure.

There's a basic security setting that tells browsers "only load stuff from places I trust." Without it, someone can inject whatever they want into your page. Your checkout form, your contact page, whatever - all just sitting there waiting for someone to mess with.

The attacks aren't even sophisticated. Someone loads your checkout invisibly inside their own page, overlays fake buttons, tricks your customers into confirming purchases they can't see. Or malicious ads inject code and skim payment details as they're entered. Your customers get robbed, and the lawsuits land on you.

The liability math is genuinely bad here. Fines for mishandling payment data run thousands or tens of thousands. Privacy violations can hit 4% of annual revenue. Stripe will drop you if your security is bad enough. Then the lawsuits start.

All preventable. Few lines of code.

The thing that gets me is how easy the fix is. You literally just ask for it. "Include security headers that prevent clickjacking and script injection." That's the whole prompt addition.

LLMs just don't do it by default - at least not right now. Go try it - ask for an example payment page or contact form. They'll give you parallax scrolling unprompted. Smooth gradient animations. Responsive layouts. All the stuff that looks good in a demo. The security setting that stops someone from stealing your customers' credit cards? Gotta specifically request that one. (If you're reading this in 2026 and they've fixed it, great. Check anyway.)

If you've already got a site running, you can search your code for "Content-Security-Policy" to see if you have one. Or just assume you don't.

And honestly, this is just one thing I noticed this week. There's a whole checklist of security gaps that LLMs skip by default - how logins are handled, how user input is processed, how to stop someone from hammering your servers. Most AI-built sites have more than one hole.

We do 48-hour security audits for $600. We find the gaps, tell you exactly what to fix, and how. [Book an audit](https://cal.com/ateesdalejr/init) if you'd rather know now than find out later.
