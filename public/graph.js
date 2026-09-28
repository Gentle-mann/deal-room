// Shared graph module: pictogram figures, chain-of-command layouts, themed Cytoscape styles, message packets.
// Used by the live deal view (index.html) and the scale simulation (scale.html).

// Packet and chip codes: short mono labels instead of emoji
export const ART = { rfp:"RFP", proposal:"PROP", questionnaire:"SECQ", grade:"GRADE", counter:"CNTR", offer:"OFFER", redline:"REDLN", award:"AWARD", debrief:"DEBRF",
  escalate:"ESC", approve:"OK", deny:"DENY", signature:"SIGN", fraud:"FRAUD", po:"PO", invoice:"INV", payment:"PAY", provision:"PROV", eliminate:"ELIM", block:"BLOCK",
  task:"TASK", result:"RSLT", channel:"LINK", brief:"BRIEF", search:"SEARCH", fetch:"FETCH", read:"READ", tool:"TOOL" };
export const code = (art) => ART[art] || "MSG";

// ---------- theme: every color comes from tokens.css ----------
const V = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
function readTheme() {
  return { frontier:V("--g-frontier"), open:V("--g-open"), screen:V("--g-screen"), text:V("--g-label"), strong:V("--g-company-label"),
    company:V("--g-company"), companyBorder:V("--g-company-line"), reports:V("--g-reports"), msg:V("--g-msg"), chan:V("--g-chan"), flash:V("--g-flash"),
    packetBg:V("--g-packet"), packetFg:V("--g-packet-text"), select:V("--g-select"), dot:V("--g-dot"),
    red:V("--red"), green:V("--green"), amber:V("--amber"), onRed:V("--on-red"), onStatus:V("--on-status"), dim:Number(V("--g-dim")) || 0.12, dimEdge:Number(V("--g-dim-edge")) || 0.08 };
}
let T = {}, themeName = "dark";
export const theme = () => T;
export function getTheme() {
  try { return localStorage.getItem("dealroom-theme") === "light" ? "light" : "dark"; } catch { return "dark"; }
}
export function applyTheme(name) {
  themeName = name === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = themeName;
  try { localStorage.setItem("dealroom-theme", themeName); } catch {}
  T = readTheme();
  return themeName;
}

