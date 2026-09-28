# Devpost submission: CounterAgent

Paste from here. Plain text with no em-dashes. The story section uses Devpost markdown headers.

---

## Step 2: Project overview

**Project name:** CounterAgent

**Elevator pitch (190/200 characters):**

Every company gets an AI deal orchestrator. Buyer and vendor agents negotiate, approve, invoice and pay through Stripe, and provision a B2B software deal end to end in minutes, not 134 days.

---

## Step 3: Project details (the story)

## Inspiration
Buying software at a large company takes 134 days on average, and security review alone adds two to six weeks. Buyers are already sending AI agents to run procurement: Forrester expects one in five B2B sellers to face an agent-led negotiation this year. The other side of the table is still people, and analysts put fully agent-to-agent deals at 2027 or later. We wanted to see if we could close one today, safely.

## What it does
CounterAgent gives every company a deal orchestrator: one frontier agent commanding its own departments (procurement, security, legal, finance, deal desk). Orchestrators from a buyer and competing vendors meet across the table and run the whole deal:

- RFP and opening proposals
- Market research: the buyer's procurement analyst (Claude on Brainbase) searches the web for current discount and renewal benchmarks, reads Acme's internal files (procurement policy, past contracts, pilot usage, budget memo), and writes a cited negotiation brief with an opening ask, a target and a walk-away price
- Security questionnaire, answered only from each vendor's trust pack with citations and graded by the buyer's security agent
- Multi-round price and terms negotiation, driven by the analyst's brief and capped at its walk-away price
- Legal review against the buyer's red lines
- Award, then approvals that go up the chain of command
- Sanctions and bank-detail fraud checks, and the purchase order
- A real Stripe (test mode) invoice that the buyer's finance agent pays, taking the 2% early-payment discount
- Provisioning of the buyer's workspace on Cloudflare

There is no human in the loop. Trust comes from charters. Every agent has one: what it can do alone, what it must escalate, and what it must prove. Charters are enforced in code, not by the model. In our runs you can watch a vendor's own agent offer a price below its floor and get blocked by its own charter. You can also watch a subagent try to go around procurement to the buyer's orchestrator and get stopped by the channel rule: subagents only talk to their counterpart at the other company, and only orchestrators can commit the company.

A live human clock runs next to the agents. Every interaction adds the typical time a human team takes for that step, from published benchmarks (an email negotiation turn, a security questionnaire, a legal redline, invoice processing). A full deal comes to about 106 human days, 85 of them before signature, right on the 84-day industry median, against about five minutes for the agents.

Spotlight lets you open any agent and see its real work. For the analyst that means every web search and file read as it happens, then the sources it cited. For the others it is the message it received, the charter it runs under, its raw model output, the charter check, and where it sent the result. A scale view shows the same chain-of-command architecture grown to thousands of agents. That view is a simulation of the same architecture; the deal itself is real.

## How we built it
- **Brainbase:** hosts the frontier agents (Claude Sonnet 5) through the Universal Managed Agents API. Each award, approval and countersignature is a real Brainbase thread with an ID you can see in Spotlight. The procurement analyst runs in a Brainbase sandbox with web search and Acme's internal files mounted, and we stream its tool events into Spotlight live.
- **Cloudflare:** the app runs on Workers, and every deal is a Durable Object that drives the stage machine. Workers AI runs the open-weight department subagents: Llama 3.3 70B for the buyer, Llama 4 Scout and Mistral Small 3.1 for the vendors. Frontier models handle judgment and open models handle volume.
- **Stripe:** test-mode customer, invoice referencing the PO, finalize, and pay.
- **Anthropic Claude:** powers the orchestrators' judgment.
- **Front end:** Cytoscape.js for the chain-of-command graph with pictogram agents that change pose by state, and Chart.js for the humans-vs-agents time chart.

## Challenges we ran into
- Research takes about two minutes, so the analyst starts at the proposal stage and works in parallel with the security review. Negotiation waits for its brief, and falls back to Acme's written policy if research fails.
- Brainbase agent turns take 40 to 60 seconds each because they boot a full sandbox, so we split the work: a frontier model for the few decisions that bind the company, and fast open-weight models for the many department turns.
- Reasoning-only open models returned empty answers, so we switched to models that answer directly.
- Claude sensibly refused to countersign a contract it believed was real. We fixed that by telling it the truth: fictional companies, test-mode money, and the exact authority its role holds. Explicit refusals are respected, never overridden.
- Making approvals fail closed, so that an unreadable model reply never counts as a yes.

## Accomplishments that we're proud of
- An analyst agent that makes a real judgment call: it found that Acme's own 2024 contract got 20% off for a 24-month term, checked that against 2026 market benchmarks, and set the negotiation target from that evidence, with sources. The deal landed exactly on that target.
- A B2B deal closed end to end in about five minutes on the deployed app, including a real Stripe test-mode invoice sent and paid by agents.
- Governance you can watch: blocked offers, blocked out-of-channel messages, a blocked fraudulent bank-detail change, and approvals routed up the chain of command.
- Every agent's real model calls can be inspected live.

## What we learned
The hard part of agent-to-agent commerce is authority, not intelligence: who may agree to what, who they may talk to, and how you prove what happened. Charters, counterpart channels and a chain of command turned that from a trust problem into a code problem.

## What's next
- Seller-side pilots: a deal desk orchestrator for B2B software companies that can safely say yes to incoming buyer agents.
- Real documents: Common Paper standard contracts and the CSA CAIQ questionnaire.
- Renewals and expansions run by the same orchestrators.
- Brainbase evals that score every agent decision and improve playbooks between deals.

---

## Built with

brainbase, claude, anthropic, cloudflare-workers, workers-ai, durable-objects, stripe, llama, mistral, cytoscape.js, chart.js, typescript, javascript

---

## Links ("Try it out")

- Live app: https://deal-room.deal-room.workers.dev
- A completed production deal (analyst research, negotiation, approvals, paid Stripe test invoice): https://deal-room.ishaqibrahimm1000.workers.dev/?deal=1fe45c
  - Starting a new deal needs the demo passcode, because it spends model credits. Viewing is open.
- Code: https://github.com/Gentle-mann/deal-room

---

## Video

Demo video (Loom): https://www.loom.com/share/cf1eb029f0e242f294725dd14144ef50

Devpost's video field only accepts YouTube, Vimeo or Youku links. Either download the video from Loom and upload it to YouTube as Unlisted for that field, or add the Loom link under "Try it out" and in the story.
