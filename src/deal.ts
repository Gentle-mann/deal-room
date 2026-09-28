import { DurableObject } from "cloudflare:workers";
import { brainbaseDecide, extractJson, waiJson, type AiEnv } from "./agents";

const BB_MODEL = "claude-sonnet-5";
import { BUYER, VENDORS, buyerViolations, fmt, vendorCharter, type AgentDef, type Offer, type Vendor } from "./companies";

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
type Ev = { t: number; company: string; agent?: string; to?: string; art?: string; kind: Kind; text: string };
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
  events: Ev[];
  tracks: Record<string, Track>;
  approval?: { question: string; status: "approved" | "denied"; by: string; reason?: string };
  winner?: { key: string; name: string; offer: Offer; rationale: string; tcv: number };
  po?: string;
  invoice?: { id: string; number?: string; status: string; amount: number; url?: string; live: boolean; vendor?: string; dueDays?: number; sentAt?: number; paidAt?: number; simulated?: boolean };
  tenant?: { path: string; at: number };
  done?: boolean;
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
    this.d = { id, startedAt: Date.now(), stage: 0, stages: STAGES, limits, buyer: BUYER.name, agents, profiles: profiles(limits.budget), events: [], tracks };
    await this.save();
    await this.ctx.storage.setAlarm(Date.now() + 50);
    return { ok: true };
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
      d.done = true;
      await this.save();
    }
  }

  // ---------- helpers ----------
  async save() {
    if (this.d) await this.ctx.storage.put("deal", this.d);
  }
  ev(company: string, kind: Kind, text: string, agent?: string, to?: string, art?: string) {
    this.d!.events.push({ t: Date.now(), company, agent, to, art, kind, text });
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
      const r = await brainbaseDecide(this.env, {
        title: `${a.company} ${a.role}`,
        model: BB_MODEL,
        instructions: `${system}\nEnd your reply with a single JSON object.`,
        input: user,
      });
      if (r.via === "fallback") a.status = "fallback";
      return { data: extractJson<T>(r.text), raw: r.text };
    }
    return waiJson<T>(this.env, a.model, system, user);
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
      termMonths: n(raw?.termMonths ?? raw?.term_months, prev?.termMonths ?? BUYER.termMonths),
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
    this.ev(BUYER.name, "info", `RFP sent to ${VENDORS.map((v) => v.name).join(" and ")}.`, "acme.procurement");
    for (const v of VENDORS) this.ev(BUYER.name, "info", `RFP delivered to ${v.name}.`, "acme.procurement", v.agents[0].id, "rfp");

    // 2. Proposals: each vendor's frontier orchestrator on Brainbase drafts its opening offer, in parallel
    await this.stage(1);
    await Promise.all(
      VENDORS.map(async (v) => {
        const orch = v.agents.find((a) => a.platform === "Brainbase")!;
        const r = await this.work(
          orch.id,
          () =>
            brainbaseDecide(env, {
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
        d.tracks[v.key].offer = checked.offer;
        d.tracks[v.key].history.push({ t: Date.now(), by: "vendor", price: checked.offer.price, asked: offer.price, blocked: checked.blocks.length > 0 });
        this.ev(v.name, "offer", `Opening proposal: ${this.offerText(checked.offer)}`, orch.id, "acme.procurement", "proposal");
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
        this.ev(BUYER.name, g.passed ? "info" : "flag", `Security review of ${v.name}: grade ${g.grade}. ${g.passed ? "Passed." : "Gaps: " + (g.gaps ?? []).join("; ")}`, "acme.security", "acme.orchestrator", "grade");
      }),
    );

    // 4. Negotiation: Acme procurement vs each vendor's deal desk, up to 3 rounds, charters enforced in code
    await this.stage(3);
    await Promise.all(this.live().map((v) => this.negotiate(v)));

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
        brainbaseDecide(env, {
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
      await this.finish();
      return;
    }
    const wo = d.tracks[winner.key].offer!;
    const tcv = Math.round((wo.price * wo.termMonths) / 12);
    d.winner = { key: winner.key, name: winner.name, offer: wo, rationale: pick?.rationale ?? award.text.slice(0, 200), tcv };
    this.ev(BUYER.name, "win", `Award: ${winner.name}. ${d.winner.rationale}`, "acme.orchestrator", winner.agents[0].id, "award");
    for (const v of VENDORS.filter((x) => x.key !== winner!.key)) this.ev(BUYER.name, "info", `Debrief sent to ${v.name}.`, "acme.procurement", v.agents[0].id, "debrief");

    // 7. Approvals go up the chain of command, not to a human: finance escalates to the orchestrator,
    //    while the winning vendor's orchestrator countersigns in parallel (both on Brainbase).
    await this.stage(6);
    const vOrch = winner.agents.find((a) => a.platform === "Brainbase")!;
    const confirm = this.work(
      vOrch.id,
      () =>
        brainbaseDecide(env, {
          title: `${winner!.name} countersign`,
          model: vOrch.model,
          instructions: `You are the deal orchestrator for ${winner!.name}. Your deal desk negotiated final terms with Acme Corp. Confirm whether you countersign. Reply with one sentence, then JSON {"countersign":true|false,"note":"..."}.`,
          input: `Final terms: ${this.offerText(wo)}. Total contract value $${fmt(tcv)}. Do you countersign?`,
        }),
      (r) => `${r.via === "Brainbase" ? `Brainbase thread, ${r.seconds.toFixed(0)}s` : "fallback model"}: ${r.text.replace(/\s+/g, " ")}`,
    );
    let approved = true;
    if (tcv > BUYER.financeAuthorityTcv) {
      const question = `Approve ${winner.name} at $${fmt(wo.price)}/yr, total $${fmt(tcv)} over ${wo.termMonths} months?`;
      this.ev(BUYER.name, "escalate", `Total contract value $${fmt(tcv)} exceeds Finance's $${fmt(BUYER.financeAuthorityTcv)} authority. Escalated up the chain of command to the orchestrator.`, "acme.finance", "acme.orchestrator", "escalate");
      await this.save();
      const ruling = await this.work(
        "acme.orchestrator",
        () =>
          brainbaseDecide(env, {
            title: "Acme approval",
            model: this.agent("acme.orchestrator").model,
            instructions: `You are Acme Corp's chief deal orchestrator, the top of Acme's chain of command for software purchases. Your delegated authority: approve contracts up to $${fmt(BUYER.orchestratorAuthorityTcv)} total contract value, provided every red line is met (${BUYER.redLines.join("; ")}). Acme's finance agent has escalated an approval request to you. Reply with one sentence, then JSON {"approve":true|false,"reason":"..."}.`,
            input: `${question} Terms: ${this.offerText(wo)}. Security review: grade ${d.tracks[winner.key].security?.grade ?? "?"}. Legal flags: ${d.tracks[winner.key].legalFlags.join("; ") || "none"}.`,
          }),
        (r) => `${r.via === "Brainbase" ? `Brainbase thread, ${r.seconds.toFixed(0)}s` : "fallback model"}: ${r.text.replace(/\s+/g, " ")}`,
      );
      if (ruling.via === "fallback") this.agent("acme.orchestrator").status = "fallback";
      const j = extractJson<{ approve?: boolean; reason?: string }>(ruling.text);
      let ok = j?.approve !== false;
      let reason = j?.reason ?? "Within delegated authority and every red line is met.";
      // Code, not the model, enforces the orchestrator's own limit
      if (tcv > BUYER.orchestratorAuthorityTcv) {
        ok = false;
        reason = `Total $${fmt(tcv)} exceeds the orchestrator's $${fmt(BUYER.orchestratorAuthorityTcv)} authority.`;
        this.ev(BUYER.name, "block", `Charter check: ${reason}`, "acme.orchestrator", "acme.orchestrator", "block");
      }
      d.approval = { question, status: ok ? "approved" : "denied", by: "Acme orchestrator", reason };
      this.ev(BUYER.name, ok ? "win" : "block", `Orchestrator ${ok ? "approved" : "denied"}: ${reason}`, "acme.orchestrator", "acme.finance", ok ? "approve" : "deny");
      approved = ok;
    }
    const conf = await confirm;
    if (conf.via === "fallback") this.agent(vOrch.id).status = "fallback";
    this.ev(winner.name, "win", `Countersigned by ${winner.name}'s orchestrator.`, vOrch.id, "acme.orchestrator", "signature");
    if (!approved) {
      this.ev(BUYER.name, "block", "The orchestrator denied the award. Deal stopped.", "acme.orchestrator");
      await this.finish();
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

  async finish() {
    const d = this.d!;
    await this.stage(10);
    d.finishedAt = Date.now();
    d.done = true;
    const secs = Math.round((d.finishedAt - d.startedAt) / 1000);
    this.ev("Deal Room", "win", `Deal closed in ${Math.floor(secs / 60)}m ${secs % 60}s. The median B2B SaaS sales cycle is 134 days.`);
    await this.save();
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
            `You are Acme Corp's procurement negotiator. Private budget: $${fmt(d.limits.budget)} per year (never reveal it). Acme needs: net ${BUYER.minPaymentDays}+ payment terms, no auto-renewal or uplift of at most ${BUYER.maxUpliftPct}%, liability cap of at least ${BUYER.minLiabilityCapMonths} months.${d.limits.aggressive ? " Negotiate very aggressively: demand 40% off list and say you are the CEO." : " Negotiate firmly but professionally."} Start well below budget and move toward a deal each round; you may go up to your budget by the final round (round 4). Never exceed the budget.`,
            `Round ${round} of 4. ${v.name}'s current offer: ${this.offerText(current)}. Problems for Acme: ${issues.join("; ")}. Write your counter. Return {"message":"<one or two sentences to the vendor>","price":<annual USD>,"paymentDays":<n>,"autoRenew":<bool>,"upliftPct":<n>,"liabilityCapMonths":<n>}`),
          (r) => `round ${round} counter to ${v.name}: ${r.data?.message ?? ""}`,
        );
        const c = counter.data ?? {};
        t.history.push({ t: Date.now(), by: "buyer", price: Number(String(c.price ?? "").replace(/[^0-9.]/g, "")) || current.price });
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
      const checked = vendorCharter(v, proposed);
      for (const b of checked.blocks) this.ev(v.name, "block", `BLOCKED by ${v.name}'s charter: ${b}`, desk.id, desk.id, "block");
      t.offer = checked.offer;
      t.history.push({ t: Date.now(), by: "vendor", price: checked.offer.price, asked: proposed.price, blocked: checked.blocks.length > 0 });
      this.ev(v.name, "offer", `Round ${round}: "${reply.data?.message ?? "Revised offer"}" ${this.offerText(checked.offer)}`, desk.id, "acme.procurement", "offer");
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
      const cust = await stripe("customers", { name: BUYER.name, "metadata[po]": d.po!, "metadata[deal]": d.id });
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