// ---------- full-body pictogram figures, one pose per state ----------
function figure(tone, pose) {
  const c = T[tone];
  const head = `<circle cx="20" cy="8" r="6.2" fill="${c}"/>`;
  const torso = `<rect x="13" y="16" width="14" height="20" rx="4" fill="${c}"/>`;
  const legs = `<rect x="13.8" y="35" width="5.4" height="22" rx="2.4" fill="${c}"/><rect x="20.8" y="35" width="5.4" height="22" rx="2.4" fill="${c}"/>`;
  let arms = `<rect x="7" y="17" width="5" height="18" rx="2.4" fill="${c}"/><rect x="28" y="17" width="5" height="18" rx="2.4" fill="${c}"/>`, extra = "";
  if (pose === "work1" || pose === "work2") {
    const dy = pose === "work1" ? 0 : 1.6;
    arms = `<rect x="7" y="17" width="5" height="12" rx="2.4" fill="${c}"/><rect x="28" y="17" width="5" height="12" rx="2.4" fill="${c}"/>`;
    extra = `<rect x="9" y="${24 + dy}" width="22" height="13" rx="1.8" fill="${T.screen}" stroke="${T.amber}" stroke-width="1.6"/><rect x="12" y="${27 + dy}" width="${pose === "work1" ? 12 : 16}" height="1.8" fill="${T.amber}"/><rect x="12" y="${31 + dy}" width="${pose === "work1" ? 9 : 6}" height="1.8" fill="${T.amber}"/>`;
  } else if (pose === "block") {
    arms = `<rect x="8" y="22" width="24" height="4.6" rx="2.2" fill="${c}" transform="rotate(18 20 24)"/><rect x="8" y="22" width="24" height="4.6" rx="2.2" fill="${c}" transform="rotate(-18 20 24)"/>`;
    extra = `<circle cx="34" cy="5" r="4" fill="${T.red}"/><rect x="31.8" y="4.2" width="4.4" height="1.6" fill="${T.onRed}"/>`;
  } else if (pose === "done") {
    extra = `<circle cx="34" cy="5" r="4" fill="${T.green}"/><path d="M32 5 l1.5 1.5 l2.8 -3" stroke="${T.onStatus}" stroke-width="1.3" fill="none"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="120" viewBox="0 0 40 60" preserveAspectRatio="xMidYMid meet">${legs}${torso}${arms}${head}${extra}</svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}
const FIG = {};
export const fig = (tone, pose) => (FIG[`${themeName}:${tone}:${pose}`] ||= figure(tone, pose));

// ---------- Cytoscape styles for the current theme ----------
export function buildStyle(extra = []) {
  const INTER = "Inter, system-ui, sans-serif", MONO = "JetBrains Mono, ui-monospace, monospace";
  return [
    { selector: "node.company", style: { "background-color":T.company, "border-width":1.5, "border-color":T.companyBorder, "shape":"round-rectangle", "corner-radius":16, "padding":40,
      "label":"data(label)", "text-valign":"top", "text-halign":"center", "text-margin-y":-12, "color":T.strong, "font-family":INTER, "font-size":20, "font-weight":600, "min-zoomed-font-size":8 } },
    { selector: "node.agent", style: { "shape":"rectangle", "width":36, "height":54, "background-opacity":0, "border-width":0,
      "background-image":"data(img)", "background-fit":"none", "background-width":"100%", "background-height":"100%", "background-position-x":"50%", "background-position-y":"50%", "background-clip":"node", "background-image-smoothing":"yes", "background-image-crossorigin":"null",
      "label":"data(label)", "text-wrap":"wrap", "text-max-width":140, "text-valign":"bottom", "text-margin-y":8,
      "color":T.text, "font-family":INTER, "font-size":12, "font-weight":500, "line-height":1.3, "min-zoomed-font-size":8 } },
    { selector: "node.agent[level = 0]", style: { "width":48, "height":72, "font-size":14, "font-weight":600, "color":T.strong } },
    { selector: "node:active", style: { "overlay-opacity":0 } },
    { selector: "node.company.hidelabel", style: { "text-opacity":0 } },
    { selector: "node.agent.focused", style: { "underlay-color":T.select, "underlay-opacity":0.07, "underlay-padding":12, "underlay-shape":"ellipse" } },
    { selector: "node.agent.spot", style: { "underlay-color":T.select, "underlay-opacity":0.10, "underlay-padding":16, "underlay-shape":"ellipse", "font-weight":700, "color":T.strong } },
    { selector: "node.packet", style: { "shape":"round-rectangle", "height":20, "width":"data(pw)", "background-color":T.packetBg, "border-width":0, "label":"data(label)",
      "font-family":MONO, "font-size":11, "font-weight":700, "color":T.packetFg, "text-valign":"center", "text-halign":"center", "z-index":99, "events":"no" } },
    { selector: "node.packet.bad", style: { "background-color":T.red, "color":T.onRed } },
    { selector: "node.packet.money", style: { "background-color":T.green, "color":T.onStatus } },
    { selector: "node.packet.dot", style: { "shape":"ellipse", "width":6, "height":6, "label":"", "background-color":T.dot } },
    { selector: "node.packet.dot.bad", style: { "background-color":T.red } },
    { selector: "edge.reports", style: { "curve-style":"taxi", "taxi-direction":"horizontal", "taxi-turn":"50%", "width":1.5, "line-color":T.reports, "events":"no" } },
    { selector: "edge.msg", style: { "curve-style":"unbundled-bezier", "control-point-distances":[-40], "control-point-weights":[0.5], "width":"mapData(w, 1, 12, 1.5, 4)", "line-color":T.msg,
      "line-style":"dashed", "line-dash-pattern":[6, 4], "target-arrow-shape":"triangle", "target-arrow-color":T.msg, "arrow-scale":0.8, "events":"no" } },
    { selector: "edge.flash", style: { "line-color":T.flash, "target-arrow-color":T.flash, "line-style":"solid", "width":3 } },
    { selector: "edge.flash.bad", style: { "line-color":T.red, "target-arrow-color":T.red } },
    { selector: "edge.flash.money", style: { "line-color":T.green, "target-arrow-color":T.green } },
    { selector: "edge.chan", style: { "curve-style":"unbundled-bezier", "control-point-distances":[30], "control-point-weights":[0.5], "width":1.5, "line-color":T.chan, "line-style":"dotted", "line-dash-pattern":[2, 4], "events":"no" } },
    { selector: ".dim", style: { "opacity":T.dim } },
    { selector: "edge.dim", style: { "opacity":T.dimEdge } },
    ...extra,
  ];
}

// ---------- chain-of-command tree layout (live view) ----------
// companies: [{ name, buyer:boolean, members:[{ id, reportsTo? }] }]
// Buyer tree grows left from its orchestrator (placed at the right edge); vendor trees grow right from theirs.
function forest(members) {
  const ids = new Set(members.map((m) => m.id)), kids = {}, roots = [];
  for (const m of members) { if (m.reportsTo && ids.has(m.reportsTo)) (kids[m.reportsTo] ||= []).push(m.id); else roots.push(m.id); }
  return { kids, roots };
}
export function treeLayout(companies, opt = {}) {
  const LEVEL = opt.levelGap ?? 210, LEAF = opt.leafGap ?? 100, CENTER = opt.center ?? 200, STACK = opt.stackGap ?? 240;
  const pos = {}, levels = {};
  const layoutOne = (c, dir) => {
    const { kids, roots } = forest(c.members);
    let cursor = 0;
    const place = (id, depth) => {
      levels[id] = depth;
      const ch = kids[id] || [];
      if (!ch.length) { pos[id] = { x: dir * depth * LEVEL, y: cursor }; cursor += LEAF; return pos[id].y; }
      const ys = ch.map((k) => place(k, depth + 1));
      pos[id] = { x: dir * depth * LEVEL, y: (ys[0] + ys[ys.length - 1]) / 2 };
      return pos[id].y;
    };
    roots.forEach((r) => place(r, 0));
    const ids = c.members.map((m) => m.id), ys = ids.map((id) => pos[id].y);
    return { ids, top: Math.min(...ys), bottom: Math.max(...ys) };
  };
  const shift = (ids, dx, dy) => ids.forEach((id) => { pos[id].x += dx; pos[id].y += dy; });
  const buyer = companies.find((c) => c.buyer), vendors = companies.filter((c) => !c.buyer);
  if (buyer) { const e = layoutOne(buyer, -1); shift(e.ids, -CENTER, -(e.top + e.bottom) / 2); }
  const vend = vendors.map((c) => layoutOne(c, +1));
  const total = vend.reduce((a, e) => a + (e.bottom - e.top) + STACK, -STACK);
  let y = -total / 2;
  vend.forEach((e) => { shift(e.ids, CENTER, y - e.top); y += e.bottom - e.top + STACK; });
  return { pos, levels };
}

// ---------- cone layout (scale view) ----------
// Each company is a cone whose tip is its orchestrator; every level of the chain of command sits on a wider arc.
// The buyer's cone points left; vendor cones fan around the right side so the picture stays wide.
export function coneLayout(companies, opt = {}) {
  const LEVEL = opt.levelGap ?? 260, CENTER = opt.center ?? 260;
  const pos = {}, levels = {}, anchors = {};
  const buyer = companies.find((c) => c.buyer), vendors = companies.filter((c) => !c.buyer);
  const spread = Math.min(110, 150 / Math.max(1, vendors.length)) * Math.PI / 180;
  const plan = [];
  if (buyer) plan.push({ c: buyer, axis: Math.PI, half: 55 * Math.PI / 180 });
  vendors.forEach((c, i) => {
    const axis = vendors.length === 1 ? 0 : (-60 + (120 * i) / (vendors.length - 1)) * Math.PI / 180;
    plan.push({ c, axis, half: Math.min(55 * Math.PI / 180, spread / 2) });
  });
  for (const { c, axis, half } of plan) {
    const { kids, roots } = forest(c.members);
    const leaves = [], ang = {};
    const walk = (id, d) => { levels[id] = d; const ch = kids[id] || []; if (!ch.length) leaves.push(id); ch.forEach((k) => walk(k, d + 1)); };
    roots.forEach((r) => walk(r, 0));
    leaves.forEach((id, i) => { ang[id] = leaves.length === 1 ? 0 : -half + (2 * half * i) / (leaves.length - 1); });
    const angleOf = (id) => { const ch = kids[id] || []; if (!ch.length) return ang[id]; const a = ch.map(angleOf); return (ang[id] = (a[0] + a[a.length - 1]) / 2); };
    roots.forEach(angleOf);
    const root = { x: Math.cos(axis) * CENTER, y: Math.sin(axis) * CENTER };
    anchors[c.name] = { ...root, axis };
    for (const m of c.members) {
      const r = levels[m.id] * LEVEL, a = axis + (ang[m.id] ?? 0);
      pos[m.id] = { x: root.x + Math.cos(a) * r, y: root.y + Math.sin(a) * r };
    }
  }
  return { pos, levels, anchors };
}

// Build Cytoscape elements: companies as compound nodes, agents, chain-of-command edges.
export function buildElements(companies, labelFor, layout = treeLayout, opts = {}) {
  const { pos, levels, anchors } = layout(companies, opts);
  const els = [];
  for (const c of companies) {
    const cid = "co:" + c.name;
    els.push({ group:"nodes", data:{ id:cid, label: c.name + (c.buyer ? "  ·  buyer" : "  ·  vendor") }, classes:"company" });
    for (const m of c.members) {
      const tone = m.frontier ? "frontier" : "open";
      els.push({ group:"nodes", data:{ id:m.id, parent:cid, label: labelFor(m), img: fig(tone, "idle"), tone, level: levels[m.id], boss: m.reportsTo }, position: pos[m.id], classes:"agent" + (m.cls ? " " + m.cls : "") });
    }
    for (const m of c.members) if (m.reportsTo && pos[m.reportsTo]) els.push({ group:"edges", data:{ id:`r:${m.reportsTo}>${m.id}`, source:m.reportsTo, target:m.id }, classes:"reports" });
  }
  return { els, anchors };
}

// Pose for a node; working figures alternate frames so they look like they are typing.
export function setPose(node, pose, frame) {
  const p = pose === "work" ? (frame % 2 ? "work2" : "work1") : pose;
  const img = fig(node.data("tone"), p);
  if (node.data("img") !== img) node.data("img", img);
}

// Animate a message packet from one node to another along a message edge.
export function sendPacket(cy, fromId, toId, opts = {}) {
  const from = cy.getElementById(fromId), to = cy.getElementById(toId);
  if (from.empty() || to.empty() || fromId === toId) return;
  const cls = opts.cls || "";
  if (!opts.noEdge) {
    const id = `m:${fromId}>${toId}`;
    let e = cy.getElementById(id);
    if (e.empty()) e = cy.add({ group:"edges", data:{ id, source:fromId, target:toId, w:1 }, classes:"msg" });
    e.data("w", Math.min(12, (e.data("w") || 1) + 1));
    e.addClass("flash " + cls); setTimeout(() => e.removeClass("flash bad money"), opts.flashMs ?? 900);
  }
  const pid = "p" + Math.random().toString(36).slice(2);
  const label = opts.label || "MSG";
  const p = cy.add({ group:"nodes", data:{ id:pid, label, pw: 14 + label.length * 7 }, position:{ ...from.position() }, classes:"packet " + (opts.dot ? "dot " : "") + cls });
  p.animate({ position:{ ...to.position() } }, { duration: opts.duration ?? 850, easing:"ease-in-out-cubic", complete: () => p.remove() });
}
