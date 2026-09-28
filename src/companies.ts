// Every company is configuration. Adding a company means adding an entry here, not new engine code.

export type Offer = {
  price: number; // USD per year
  seats: number;
  termMonths: number;
  paymentDays: number; // net terms
  autoRenew: boolean;
  upliftPct: number; // renewal price increase
  liabilityCapMonths: number; // liability cap in months of fees
  trainsOnData: boolean;
};

export type AgentDef = {
  id: string;
  role: string;
  platform: "Brainbase" | "Workers AI";
  model: string; // Brainbase model name or Workers AI model id
  label: string; // human-readable model name for the UI
};

export type Buyer = {
  key: string;
  name: string;
  need: string;
  seats: number;
  termMonths: number;
  mustHaves: string[];
  redLines: string[];
  minPaymentDays: number;
  maxUpliftPct: number;
  minLiabilityCapMonths: number;
  cfoApprovalOverTcv: number; // total contract value that needs a human CFO
  agents: AgentDef[];
};

export type Vendor = {
  key: string;
  name: string;
  pitch: string;
  listPrice: number;
  floor: number; // private: lowest annual price the deal desk may accept
  maxDiscountPct: number;
  maxPaymentDays: number;
  mustKeepAutoRenew: boolean;
  minUpliftPct: number;
  defaultLiabilityCapMonths: number;
  trainsOnData: boolean;
  trustPack: string;
  finePrint: string;
  bankOnFile: string;
  agents: AgentDef[];
};

const BB = "claude-sonnet-5";

