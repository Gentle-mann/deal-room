# Deal Room: 3-minute pitch

Structure follows `hackathon-lessons.md`: roughly 25% problem, 50% live demo built around 2–3 wow moments, 15% how it works, 10% close.

## Before you walk up

- Open `https://deal-room.ishaqibrahimm1000.workers.dev/?key=<passcode>` in the demo browser. Dark mode, full screen.
- **About 90 seconds before you start talking, press "▶ Demo tour".** A deal takes about 4 minutes, so the tour will be in Negotiation when you reach the demo section and at the invoice when you reach the payoff.
- Keep the recorded backup video one click away.

## Script

**[0:00–0:25] The problem**

"Buying software at a big company takes 134 days on average. Security review alone adds two to six weeks. Now buyers are sending AI agents to do procurement. Forrester expects one in five B2B sellers to face an agent-led negotiation this year. But the other side of the table is still humans, and analysts say agent-to-agent deals are 2027 at the earliest."

**[0:25–0:45] What it is**

"Deal Room gives every company a deal orchestrator: one frontier agent commanding its own departments, like procurement, security, legal and finance. Each agent works under a charter: what it can do alone, what it must ask up the chain of command, and what it must prove. Orchestrators from different companies meet here and close the whole deal. No human in the loop."

**[0:45–2:10] Live demo, with the tour already running**

*[Screen: the chain of command. Acme's tree on the left, two vendors on the right, messages flying.]*

"This is live, not a video. Eleven real agents. The orchestrators run on Claude through Brainbase, and the departments run on open-weight models on Cloudflare Workers AI. Three companies are negotiating right now."

*[The tour spotlights the vendor's deal desk.]*

**Wow 1: an agent's real work.** "This is one agent's actual work. What it received, the charter it runs under, and its real model output. Watch: its model just offered a price below its own floor, and its charter blocked it in code. The model can't overrule the charter."

*[If the channel block appears in the log:]* "And here Quickdash's deal desk tried to go around procurement straight to Acme's orchestrator. Blocked. Subagents only talk to their counterpart, and only orchestrators can commit the company."

*[The tour moves to Acme's orchestrator at Award, then Approvals.]* "Acme's orchestrator awards the deal. The contract is over Finance's authority, so Finance escalates up the chain of command, and the orchestrator approves within its own limit. That's a real Brainbase thread, and you can see its ID."

*[Invoice card appears, then the PAID stamp.]*

**Wow 2: money moves.** "Beacon invoices through Stripe, referencing Acme's purchase order. Acme's finance agent does a three-way match, takes the two percent early-payment discount, and pays. The service is provisioned on Cloudflare the moment the payment clears."

**[2:10–2:35] The payoff and scale**

*[Closed banner plus the humans-vs-agents chart.]*

"Closed in about four minutes. The dashed line is the 134-day human average. That solid line is us."

*[Switch to the scale view and press Grow twice.]*

"And this is where it goes: the same chain of command, grown to thousands of agents across companies. This view is a simulation, but the structure is exactly what you just watched run live."

**[2:35–3:00] Close**

"Every company is about to have agents that buy and sell. Deal Room is where they meet, with charters that make them safe to trust. Frontier models for judgment, open models for volume, Stripe for the money, Cloudflare for the infrastructure, Brainbase to run and score every agent. Thank you."

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
- **"What if the model hallucinates?"** Then the charter blocks it. You saw it happen live: the offer below the floor, the out-of-channel message, the fraudulent bank-detail change.
- **"Why two model tiers?"** A frontier model handles the few judgment calls that bind the company; open-weight models handle the high-volume department work. It's cheaper and faster, and it's how an enterprise would actually run this.

## Sources for the numbers

- 134-day mean and 84-day median B2B SaaS cycle, 2026 (ziellab); security review adds 2–6 weeks (Arcade 2026 benchmark)
- Forrester: about 20% of B2B sellers face agent-led quote negotiations in 2026; Lio's $30M Series A (a16z, Mar 2026); analysts: fully agent-to-agent B2B deals beyond 2027 (elogic, webpronews)
- The script says "134 days on average" because 134 is the mean. The median is 84 days, which is still about 25,000 times slower than a 5-minute close.
