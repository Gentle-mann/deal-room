# Deal Room: 3-minute pitch

Structure follows `hackathon-lessons.md`: roughly 25% problem, 50% live demo built around 2–3 wow moments, 15% how it works, 10% close.

## Before you walk up

A full live deal now takes about 5 minutes (real Brainbase research, proposals, award and approval), which is longer than the pitch. Use two tabs:

- **Tab 1, "finished":** a deal run 5 to 10 minutes earlier, left on its closed takeover screen (the closing time, the speedup and the paid Stripe invoice). Start it with ▶ Demo tour when you sit down.
- **Tab 2, "live":** press ▶ Demo tour (key D) about 30 seconds before you start talking, so the Procurement analyst is researching during your demo section.
- Keep the recorded backup video one click away.

## Script

**[0:00–0:25] Problem**

"Buying software at a big company takes 134 days on average. Security review alone adds two to six weeks. Buyers are starting to send AI agents to do procurement. Forrester expects one in five B2B sellers to face an agent-led negotiation this year. But the other side is still people, and analysts put agent-to-agent deals at 2027 or later."

**[0:25–0:45] What it is**

"Deal Room gives every company a deal orchestrator: a frontier agent commanding its own departments, like procurement, security, legal and finance. Each agent works under a charter: what it can do alone, what it must ask up the chain of command, and what it must prove. Orchestrators from different companies meet here and close the whole deal. No human in the loop."

**[0:45–1:40] Live, tab 2: an agent's real work (wow 1)**

*[The tour has the Procurement analyst in Spotlight, with research steps streaming in.]*

"This is live. Acme's procurement analyst runs on Claude through Brainbase, and it is doing real work right now. It searched the web for 2026 SaaS discount benchmarks. It is reading Acme's internal files: past contracts, the procurement policy, pilot usage and the CFO's budget memo."

*[When the brief lands:]* "And it made a call: open at 28% off, target 20%, walk away above the budget. Twenty percent matches Acme's own last analytics contract and sits mid-range of this year's market benchmarks. Every number cites a URL or a file."

"Procurement negotiates from that brief, and the vendors' deal desks run on open-weight models on Cloudflare. If any agent tries to go past its limits, like a price below its own floor or a message outside its channel, code blocks it. The model can't overrule the charter."

**[1:40–2:15] Tab 1: the deal closed (wow 2)**

*[Switch to tab 1, on the closed takeover.]*

"Here's the deal we started a few minutes ago, run end to end in four minutes, against 134 days. The vendor sent a real Stripe invoice referencing the PO. Acme's finance agent did a three-way match, took the 2% early-payment discount and paid it. The workspace was provisioned on Cloudflare the moment the payment cleared."

*[Point at the dock chart.]* "The dashed line is the human benchmark and the solid line is the agents. That gap is the business."

**[2:15–2:35] Scale**

*[Press V for the scale view, then ↑ twice.]*

"And this is where it goes: the same chain of command at thousands of agents. This view is a simulation, but the structure is exactly what you just watched run live."

**[2:35–3:00] Close**

"Every company is about to have agents that buy and sell. Deal Room is where they meet, with charters that make them safe to trust. Frontier models for judgment, open models for volume, Stripe for the money, Cloudflare for the infrastructure, Brainbase to run every agent. Thank you."

## Q&A prep

- **"What's real and what's simulated?"**
  - **Real:** 11 agents, real model calls (Brainbase thread IDs, Workers AI), charter checks in code, a Stripe sandbox invoice and payment, the deployed Worker, and the provisioned workspace URL.
  - **Simulated:** the thousands-of-agents scale view, plus sample companies and documents.
- **"Why would a company trust this?"** Charters are enforced in code, not by the model. Approvals fail closed. Subagents can't commit the company or contact anyone outside their counterpart channel. Every message and model call is logged and replayable (Spotlight).
- **"Where are the humans?"** Humans write the charter once: budget, red lines, and authority limits by level. After that, the chain of command handles approvals, the same way delegation of authority works in companies today.
- **"Who pays?"** Sellers first: a deal-desk orchestrator priced per closed deal or as a percentage of contract value, because buyer agents are already arriving (Lio raised $30M from a16z for buyer agents). Then buyers. Network effect: every company on the protocol makes every deal on it faster.
- **"Competitors?"**
  - Lio: buyer-side procurement.
  - Pactum: negotiates for Walmart, but against human suppliers.
  - AI SDRs: prospecting only.
  - Paperclip: an org chart with no real money or infrastructure.
  - Nobody else closes both sides end to end with enforced authority, payment and provisioning.
- **"How does the analyst decide?"** Live web search plus Acme's own files: past contracts, policy, pilot usage, and the budget memo. It must cite a URL or a file for every number, and code caps its walk-away at the budget whatever it recommends.
- **"What if the model hallucinates?"** Then the charter blocks it. You saw it happen live: the offer below the floor, the out-of-channel message, the fraudulent bank-detail change.
- **"Why two model tiers?"** A frontier model handles the few judgment calls that bind the company; open-weight models handle the high-volume department work. It's cheaper and faster, and it's how an enterprise would actually run this.

## Sources for the numbers

- 134-day mean and 84-day median B2B SaaS cycle, 2026 (ziellab); security review adds 2–6 weeks (Arcade 2026 benchmark)
- Forrester: about 20% of B2B sellers face agent-led quote negotiations in 2026; Lio's $30M Series A (a16z, Mar 2026); analysts: fully agent-to-agent B2B deals beyond 2027 (elogic, webpronews)
- The script says "134 days on average" because 134 is the mean. The median is 84 days, which is still about 25,000 times slower than a 5-minute close.