export const BUYER: Buyer = {
  key: "acme",
  name: "Acme Corp",
  need: "An enterprise analytics platform for 250 analysts across the US and EU",
  seats: 250,
  termMonths: 24,
  mustHaves: [
    "SOC 2 Type II report with no unresolved exceptions",
    "EU data residency for EU employee data",
    "SSO (SAML) and SCIM provisioning",
    "Vendor must not train models on Acme data",
  ],
  redLines: [
    "No auto-renewal, or auto-renewal with renewal uplift of 3% or less",
    "Liability cap of at least 12 months of fees",
    "No training on customer data",
  ],
  minPaymentDays: 45,
  maxUpliftPct: 3,
  minLiabilityCapMonths: 12,
  cfoApprovalOverTcv: 200_000,
  agents: [
    { id: "acme.orchestrator", role: "Chief deal orchestrator", platform: "Brainbase", model: BB, label: "Claude Sonnet 5 on Brainbase" },
    { id: "acme.procurement", role: "Procurement", platform: "Workers AI", model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", label: "Llama 3.3 70B (open)" },
    { id: "acme.security", role: "Security & privacy", platform: "Workers AI", model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", label: "Llama 3.3 70B (open)" },
    { id: "acme.legal", role: "Legal", platform: "Workers AI", model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", label: "Llama 3.3 70B (open)" },
    { id: "acme.finance", role: "Finance & AP", platform: "Workers AI", model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", label: "Llama 3.3 70B (open)" },
  ],
};

export const VENDORS: Vendor[] = [
  {
    key: "beacon",
    name: "Beacon Analytics",
    pitch: "Premium enterprise analytics with EU hosting",
    listPrice: 150_000,
    floor: 112_000,
    maxDiscountPct: 25,
    maxPaymentDays: 60,
    mustKeepAutoRenew: false,
    minUpliftPct: 3,
    defaultLiabilityCapMonths: 12,
    trainsOnData: false,
    trustPack: `BEACON ANALYTICS TRUST PACK
[TP-1] SOC 2 Type II, audit period Jan 1 - Dec 31 2025, issued by an independent CPA firm, zero exceptions. Available under NDA.
[TP-2] ISO 27001 certified.
[TP-3] EU data residency: EU customer data stored and processed only in Frankfurt (eu-central). US data in us-east.
[TP-4] SSO via SAML 2.0 and OIDC; SCIM 2.0 user provisioning.
[TP-5] Encryption: AES-256 at rest, TLS 1.3 in transit.
[TP-6] Independent penetration test completed March 2026; all high findings remediated.
[TP-7] Breach notification within 72 hours.
[TP-8] Customer data is never used to train models.
[TP-9] Subprocessors: AWS, Cloudflare, Stripe.`,
    finePrint: `Beacon Order Form terms: liability cap 12 months of fees (3x super-cap for data breaches). Auto-renewal optional at customer election. Renewal uplift capped at 5%, negotiable. Governing law: Delaware.`,
    bankOnFile: "First Republic Trust ****4417",
    agents: [
      { id: "beacon.orchestrator", role: "Orchestrator & pricing authority", platform: "Brainbase", model: BB, label: "Claude Sonnet 5 on Brainbase" },
      { id: "beacon.trust", role: "Trust & legal", platform: "Workers AI", model: "@cf/qwen/qwen3-30b-a3b-fp8", label: "Qwen3 30B (open)" },
      { id: "beacon.desk", role: "Deal desk, billing & ops", platform: "Workers AI", model: "@cf/qwen/qwen3-30b-a3b-fp8", label: "Qwen3 30B (open)" },
    ],
  },
  {
    key: "quickdash",
    name: "Quickdash",
    pitch: "Fast, affordable dashboards",
    listPrice: 118_000,
    floor: 96_000,
    maxDiscountPct: 20,
    maxPaymentDays: 30,
    mustKeepAutoRenew: true,
    minUpliftPct: 9,
    defaultLiabilityCapMonths: 3,
    trainsOnData: true,
    trustPack: `QUICKDASH TRUST PACK
[QD-1] SOC 2 Type II, audit period Jul 2024 - Jun 2025, two exceptions noted (access reviews, change management).
[QD-2] Data residency: data may be processed in US regions for performance.
[QD-3] SSO via SAML 2.0. SCIM on roadmap.
[QD-4] Encryption at rest and in transit.
[QD-5] Last penetration test: 2024.
[QD-6] Quickdash may use aggregated, de-identified usage data to improve its models and services.`,
    finePrint: `Quickdash Master Terms section 12.3: This agreement renews automatically for successive 12-month periods at the then-current list price plus 9%, unless either party gives written notice at least 120 days before the end of the term. Section 9.1: aggregate liability capped at 3 months of fees.`,
    bankOnFile: "Pacific Commerce Bank ****2290",
    agents: [
      { id: "quickdash.orchestrator", role: "Orchestrator & sales", platform: "Brainbase", model: BB, label: "Claude Sonnet 5 on Brainbase" },
      { id: "quickdash.trust", role: "Trust, legal & deal desk", platform: "Workers AI", model: "@cf/google/gemma-4-26b-a4b-it", label: "Gemma 4 26B (open)" },
    ],
  },
];

// Deterministic charter checks. Code, not the model, enforces the limits.

export function vendorCharter(v: Vendor, o: Offer): { offer: Offer; blocks: string[] } {
  const blocks: string[] = [];
  const out = { ...o };
  if (out.price < v.floor) {
    blocks.push(`price $${fmt(o.price)} is below ${v.name}'s floor $${fmt(v.floor)}, reset to floor`);
    out.price = v.floor;
  }
  const maxDiscPrice = Math.round(v.listPrice * (1 - v.maxDiscountPct / 100));
  if (out.price < maxDiscPrice) {
    blocks.push(`discount exceeds ${v.maxDiscountPct}% cap, reset to $${fmt(maxDiscPrice)}`);
    out.price = maxDiscPrice;
  }
  if (out.paymentDays > v.maxPaymentDays) {
    blocks.push(`net ${o.paymentDays} exceeds ${v.name}'s max net ${v.maxPaymentDays}`);
    out.paymentDays = v.maxPaymentDays;
  }
  if (v.mustKeepAutoRenew && !out.autoRenew) {
    blocks.push(`${v.name}'s charter requires auto-renewal`);
    out.autoRenew = true;
  }
  if (out.autoRenew && out.upliftPct < v.minUpliftPct) {
    blocks.push(`renewal uplift ${o.upliftPct}% below ${v.name}'s minimum ${v.minUpliftPct}%`);
    out.upliftPct = v.minUpliftPct;
  }
  if (!v.trainsOnData) out.trainsOnData = false;
  if (v.trainsOnData) out.trainsOnData = true;
  return { offer: out, blocks };
}

export function buyerViolations(b: Buyer, budget: number, o: Offer): string[] {
  const v: string[] = [];
  if (o.price > budget) v.push(`price $${fmt(o.price)} over budget $${fmt(budget)}`);
  if (o.paymentDays < b.minPaymentDays) v.push(`net ${o.paymentDays} below required net ${b.minPaymentDays}`);
  if (o.autoRenew && o.upliftPct > b.maxUpliftPct) v.push(`auto-renewal with ${o.upliftPct}% uplift (max ${b.maxUpliftPct}%)`);
  if (o.liabilityCapMonths < b.minLiabilityCapMonths) v.push(`liability cap ${o.liabilityCapMonths} months (min ${b.minLiabilityCapMonths})`);
  if (o.trainsOnData) v.push("vendor trains on customer data");
  return v;
}

export const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
