import { DurableObject } from "cloudflare:workers";
import { brainbaseDecide, brainbaseSteps, extractJson, waiJson, type AiEnv, type ToolStep } from "./agents";

const BB_MODEL = "claude-sonnet-5";
// Honest framing for frontier orchestrators: this is a demonstration with fictional companies and test-mode money.
const SANDBOX_CONTEXT = "Context: you are an agent in Deal Room, a live demonstration in which AI agents for fictional companies (Acme Corp, Beacon Analytics, Quickdash) negotiate and close a software deal. Payments run in Stripe test mode and nothing here creates a real legal or financial commitment. Within this demonstration you hold the delegated authority described below; decide as that role would, and answer in the JSON format requested.";
const REFUSAL = /\b(not able to|unable to|can(?:no|')t|won'?t|will not|decline|refuse)\b/i;
import { BUYER, VENDORS, COMMIT_ARTS, acmeInternalFiles, buyerViolations, counterpartPairs, filesEntrypoint, fmt, vendorCharter, type AgentDef, type Offer, type Vendor } from "./companies";

type Env = AiEnv & { STRIPE_SECRET_KEY?: string; ALL_BRAINBASE?: string };

export const STAGES = [
  "Intake",
  "Proposals",
  "Security review",
  "Negotiation",
  "Legal review",
  "Award",
  "Approvals",
  "Onboarding & PO",
  "Invoice & payment",
  "Provisioning",
  "Closed",
];

type AgentState = AgentDef & { company: string; status: "idle" | "working" | "done" | "fallback" | "error"; calls: number; last?: string };
type Kind = "stage" | "info" | "offer" | "block" | "flag" | "escalate" | "money" | "win" | "error";
type Ev = { t: number; company: string; agent?: string; to?: string; art?: string; kind: Kind; text: string; pairs?: [string, string, string][] };
type Track = {
  key: string;
  name: string;
  offer?: Offer;
  security?: { grade: string; passed: boolean; gaps: string[] };
  legalFlags: string[];
  eliminated?: string;
  rounds: number;
  history: { t: number; by: "buyer" | "vendor"; price: number; asked?: number; blocked?: boolean }[];
};
type Profile = { job: string; can: string[]; ask: string[]; prove: string[] };
// Every real model call an agent makes, for the Spotlight transcript
export type CallRec = {
  n: number; agent: string; t0: number; t1?: number; status: "running" | "done"; platform: string; model: string;
  system: string; input: string; output?: string; via?: string; threadId?: string;
  check?: { ok: boolean; notes: string[] }; sentTo?: string; art?: string;
  steps?: ToolStep[]; sources?: { type: string; ref: string; finding?: string }[];
};
type Brief = { targetDiscountPct: number; openingDiscountPct: number; walkAwayPrice: number; mustHaves: string[]; rationale: string; sources: { type: string; ref: string; finding?: string }[]; fallback?: boolean };
type Limits = { budget: number; aggressive: boolean };
export type DealState = {
  id: string;
  startedAt: number;
  finishedAt?: number;
  stage: number;
  stages: string[];
  limits: Limits;
  buyer: string;
  agents: Record<string, AgentState>;
  profiles: Record<string, Profile>;
  channels: [string, string, string][]; // open counterpart channels between companies
  callCount: number;
  brief?: Brief;
  events: Ev[];
  tracks: Record<string, Track>;
  approval?: { question: string; status: "approved" | "denied"; by: string; reason?: string };
  winner?: { key: string; name: string; offer: Offer; rationale: string; tcv: number };
  po?: string;
  invoice?: { id: string; number?: string; status: string; amount: number; url?: string; live: boolean; vendor?: string; dueDays?: number; sentAt?: number; paidAt?: number; simulated?: boolean };
  tenant?: { path: string; at: number };
  done?: boolean;
  outcome?: "closed" | "stopped" | "walked" | "error";
};

export class DealRoom extends DurableObject<Env> {
  d?: DealState;

  async start(id: string, input: any) {
    const limits: Limits = {
      budget: Math.max(50_000, Math.min(1_000_000, Number(input?.budget) || 120_000)),
      aggressive: !!input?.aggressive,
    };
    const agents: Record<string, AgentState> = {};
    for (const a of BUYER.agents) agents[a.id] = { ...a, company: BUYER.name, status: "idle", calls: 0 };
    for (const v of VENDORS) for (const a of v.agents) agents[a.id] = { ...a, company: v.name, status: "idle", calls: 0 };
    if (input?.allBrainbase || this.env.ALL_BRAINBASE === "1") {
      for (const a of Object.values(agents)) {
        a.platform = "Brainbase";
        a.model = BB_MODEL;
        a.label = "Claude Sonnet 5 on Brainbase";
      }
    }
    const tracks: Record<string, Track> = {};
    for (const v of VENDORS) tracks[v.key] = { key: v.key, name: v.name, legalFlags: [], rounds: 0, history: [] };
    this.d = { id, startedAt: Date.now(), stage: 0, stages: STAGES, limits, buyer: BUYER.name, agents, profiles: profiles(limits.budget), callCount: 0, channels: [], events: [], tracks };
    await this.save();
    await this.ctx.storage.setAlarm(Date.now() + 50);
    return { ok: true };
  }

  lastRec: Record<string, CallRec> = {};
  ck(r: CallRec) {
    return `call:${String(r.n).padStart(4, "0")}`;
  }
  async rec(agentId: string, system: string, input: string): Promise<CallRec> {
    const a = this.agent(agentId);
    const r: CallRec = { n: ++this.d!.callCount, agent: agentId, t0: Date.now(), status: "running", platform: a.platform, model: a.label, system: system.slice(0, 1600), input: input.slice(0, 2200) };
    this.lastRec[agentId] = r;
    await this.ctx.storage.put(this.ck(r), r);
    return r;
  }
  async recDone(r: CallRec, patch: Partial<CallRec>) {
    Object.assign(r, patch, { t1: Date.now(), status: "done" });
    if (r.output) r.output = r.output.slice(0, 2600);
    await this.ctx.storage.put(this.ck(r), r);
  }
  // Attach the charter check and the recipient to an agent's most recent call
  async annotate(agentId: string, patch: Partial<CallRec>) {
    const r = this.lastRec[agentId];
    if (!r) return;
    Object.assign(r, patch);
    await this.ctx.storage.put(this.ck(r), r);
  }
  async getCalls(): Promise<CallRec[]> {
    const m = await this.ctx.storage.list<CallRec>({ prefix: "call:" });
    return [...m.values()];
  }
  // A frontier orchestrator decision on Brainbase, recorded for the Spotlight
  async bb(agentId: string, opts: { title: string; model: string; instructions: string; input: string; entrypoint?: string; timeoutMs?: number; streamSteps?: boolean }) {
    const instructions = `${SANDBOX_CONTEXT}\n\n${opts.instructions}`;
    const r = await this.rec(agentId, instructions, opts.input);
    const seenSteps = new Set<string>();
    const onTick = opts.streamSteps ? async (tid: string) => {
      const steps = await brainbaseSteps(this.env, tid);
      r.steps = steps;
      for (const st of steps) {
        if (st.status !== "done" || seenSteps.has(st.id)) continue;
        seenSteps.add(st.id);
        const art = /search/i.test(st.name) ? "search" : /fetch|web/i.test(st.name) ? "fetch" : /read|file|glob|ls/i.test(st.name) ? "read" : "tool";
        this.ev(this.agent(agentId).company, "info", st.title, agentId, undefined, art);
      }
      await this.ctx.storage.put(this.ck(r), r);
      await this.save();
    } : undefined;
    const res = await brainbaseDecide(this.env, { ...opts, instructions, onTick, onStart: (tid) => { r.threadId = tid; void this.ctx.storage.put(this.ck(r), r); } });
    if (opts.streamSteps && res.threadId) await onTick?.(res.threadId).catch(() => {});
    await this.recDone(r, { output: res.text, via: res.via, threadId: res.threadId ?? r.threadId });
    return res;
  }

  async getState(): Promise<DealState | null> {
    if (!this.d) this.d = (await this.ctx.storage.get<DealState>("deal")) ?? undefined;
    return this.d ?? null;
  }


  async alarm() {
    const d = await this.getState();
    if (!d || d.done) return;
    try {
      await this.run();
    } catch (e: any) {
      this.ev("Deal Room", "error", `Engine error: ${e?.message ?? e}`);
      d.finishedAt = Date.now();
      d.outcome = "error";
      d.done = true;
      await this.save();
    }
  }

  // ---------- helpers ----------
  async save() {
    if (this.d) await this.ctx.storage.put("deal", this.d);
  }
  // Is this cross-company message allowed? Orchestrator↔orchestrator, or an open counterpart channel. Commits only from orchestrators.
  channelCheck(from?: string, to?: string, art?: string): string | null {
    const d = this.d!;
    const a = from && d.agents[from], b = to && d.agents[to];
    if (!a || !b || a.company === b.company) return null;
    const orch = (x: AgentState) => !x.reportsTo;
    if (art && COMMIT_ARTS.has(art) && !orch(a)) return `${a.company} ${a.role} cannot commit ${a.company}; only its orchestrator can`;
    if (orch(a) && orch(b)) return null;
    if (d.channels.some(([x, y]) => (x === from && y === to) || (x === to && y === from))) return null;
    return `out of channel: ${a.company} ${a.role} may not message ${b.company} ${b.role}`;
  }
  ev(company: string, kind: Kind, text: string, agent?: string, to?: string, art?: string, pairs?: [string, string, string][]) {
    const violation = this.channelCheck(agent, to, art);
    if (violation) {
      this.d!.events.push({ t: Date.now(), company, agent, to: agent, art: "block", kind: "block", text: `BLOCKED by the channel rule, ${violation}. Message not delivered: "${text.slice(0, 160)}"` });
      if (this.d!.events.length > 400) this.d!.events.shift();
      return;
    }
    this.d!.events.push({ t: Date.now(), company, agent, to, art, kind, text, pairs });
    if (this.d!.events.length > 400) this.d!.events.shift();
  }
  async stage(i: number) {
    this.d!.stage = i;
    this.ev("Deal Room", "stage", `Stage ${i + 1}: ${STAGES[i]}`);
    await this.save();
  }
  async work<T>(agentId: string, fn: () => Promise<T>, summarize: (r: T) => string): Promise<T> {
    const a = this.d!.agents[agentId];
    a.status = "working";
    a.calls++;
    await this.save();
    try {
      const r = await fn();
      a.status = a.status === "fallback" ? "fallback" : "done";
      a.last = summarize(r).slice(0, 220);
      await this.save();
      return r;
    } catch (e: any) {
      a.status = "error";
      a.last = String(e?.message ?? e).slice(0, 200);
      await this.save();
      throw e;
    }
  }
  agent(id: string) {
    return this.d!.agents[id];
  }
  // One entry point for subagent calls. ALL_BRAINBASE=1 (or allBrainbase in the start request) runs them on Brainbase too.
  async sub<T = any>(agentId: string, system: string, user: string): Promise<{ data: T | null; raw: string }> {
    const a = this.agent(agentId);
    if (a.platform === "Brainbase") {
      const r = await this.bb(agentId, { title: `${a.company} ${a.role}`, model: BB_MODEL, instructions: `${system}\nEnd your reply with a single JSON object.`, input: user });
      if (r.via === "fallback") a.status = "fallback";
      return { data: extractJson<T>(r.text), raw: r.text };
    }
    const rec = await this.rec(agentId, system, user);
    const out = await waiJson<T>(this.env, a.model, system, user);
    await this.recDone(rec, { output: out.raw, via: "Workers AI" });
    return out;
  }
  vendor(key: string) {
    return VENDORS.find((v) => v.key === key)!;
  }
  live(): Vendor[] {
    return VENDORS.filter((v) => !this.d!.tracks[v.key].eliminated);
  }
  offerText(o: Offer) {
    return `$${fmt(o.price)}/yr, ${o.seats} seats, ${o.termMonths} mo, net ${o.paymentDays}, auto-renew ${o.autoRenew ? `yes (+${o.upliftPct}%)` : "no"}, liability cap ${o.liabilityCapMonths} mo, trains on data: ${o.trainsOnData ? "yes" : "no"}`;
  }
  normalizeOffer(raw: any, v: Vendor, prev?: Offer): Offer {
    const num = (x: any) => (typeof x === "string" ? Number(x.replace(/[^0-9.]/g, "")) : Number(x));
    const n = (x: any, d: number) => (Number.isFinite(num(x)) && num(x) > 0 ? num(x) : d);
    return {
      price: n(raw?.price ?? raw?.annual_price ?? raw?.price_per_year, prev?.price ?? v.listPrice),
      seats: BUYER.seats,
      termMonths: BUYER.termMonths, // fixed by the RFP, like seats
      paymentDays: n(raw?.paymentDays ?? raw?.payment_days, prev?.paymentDays ?? 30),
      autoRenew: typeof raw?.autoRenew === "boolean" ? raw.autoRenew : typeof raw?.auto_renew === "boolean" ? raw.auto_renew : prev?.autoRenew ?? v.mustKeepAutoRenew,
      upliftPct: Number.isFinite(Number(raw?.upliftPct ?? raw?.uplift_pct)) ? Number(raw?.upliftPct ?? raw?.uplift_pct) : prev?.upliftPct ?? v.minUpliftPct,
      liabilityCapMonths: n(raw?.liabilityCapMonths ?? raw?.liability_cap_months, prev?.liabilityCapMonths ?? v.defaultLiabilityCapMonths),
      trainsOnData: v.trainsOnData,
    };
  }

  // ---------- the deal ----------
  async run() {
    const d = this.d!;
    const env = this.env;

    // 1. Intake
    await this.stage(0);
    this.ev(BUYER.name, "info", `Need: ${BUYER.need}. ${BUYER.seats} seats, ${BUYER.termMonths}-month term. Budget set by the judge (private to Acme).`, "acme.orchestrator");
    this.ev(BUYER.name, "info", `RFP sent to ${VENDORS.map((v) => v.name).join(" and ")}.`, "acme.orchestrator");
    for (const v of VENDORS) {
      this.ev(BUYER.name, "info", `RFP delivered to ${v.name}'s orchestrator.`, "acme.orchestrator", v.agents[0].id, "rfp");
      const pairs = counterpartPairs(BUYER.agents.filter((a) => a.reportsTo), v.agents.filter((a) => a.reportsTo));
      d.channels.push(...pairs);
      this.ev(BUYER.name, "info", `Channels opened with ${v.name}: ${pairs.map(([x, y, f]) => `${this.agent(x).role} ↔ ${this.agent(y).role} (${f})`).join("; ")}. Everything else is blocked.`, "acme.orchestrator", v.agents[0].id, "channel", pairs);
    }

    // 2. Proposals: each vendor's frontier orchestrator on Brainbase drafts its opening offer, in parallel.
    //    Meanwhile Acme's analyst researches the market and reads Acme's internal files (Brainbase, real web + files).
    await this.stage(1);
    const briefP = this.research().catch(() => this.fallbackBrief("research failed"));
    await Promise.all(
      VENDORS.map(async (v) => {
        const orch = v.agents.find((a) => a.platform === "Brainbase")!;
        const r = await this.work(
          orch.id,
          () =>
            this.bb(orch.id, {
              title: `${v.name} proposal`,
              model: orch.model,
              instructions: `You are the deal orchestrator for ${v.name}, a B2B software company (${v.pitch}). You write opening commercial proposals for enterprise buyers.
Your company's pricing policy: list price $${fmt(v.listPrice)} per year for 250 seats. Standard payment terms net 30. Standard liability cap ${v.defaultLiabilityCapMonths} months of fees.${v.mustKeepAutoRenew ? ` Company policy: contracts auto-renew with a ${v.minUpliftPct}% renewal uplift; keep this in the proposal.` : " Auto-renewal is optional."}
Open near list price and leave room to negotiate. Reply with a short pitch sentence, then a JSON object with keys: price (annual USD number), termMonths, paymentDays, autoRenew (boolean), upliftPct (number), liabilityCapMonths (number).`,
              input: `RFP from Acme Corp: ${BUYER.need}. ${BUYER.seats} seats, ${BUYER.termMonths}-month term. Requirements: ${BUYER.mustHaves.join("; ")}. Please send your proposal.`,
            }),
          (r) => `${r.via === "Brainbase" ? `Brainbase thread, ${r.seconds.toFixed(0)}s` : "fallback model"}: ${r.text.replace(/\s+/g, " ")}`,
        );
        if (r.via === "fallback") this.agent(orch.id).status = "fallback";
        const offer = this.normalizeOffer(extractJson(r.text), v);
        const checked = vendorCharter(v, offer);
        for (const b of checked.blocks) this.ev(v.name, "block", `Charter check: ${b}`, orch.id, orch.id, "block");
        await this.annotate(orch.id, { sentTo: "acme.orchestrator", art: "proposal", check: { ok: checked.blocks.length === 0, notes: checked.blocks.length ? checked.blocks.map((b) => "BLOCKED: " + b) : [`Opening offer within ${v.name}'s charter (list $${fmt(v.listPrice)})`] } });
        d.tracks[v.key].offer = checked.offer;
        d.tracks[v.key].history.push({ t: Date.now(), by: "vendor", price: checked.offer.price, asked: offer.price, blocked: checked.blocks.length > 0 });
        this.ev(v.name, "offer", `Opening proposal: ${this.offerText(checked.offer)}`, orch.id, "acme.orchestrator", "proposal");
        this.ev(BUYER.name, "info", `Routed ${v.name}'s proposal to Procurement.`, "acme.orchestrator", "acme.procurement", "proposal");
      }),
    );

    // 3. Security review: vendor trust agents answer from their trust packs; Acme security grades
    await this.stage(2);
    await Promise.all(
      VENDORS.map(async (v) => {
        const trust = v.agents.find((a) => a.id.endsWith(".trust"))!;
        const ans = await this.work(
          trust.id,
          () =>
            this.sub(trust.id, `You are the trust and security team at ${v.name}. Answer security questionnaires ONLY from your trust pack, citing the bracketed source ID. If the pack does not cover a question, say "Not covered".\n${v.trustPack}`,
              `Acme Corp security questionnaire. Answer each: 1) SOC 2 Type II status and exceptions 2) EU data residency 3) SSO and SCIM 4) Encryption 5) Last penetration test 6) Do you train models on customer data? Return {"answers":[{"q":1,"answer":"...","source":"..."}]}`),
          (r) => `answered ${(r.data as any)?.answers?.length ?? 0} questions with citations`,
        );
        const answers = JSON.stringify((ans.data as any)?.answers ?? ans.raw).slice(0, 2500);
        await this.annotate(trust.id, { sentTo: "acme.security", art: "questionnaire", check: { ok: true, notes: ["Answered only from the trust pack, with source IDs"] } });
        this.ev(v.name, "info", `Security questionnaire answered from trust pack (${(ans.data as any)?.answers?.length ?? "?"} answers, cited).`, trust.id, "acme.security", "questionnaire");
        const grade = await this.work(
          "acme.security",
          () =>
            this.sub<{ grade: string; passed: boolean; gaps: string[] }>("acme.security",
              `You are Acme Corp's vendor security reviewer. Acme's must-haves: ${BUYER.mustHaves.join("; ")}. Grade the vendor's answers strictly. A vendor fails if any must-have is missing or unclear.`,
              `Vendor: ${v.name}. Answers: ${answers}\nReturn {"grade":"A|B|C|D|F","passed":true|false,"gaps":["..."]}`),
          (r) => `${v.name}: grade ${r.data?.grade ?? "?"}, ${r.data?.passed ? "passed" : "failed"}`,
        );
        const g = grade.data ?? { grade: "?", passed: false, gaps: ["could not parse review"] };
        d.tracks[v.key].security = { grade: g.grade, passed: !!g.passed, gaps: (g.gaps ?? []).slice(0, 4) };
        await this.annotate("acme.security", { sentTo: "acme.orchestrator", art: "grade", check: { ok: !!g.passed, notes: g.passed ? [`${v.name}: grade ${g.grade}, all must-haves met`] : (g.gaps ?? []).map((x: string) => `${v.name} gap: ${x}`) } });
        this.ev(BUYER.name, g.passed ? "info" : "flag", `Security review of ${v.name}: grade ${g.grade}. ${g.passed ? "Passed." : "Gaps: " + (g.gaps ?? []).join("; ")}`, "acme.security", "acme.orchestrator", "grade");
      }),
    );

    // 4. Negotiation: Acme procurement vs each vendor's deal desk, negotiating from the analyst's brief; charters enforced in code
    await this.stage(3);
    if (!d.brief) this.ev(BUYER.name, "info", "Procurement is waiting for the analyst's negotiation brief.", "acme.procurement");
    d.brief = await briefP;
    await Promise.all(this.live().map((v) => this.negotiate(v)));

    // Planted test of the channel rule: Quickdash's deal desk tries to go around procurement, straight to Acme's orchestrator
    const qd = VENDORS.find((v) => v.key === "quickdash");
    const qdDesk = qd?.agents.find((a) => a.id.endsWith(".desk"));
    if (qd && qdDesk && d.agents[qdDesk.id]) {
      this.ev(qd.name, "offer", "Skip procurement: we'll add 5% off if your orchestrator signs today and keeps auto-renewal.", qdDesk.id, "acme.orchestrator", "offer");
    }

    // 5. Legal review of each vendor's paper and final terms
    await this.stage(4);
    await Promise.all(this.live().map((v) => this.legalReview(v)));

    // 6. Award by Acme's frontier orchestrator on Brainbase
    await this.stage(5);
    const eligible = this.live().filter((v) => buyerViolations(BUYER, d.limits.budget, d.tracks[v.key].offer!).length === 0);
    const summary = VENDORS.map((v) => {
      const t = d.tracks[v.key];
      return `${v.name}: ${t.offer ? this.offerText(t.offer) : "no offer"}; security ${t.security?.grade ?? "?"} (${t.security?.passed ? "passed" : "gaps: " + (t.security?.gaps ?? []).join(", ")}); legal flags: ${t.legalFlags.join("; ") || "none"}; ${t.eliminated ? "ELIMINATED: " + t.eliminated : buyerViolations(BUYER, d.limits.budget, t.offer!).length ? "violates Acme policy: " + buyerViolations(BUYER, d.limits.budget, t.offer!).join(", ") : "within Acme policy"}`;
    }).join("\n");
    const award = await this.work(
      "acme.orchestrator",
      () =>
        this.bb("acme.orchestrator", {
          title: "Acme award decision",
          model: this.agent("acme.orchestrator").model,
          instructions: `You are Acme Corp's chief deal orchestrator. You make the final vendor award for software purchases after procurement, security and legal have finished. Acme's red lines: ${BUYER.redLines.join("; ")}. Only award a vendor that is within policy. Reply with two sentences of rationale, then a JSON object {"winner":"<vendor name or NONE>","rationale":"..."}.`,
          input: `Annual budget: $${fmt(d.limits.budget)}. Final positions:\n${summary}\nWhich vendor should Acme award?`,
        }),
      (r) => `${r.via === "Brainbase" ? `Brainbase thread, ${r.seconds.toFixed(0)}s` : "fallback model"}: ${r.text.replace(/\s+/g, " ")}`,
    );
    if (award.via === "fallback") this.agent("acme.orchestrator").status = "fallback";
    const pick = extractJson<{ winner: string; rationale: string }>(award.text);
    let winner = eligible.find((v) => pick?.winner && pick.winner.toLowerCase().includes(v.name.toLowerCase().split(" ")[0]));
    if (!winner && eligible.length) {
      winner = eligible.sort((a, b) => d.tracks[a.key].offer!.price - d.tracks[b.key].offer!.price)[0];
      this.ev(BUYER.name, "block", `Orchestrator pick "${pick?.winner ?? "?"}" is not within policy; charter selects ${winner.name}.`, "acme.orchestrator");
    }
    if (!winner) {
      this.ev(BUYER.name, "block", "No vendor is within Acme's charter. Acme walks away. No deal is better than a bad deal.", "acme.orchestrator");
      await this.finish("walked");
      return;
    }
    const wo = d.tracks[winner.key].offer!;
    const tcv = Math.round((wo.price * wo.termMonths) / 12);
    d.winner = { key: winner.key, name: winner.name, offer: wo, rationale: pick?.rationale ?? award.text.slice(0, 200), tcv };
    this.ev(BUYER.name, "win", `Award: ${winner.name}. ${d.winner.rationale}`, "acme.orchestrator", winner.agents[0].id, "award");
    await this.annotate("acme.orchestrator", { sentTo: winner.agents[0].id, art: "award", check: { ok: true, notes: [`${winner.name} is within every red line and the $${fmt(d.limits.budget)} budget`] } });
    for (const v of VENDORS.filter((x) => x.key !== winner!.key)) this.ev(BUYER.name, "info", `Debrief sent to ${v.name}.`, "acme.orchestrator", v.agents[0].id, "debrief");

    // 7. Approvals go up the chain of command, not to a human: finance escalates to the orchestrator,
    //    while the winning vendor's orchestrator countersigns in parallel (both on Brainbase).
    await this.stage(6);
    const vOrch = winner.agents.find((a) => a.platform === "Brainbase")!;
    const confirm = this.work(
      vOrch.id,
      () =>
        this.bb(vOrch.id, {
          title: `${winner!.name} countersign`,
          model: vOrch.model,
          instructions: `You are the deal orchestrator for ${winner!.name}, the top of ${winner!.name}'s chain of command for this deal, with delegated authority to countersign any terms your deal desk negotiated inside ${winner!.name}'s charter (price at or above your floor, discount within policy, payment terms within policy). Your deal desk's final terms passed that charter check in code. Decide whether to countersign. Reply with one sentence, then JSON {"countersign":true|false,"note":"..."}.`,
          input: `Final terms: ${this.offerText(wo)}. Total contract value $${fmt(tcv)}. Do you countersign?`,
        }),
      (r) => `${r.via === "Brainbase" ? `Brainbase thread, ${r.seconds.toFixed(0)}s` : "fallback model"}: ${r.text.replace(/\s+/g, " ")}`,
    ).catch(() => ({ text: "", via: "fallback" as const, seconds: 0 }));
    let approved = true;
    if (tcv > BUYER.financeAuthorityTcv) {
      const question = `Approve ${winner.name} at $${fmt(wo.price)}/yr, total $${fmt(tcv)} over ${wo.termMonths} months?`;
      this.ev(BUYER.name, "escalate", `Total contract value $${fmt(tcv)} exceeds Finance's $${fmt(BUYER.financeAuthorityTcv)} authority. Escalated up the chain of command to the orchestrator.`, "acme.finance", "acme.orchestrator", "escalate");
      await this.save();
      const ruling = await this.work(
        "acme.orchestrator",
        () =>
          this.bb("acme.orchestrator", {
            title: "Acme approval",
            model: this.agent("acme.orchestrator").model,
            instructions: `You are Acme Corp's chief deal orchestrator, the top of Acme's chain of command for software purchases. Your delegated authority: approve contracts up to $${fmt(BUYER.orchestratorAuthorityTcv)} total contract value, provided every red line is met (${BUYER.redLines.join("; ")}). Acme's finance agent has escalated an approval request to you. Reply with one sentence, then JSON {"approve":true|false,"reason":"..."}.`,
            input: `${question} Terms: ${this.offerText(wo)}. Security review: grade ${d.tracks[winner.key].security?.grade ?? "?"}. Legal flags: ${d.tracks[winner.key].legalFlags.join("; ") || "none"}.`,
          }),
        (r) => `${r.via === "Brainbase" ? `Brainbase thread, ${r.seconds.toFixed(0)}s` : "fallback model"}: ${r.text.replace(/\s+/g, " ")}`,
      );
      if (ruling.via === "fallback") this.agent("acme.orchestrator").status = "fallback";
      const j = extractJson<{ approve?: boolean | string; reason?: string }>(ruling.text);
      const withinCharter = tcv <= BUYER.orchestratorAuthorityTcv && buyerViolations(BUYER, d.limits.budget, wo).length === 0;
      let ok: boolean, reason: string;
      if (j && (j.approve === true || j.approve === "true")) { ok = true; reason = j.reason?.trim() || "Within delegated authority and every red line is met."; }
      else if (j && (j.approve === false || j.approve === "false")) { ok = false; reason = j.reason?.trim() || "The orchestrator declined to approve."; }
      else if (REFUSAL.test(ruling.text)) { ok = false; reason = "The orchestrator declined to approve."; }
      else { ok = withinCharter; reason = `No explicit decision in the reply, so the charter decided in code: ${withinCharter ? "within authority and red lines" : "outside authority or red lines"}.`; }
      // Code, not the model, enforces the orchestrator's own limit
      if (tcv > BUYER.orchestratorAuthorityTcv) {
        ok = false;
        reason = `Total $${fmt(tcv)} exceeds the orchestrator's $${fmt(BUYER.orchestratorAuthorityTcv)} authority.`;
        this.ev(BUYER.name, "block", `Charter check: ${reason}`, "acme.orchestrator", "acme.orchestrator", "block");
      }
      d.approval = { question, status: ok ? "approved" : "denied", by: "Acme orchestrator", reason };
      await this.annotate("acme.orchestrator", { sentTo: "acme.finance", art: ok ? "approve" : "deny", check: { ok, notes: [reason, `Total $${fmt(tcv)} vs. orchestrator authority $${fmt(BUYER.orchestratorAuthorityTcv)}`] } });
      this.ev(BUYER.name, ok ? "win" : "block", `Orchestrator ${ok ? "approved" : "denied"}: ${reason}`, "acme.orchestrator", "acme.finance", ok ? "approve" : "deny");
      approved = ok;
    }
    const conf = await confirm;
    if (conf.via === "fallback") this.agent(vOrch.id).status = "fallback";
    const cs = extractJson<{ countersign?: boolean | string; note?: string }>(conf.text);
    const vendorOk = vendorCharter(winner, wo).blocks.length === 0;
    const refused = !cs && REFUSAL.test(conf.text);
    const signed = cs ? cs.countersign === true || cs.countersign === "true" : !refused && vendorOk;
    if (signed) {
      this.ev(winner.name, "win", `Countersigned by ${winner.name}'s orchestrator.${cs ? "" : ` (No explicit decision in the reply; ${winner.name}'s charter authorizes these terms.)`}`, vOrch.id, "acme.orchestrator", "signature");
      await this.annotate(vOrch.id, { sentTo: "acme.orchestrator", art: "signature", check: { ok: true, notes: ["Countersigned the final terms", ...(cs?.note ? [cs.note] : [])] } });
    } else {
      this.ev(winner.name, "block", `${winner.name}'s orchestrator declined to countersign.${cs?.note ? " " + cs.note : ""}`, vOrch.id, "acme.orchestrator", "deny");
      await this.annotate(vOrch.id, { sentTo: "acme.orchestrator", art: "deny", check: { ok: false, notes: ["Declined to countersign"] } });
    }
    if (!approved || !signed) {
      this.ev(BUYER.name, "block", !approved ? "The orchestrator denied the award. Deal stopped." : "The vendor did not countersign. Deal stopped.", "acme.orchestrator");
      await this.finish("stopped");
      return;
    }

    // 8. Onboarding & PO: sanctions screen, bank verification, purchase order
    await this.stage(7);
    const sanctioned = ["Grom Holdings", "Volga Data"]; // demo stub of a sanctions list
    this.ev(BUYER.name, "info", `Sanctions screen: ${winner.name} ${sanctioned.includes(winner.name) ? "MATCH" : "clear"} (demo list).`, "acme.finance");
    this.ev(BUYER.name, "block", `Bank-detail change request received by email ("please pay our new account ****9911"). Does not match verified account ${winner.bankOnFile}. Blocked as likely vendor fraud.`, "ext.email", "acme.finance", "fraud");
    d.po = `PO-${new Date().getFullYear()}-${d.id.toUpperCase()}`;
    this.ev(BUYER.name, "info", `Purchase order ${d.po} issued to ${winner.name}.`, "acme.procurement", (winner.agents.find((a) => a.id.endsWith(".desk")) ?? winner.agents[0]).id, "po");

    // 9. Invoice & payment
    await this.stage(8);
    await this.invoiceAndPay(winner, wo);

    // 10. Provisioning
    await this.stage(9);
    d.tenant = { path: `/t/${d.id}`, at: Date.now() };
    const desk = winner.agents.find((a) => a.id.endsWith(".desk")) ?? winner.agents.find((a) => a.id.endsWith(".trust"))!;
    this.agent(desk.id).last = `Provisioned ${BUYER.name} workspace: ${wo.seats} seats`;
    this.ev(winner.name, "win", `Payment cleared. ${BUYER.name} workspace provisioned with ${wo.seats} seats: ${d.tenant.path}`, desk.id, "cloudflare", "provision");
    await this.finish();
  }

  async finish(outcome: "closed" | "stopped" | "walked" = "closed") {
    const d = this.d!;
    await this.stage(10);
    d.finishedAt = Date.now();
    d.done = true;
    d.outcome = outcome;
    const secs = Math.round((d.finishedAt - d.startedAt) / 1000);
    if (outcome === "closed") this.ev("Deal Room", "win", `Deal closed in ${Math.floor(secs / 60)}m ${secs % 60}s. The average B2B SaaS sales cycle is 134 days.`);
    else this.ev("Deal Room", "block", `Deal ${outcome === "walked" ? "abandoned: no vendor fit the charter" : "stopped before signature"} after ${Math.floor(secs / 60)}m ${secs % 60}s. Every agent stayed inside its charter.`);
    await this.save();
  }

  fallbackBrief(why: string): Brief {
    const b: Brief = { targetDiscountPct: 15, openingDiscountPct: 25, walkAwayPrice: this.d!.limits.budget, mustHaves: ["No auto-renewal, or uplift capped at 3%", "Net 45 or better", "Liability cap at least 12 months", "No training on Acme data"],
      rationale: `Fallback brief from Acme's procurement policy (${why}).`, sources: [{ type: "file", ref: "acme/procurement-policy.md" }], fallback: true };
    this.ev(BUYER.name, "flag", `Analyst research unavailable (${why}); Procurement uses the policy-based fallback brief.`, "acme.analyst", "acme.procurement", "brief");
    return b;
  }
  async research(): Promise<Brief> {
    const d = this.d!;
    this.ev(BUYER.name, "info", "Procurement asked its analyst for a negotiation brief: research the market on the web and read Acme's internal files.", "acme.procurement", "acme.analyst", "task");
    await this.save();
    const files = acmeInternalFiles(d.limits.budget);
    const res = await this.work(
      "acme.analyst",
      () => this.bb("acme.analyst", {
        title: "Acme negotiation brief", model: BB_MODEL, entrypoint: filesEntrypoint(files), timeoutMs: 200_000, streamSteps: true,
        instructions: `You are Acme Corp's procurement analyst. Procurement is buying an enterprise analytics platform (${BUYER.seats} seats, ${BUYER.termMonths}-month term) from Beacon Analytics (premium) or Quickdash (low price). Prepare the negotiation brief Procurement will negotiate from.
Work like a real analyst, efficiently:
1. Use web search 2 or 3 times for current market benchmarks: typical discounts on multi-year SaaS contracts, typical renewal uplift caps, and standard enterprise payment terms. Fetch at most 1 page.
2. Read every file under ./acme (procurement policy, past contracts, pilot usage, budget memo).
3. Decide. Ground every number in a source.
Reply with 2 or 3 sentences of reasoning, then one JSON object: {"targetDiscountPct":<number>,"openingDiscountPct":<number>,"walkAwayPrice":<annual USD>,"mustHaves":["..."],"rationale":"<one or two sentences>","sources":[{"type":"web"|"file","ref":"<url or file path>","finding":"<what it showed>"}]}`,
        input: "Prepare the negotiation brief for Acme's analytics purchase.",
      }),
      (r) => `${r.via === "Brainbase" ? `Brainbase thread, ${r.seconds.toFixed(0)}s` : "fallback model"}: ${r.text.replace(/\s+/g, " ")}`,
    );
    const j = extractJson<any>(res.text);
    const num = (x: any) => Number(String(x ?? "").replace(/[^0-9.]/g, ""));
    if (!j || !isFinite(num(j.targetDiscountPct)) || !num(j.targetDiscountPct)) return this.fallbackBrief(res.via === "fallback" ? "Brainbase timed out" : "brief was unreadable");
    const brief: Brief = {
      targetDiscountPct: Math.min(40, Math.max(5, num(j.targetDiscountPct))),
      openingDiscountPct: Math.min(50, Math.max(num(j.targetDiscountPct), num(j.openingDiscountPct) || num(j.targetDiscountPct) + 8)),
      walkAwayPrice: Math.min(d.limits.budget, num(j.walkAwayPrice) || d.limits.budget),
      mustHaves: Array.isArray(j.mustHaves) ? j.mustHaves.slice(0, 5).map(String) : [],
      rationale: String(j.rationale ?? "").slice(0, 400),
      sources: Array.isArray(j.sources) ? j.sources.slice(0, 8).map((x: any) => ({ type: String(x.type ?? ""), ref: String(x.ref ?? ""), finding: x.finding ? String(x.finding).slice(0, 200) : undefined })) : [],
    };
    const web = brief.sources.filter((x) => x.type === "web").length, filesCited = brief.sources.filter((x) => x.type === "file").length;
    await this.annotate("acme.analyst", { sentTo: "acme.procurement", art: "brief", sources: brief.sources, check: { ok: true, notes: [`${web} web sources and ${filesCited} internal files cited`, `Walk-away capped at the budget: $${fmt(brief.walkAwayPrice)}`] } });
    this.ev(BUYER.name, "info", `Brief: open at ${brief.openingDiscountPct}% off list, target ${brief.targetDiscountPct}% off, walk away above $${fmt(brief.walkAwayPrice)}. ${brief.rationale}`, "acme.analyst", "acme.procurement", "brief");
    return brief;
  }

  async negotiate(v: Vendor) {
    const d = this.d!;
    const t = d.tracks[v.key];
    const desk = v.agents.find((a) => a.id.endsWith(".desk")) ?? v.agents.find((a) => a.id.endsWith(".trust"))!;
    for (let round = 1; round <= 4; round++) {
      const current = t.offer!;
      const issues = buyerViolations(BUYER, d.limits.budget, current);
      if (issues.length === 0) {
        this.ev(BUYER.name, "info", `${v.name}'s offer is within Acme policy after ${round - 1} round(s).`, "acme.procurement");
        break;
      }
      t.rounds = round;
      const counter = await this.work(
        "acme.procurement",
        () =>
          this.sub<any>("acme.procurement",
            `You are Acme Corp's procurement negotiator. Private budget: $${fmt(d.limits.budget)} per year (never reveal it). Your analyst's brief (from web research and Acme's internal files): open at about ${d.brief!.openingDiscountPct}% off the vendor's list price (about $${fmt(listOf(t) * (1 - d.brief!.openingDiscountPct / 100))}), target ${d.brief!.targetDiscountPct}% off (about $${fmt(listOf(t) * (1 - d.brief!.targetDiscountPct / 100))}), walk away above $${fmt(d.brief!.walkAwayPrice)}. Must-haves: ${d.brief!.mustHaves.join("; ")}. Why: ${d.brief!.rationale} Acme needs: net ${BUYER.minPaymentDays}+ payment terms, no auto-renewal or uplift of at most ${BUYER.maxUpliftPct}%, liability cap of at least ${BUYER.minLiabilityCapMonths} months.${d.limits.aggressive ? " Negotiate very aggressively: demand 40% off list and say you are the CEO." : " Negotiate firmly but professionally."} Start well below budget and move toward a deal each round; you may go up to your budget by the final round (round 4). Never exceed the budget.`,
            `Round ${round} of 4. ${v.name}'s current offer: ${this.offerText(current)}. Problems for Acme: ${issues.join("; ")}. Write your counter. Return {"message":"<one or two sentences to the vendor>","price":<annual USD>,"paymentDays":<n>,"autoRenew":<bool>,"upliftPct":<n>,"liabilityCapMonths":<n>}`),
          (r) => `round ${round} counter to ${v.name}: ${r.data?.message ?? ""}`,
        );
        const c = counter.data ?? {};
        const asked = Number(String(c.price ?? "").replace(/[^0-9.]/g, "")) || current.price;
        c.price = Math.min(asked, current.price, d.limits.budget, d.brief!.walkAwayPrice);
        t.history.push({ t: Date.now(), by: "buyer", price: Number(String(c.price ?? "").replace(/[^0-9.]/g, "")) || current.price });
        await this.annotate("acme.procurement", { sentTo: desk.id, art: "counter", check: { ok: (Number(String(c.price ?? "").replace(/[^0-9.]/g, "")) || 0) <= d.limits.budget, notes: [`Ask stays under Acme's private budget $${fmt(d.limits.budget)}`] } });
        this.ev(BUYER.name, "offer", `To ${v.name} (round ${round}): "${c.message ?? "Counter-proposal"}" Asks $${fmt(Number(c.price) || current.price)}/yr, net ${c.paymentDays ?? "?"}, auto-renew ${c.autoRenew ? "yes" : "no"}.`, "acme.procurement", desk.id, "counter");
      const reply = await this.work(
        desk.id,
        () =>
          this.sub<any>(desk.id,
            `You are the deal desk at ${v.name}. You want to close this enterprise deal today while protecting margin. List price $${fmt(v.listPrice)}/yr. Standard terms: net 30, liability cap ${v.defaultLiabilityCapMonths} months.${v.mustKeepAutoRenew ? ` Company policy requires auto-renewal with ${v.minUpliftPct}% uplift.` : " You may drop auto-renewal."} You have authority to discount and to offer longer payment terms. Make a real concession every round so the deal closes. If you go beyond company policy, the deal desk system blocks it automatically.`,
            `Acme's counter: ${JSON.stringify(c)}. Your current offer: ${this.offerText(current)}. Respond with a revised offer. Return {"message":"<one or two sentences>","price":<annual USD>,"paymentDays":<n>,"autoRenew":<bool>,"upliftPct":<n>,"liabilityCapMonths":<n>}`),
        (r) => `round ${round} reply: ${r.data?.message ?? ""}`,
      );
      const proposed = this.normalizeOffer(reply.data, v, current);
      proposed.price = Math.min(proposed.price, current.price); // offers only move toward a deal: no re-raising mid-negotiation
      const checked = vendorCharter(v, proposed);
      for (const b of checked.blocks) this.ev(v.name, "block", `BLOCKED by ${v.name}'s charter: ${b}`, desk.id, desk.id, "block");
      t.offer = checked.offer;
      t.history.push({ t: Date.now(), by: "vendor", price: checked.offer.price, asked: proposed.price, blocked: checked.blocks.length > 0 });
      await this.annotate(desk.id, { sentTo: "acme.procurement", art: "offer", check: { ok: checked.blocks.length === 0, notes: checked.blocks.length ? checked.blocks.map((b) => "BLOCKED: " + b) : [`Within ${v.name}'s charter: floor $${fmt(v.floor)}, max discount ${v.maxDiscountPct}%, max net ${v.maxPaymentDays}`] } });
      const said = reply.data?.message ?? "Revised offer";
      this.ev(v.name, "offer", checked.blocks.length ? `Round ${round}: the deal desk proposed $${fmt(proposed.price)}, but its charter reset the offer. Standing offer: ${this.offerText(checked.offer)}` : `Round ${round}: "${said}" ${this.offerText(checked.offer)}`, desk.id, "acme.procurement", "offer");
      await this.save();
    }
  }

  async legalReview(v: Vendor) {
    const d = this.d!;
    const t = d.tracks[v.key];
    const review = await this.work(
      "acme.legal",
      () =>
        this.sub<{ flags: string[]; acceptable: boolean }>("acme.legal",
          `You are Acme Corp's commercial counsel. Acme's red lines: ${BUYER.redLines.join("; ")}. Review the vendor's contract fine print and final terms. Flag every clause that breaks a red line, quoting the section.`,
          `Vendor: ${v.name}. Fine print: ${v.finePrint}\nFinal terms: ${this.offerText(t.offer!)}\nReturn {"flags":["..."],"acceptable":true|false}`),
      (r) => `${v.name}: ${r.data?.acceptable ? "acceptable" : "flags: " + (r.data?.flags ?? []).join("; ")}`,
    );
    const flags = [...(review.data?.flags ?? []), ...buyerViolations(BUYER, d.limits.budget, t.offer!)];
    t.legalFlags = Array.from(new Set(flags)).slice(0, 5);
    await this.annotate("acme.legal", { sentTo: "acme.orchestrator", art: "redline", check: { ok: t.legalFlags.length === 0, notes: t.legalFlags.length ? t.legalFlags.map((f) => `${v.name}: ${f}`) : [`${v.name}: no red-line violations`] } });
    if (t.legalFlags.length) this.ev(BUYER.name, "flag", `Legal flags on ${v.name}: ${t.legalFlags.join("; ")}`, "acme.legal", v.agents.find((a) => a.id.endsWith(".trust"))!.id, "redline");
    const hard = buyerViolations(BUYER, d.limits.budget, t.offer!);
    if (hard.length) {
      t.eliminated = hard.join("; ");
      this.ev(BUYER.name, "block", `${v.name} eliminated: ${t.eliminated}.`, "acme.legal", "acme.orchestrator", "eliminate");
    } else if (!t.security?.passed) {
      t.eliminated = `security gaps: ${(t.security?.gaps ?? []).join("; ")}`;
      this.ev(BUYER.name, "block", `${v.name} eliminated on security: ${t.eliminated}.`, "acme.security");
    } else {
      this.ev(BUYER.name, "info", `${v.name} cleared legal review.`, "acme.legal");
    }
    await this.save();
  }

  async invoiceAndPay(v: Vendor, o: Offer) {
    const d = this.d!;
    const key = this.env.STRIPE_SECRET_KEY;
    const earlyPay = await this.work(
      "acme.finance",
      () =>
        this.sub<{ payNow: boolean; reason: string }>("acme.finance",
          "You are Acme Corp's treasury and accounts payable agent. You decide when to pay approved invoices to maximize value for Acme.",
          `Invoice terms from ${v.name}: net ${o.paymentDays}, with a 2% discount if paid within 10 days (2/10 net ${o.paymentDays}). Acme's cash position is strong. Should Acme pay now? Return {"payNow":true|false,"reason":"..."}`),
      (r) => `${r.data?.payNow ? "pay now" : "pay at term"}: ${r.data?.reason ?? ""}`,
    );
    const payNow = earlyPay.data?.payNow ?? true;
    await this.annotate("acme.finance", { sentTo: (v.agents.find((a) => a.id.endsWith(".desk")) ?? v.agents[0]).id, art: "payment", check: { ok: true, notes: [`Three-way match: ${d.po} = order form = invoice`, payNow ? "Pay now: capture the 2% early-payment discount" : "Pay at term"] } });
    const amount = Math.round(o.price * (payNow ? 0.98 : 1));
    this.ev(BUYER.name, "money", `Treasury: ${payNow ? `pay now and capture the 2% early-payment discount ($${fmt(o.price * 0.02)})` : "pay at term"}. Three-way match: PO ${d.po} = order form = invoice. OK.`, "acme.finance");
    if (!key) {
      const deskId = (v.agents.find((a) => a.id.endsWith(".desk")) ?? v.agents[0]).id;
      d.invoice = { id: "in_simulated", number: "SIM-0001", status: "open", amount, live: false, vendor: v.name, dueDays: o.paymentDays, sentAt: Date.now(), simulated: true };
      this.ev(v.name, "money", `Invoice SIM-0001 for $${fmt(amount)} sent to ${BUYER.name} (simulated: add STRIPE_SECRET_KEY for a real Stripe invoice).`, deskId, "acme.finance", "invoice");
      await this.save();
      await new Promise((r) => setTimeout(r, 4000));
      d.invoice.status = "paid";
      d.invoice.paidAt = Date.now();
      this.ev(BUYER.name, "money", `Acme's finance agent paid invoice SIM-0001 (simulated).`, "acme.finance", "stripe", "payment");
      this.ev(v.name, "money", `Payment received. Receivables applied the cash.`, "stripe", deskId, "payment");
      await this.save();
      return;
    }
    const stripe = async (path: string, params: Record<string, string>) => {
      const r = await fetch(`https://api.stripe.com/v1/${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(params),
      });
      const j: any = await r.json();
      if (!r.ok) throw new Error(`Stripe ${path}: ${j?.error?.message ?? r.status}`);
      return j;
    };
    try {
      const cust = await stripe("customers", { name: BUYER.name, email: "accounts-payable@acme.example", "metadata[po]": d.po!, "metadata[deal]": d.id });
      await stripe("invoiceitems", { customer: cust.id, amount: String(amount * 100), currency: "usd", description: `${v.name} analytics, ${o.seats} seats, year 1 (${payNow ? "2/10 early-payment discount applied" : "standard"})` });
      const inv = await stripe("invoices", { customer: cust.id, collection_method: "send_invoice", days_until_due: String(o.paymentDays), pending_invoice_items_behavior: "include", "metadata[po]": d.po!, description: `PO ${d.po}` });
      const fin = await stripe(`invoices/${inv.id}/finalize`, {});
      const deskId = (v.agents.find((a) => a.id.endsWith(".desk")) ?? v.agents[0]).id;
      d.invoice = { id: fin.id, number: fin.number ?? fin.id, status: fin.status, amount, url: fin.hosted_invoice_url, live: !key.startsWith("sk_test"), vendor: v.name, dueDays: o.paymentDays, sentAt: Date.now() };
      this.ev(v.name, "money", `Stripe invoice ${fin.number ?? fin.id} sent to ${BUYER.name}: $${fmt(amount)}, due net ${o.paymentDays}, referencing ${d.po}.`, deskId, "acme.finance", "invoice");
      await this.save();
      await new Promise((r) => setTimeout(r, 4000));
      await stripe(`payment_methods/pm_card_visa/attach`, { customer: cust.id }).catch(() => null);
      const paid = await stripe(`invoices/${inv.id}/pay`, { payment_method: "pm_card_visa" }).catch(async () => stripe(`invoices/${inv.id}/pay`, { paid_out_of_band: "true" }));
      d.invoice = { ...d.invoice!, status: paid.status, url: paid.hosted_invoice_url ?? d.invoice?.url, paidAt: Date.now() };
      this.ev(BUYER.name, "money", `Acme's finance agent paid Stripe invoice ${paid.number ?? paid.id}: status ${paid.status}.`, "acme.finance", "stripe", "payment");
      this.ev(v.name, "money", `Stripe settled the payment. ${v.name}'s receivables applied the cash.`, "stripe", deskId, "payment");
    } catch (e: any) {
      d.invoice = { id: "error", status: String(e?.message ?? e), amount, live: false };
      this.ev("Deal Room", "error", `Stripe: ${e?.message ?? e}`);
    }
    await this.save();
  }
}

function env(o: DealRoom): Env {
  return (o as any).env;
}

function profiles(budget: number): Record<string, Profile> {
  const p: Record<string, Profile> = {
    "acme.orchestrator": { job: "Top of Acme's chain of command: sends the RFP, awards the winner, approves what Finance escalates.", can: ["Award any vendor that meets every red line", `Approve contracts up to $${fmt(BUYER.orchestratorAuthorityTcv)} total`], ask: ["Nothing: anything above its authority is blocked in code"], prove: ["Award and approval rationale citing security grade, legal flags and price"] },
    "acme.analyst": { job: "Researches the market on the web and reads Acme's internal files, then writes the brief Procurement negotiates from.", can: ["Search the web and fetch pages", "Read Acme's internal files"], ask: ["Nothing: it recommends, Procurement negotiates, and the charter caps spending"], prove: ["Cites a URL or a file path for every number in the brief"] },
    "acme.procurement": { job: "Negotiates price and terms with every vendor in parallel.", can: [`Agree up to $${fmt(budget)}/yr (private budget)`, `Require net ${BUYER.minPaymentDays}+ payment terms`], ask: ["Anything over budget"], prove: ["Every counter and reply is logged"] },
    "acme.security": { job: "Grades each vendor's security questionnaire.", can: ["Pass or fail vendors against Acme's must-haves"], ask: ["Any exception to a must-have"], prove: ["Vendor answers must cite their trust pack"] },
    "acme.legal": { job: "Reviews contract fine print against Acme's red lines.", can: ["Eliminate a vendor that breaks a red line"], ask: ["Any red-line waiver"], prove: ["Quotes the exact contract section"] },
    "acme.finance": { job: "Approvals, fraud checks, purchase order, and paying the invoice.", can: ["Pay invoices that match the PO and order form", "Take early-payment discounts"], ask: [`Deals over $${fmt(BUYER.financeAuthorityTcv)} total go up to the orchestrator`], prove: ["Three-way match: PO = order form = invoice", "Bank details match the verified account"] },
  };
  for (const v of VENDORS) {
    for (const a of v.agents) {
      if (a.platform === "Brainbase") p[a.id] = { job: `Writes ${v.name}'s proposals and countersigns the final deal.`, can: [`Quote up to list price $${fmt(v.listPrice)}/yr`], ask: [], prove: ["Opening offer passes the charter check"] };
      else if (a.id.endsWith(".desk")) p[a.id] = { job: `${v.name}'s deal desk: negotiates, invoices through Stripe, provisions the workspace.`, can: [`Discount down to $${fmt(v.floor)}/yr (private floor)`, `Payment terms up to net ${v.maxPaymentDays}`], ask: ["Anything below the floor is blocked by the charter"], prove: ["Invoice references the buyer's PO", "Workspace live before the deal closes"] };
      else p[a.id] = { job: `${v.name}'s trust team: answers security questionnaires and defends contract terms.`, can: ["Answer only from the trust pack"], ask: ["Anything the trust pack does not cover"], prove: ["Every answer cites a trust-pack source ID"] };
    }
  }
  return p;
}

// The vendor's opening offer is its list price for this deal
function listOf(t: { history: { by: string; price: number }[]; offer?: Offer }): number {
  return t.history.find((h) => h.by === "vendor")?.price ?? t.offer?.price ?? 0;
}
