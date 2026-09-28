// Shared graph module: pictogram figures, chain-of-command layouts, themed Cytoscape styles, message packets.
// Used by the live deal view (index.html) and the scale simulation (scale.html).

export const RED = "#ff4d4f", GREEN = "#2fbf71", AMBER = "#e0a800";
export const ART = { rfp:"📨", proposal:"📄", questionnaire:"🔒", grade:"✔", counter:"💬", offer:"💬", redline:"✍", award:"🏆", debrief:"✉",
  escalate:"⤴", approve:"✅", deny:"⛔", signature:"✒", fraud:"☠", po:"📋", invoice:"🧾", payment:"💳", provision:"🚀", eliminate:"✕", block:"⛔",
  task:"▸", result:"◂" };

// ---------- themes ----------
export const THEMES = {
  dark:  { frontier:"#f4f4f4", open:"#9a9a9a", screen:"#000000", text:"#dedede", strong:"#f2f2f2", company:"#060606", companyBorder:"#242424",
           reports:"#2b2b2b", msg:"#3a3a3a", flash:"#ffffff", packetBg:"#000000", packetFg:"#ffffff", select:"#ffffff", faint:"#5c5c5c" },
  light: { frontier:"#111111", open:"#8c8c8c", screen:"#ffffff", text:"#262626", strong:"#0d0d0d", company:"#fafafa", companyBorder:"#dddddd",
           reports:"#cdcdcd", msg:"#b8b8b8", flash:"#000000", packetBg:"#ffffff", packetFg:"#000000", select:"#000000", faint:"#9a9a9a" },
};
let T = THEMES.dark, themeName = "dark";
export const theme = () => T;
export function getTheme() {
  try { return localStorage.getItem("dealroom-theme") === "light" ? "light" : "dark"; } catch { return "dark"; }
}
export function applyTheme(name) {
  themeName = THEMES[name] ? name : "dark";
  T = THEMES[themeName];
  document.documentElement.dataset.theme = themeName;
  try { localStorage.setItem("dealroom-theme", themeName); } catch {}
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
    extra = `<rect x="9" y="${24 + dy}" width="22" height="13" rx="1.8" fill="${T.screen}" stroke="${AMBER}" stroke-width="1.6"/><rect x="12" y="${27 + dy}" width="${pose === "work1" ? 12 : 16}" height="1.8" fill="${AMBER}"/><rect x="12" y="${31 + dy}" width="${pose === "work1" ? 9 : 6}" height="1.8" fill="${AMBER}"/>`;
  } else if (pose === "block") {
    arms = `<rect x="8" y="22" width="24" height="4.6" rx="2.2" fill="${c}" transform="rotate(18 20 24)"/><rect x="8" y="22" width="24" height="4.6" rx="2.2" fill="${c}" transform="rotate(-18 20 24)"/>`;
    extra = `<circle cx="34" cy="5" r="4" fill="${RED}"/><rect x="31.8" y="4.2" width="4.4" height="1.6" fill="#fff"/>`;
  } else if (pose === "done") {
    extra = `<circle cx="34" cy="5" r="4" fill="${GREEN}"/><path d="M32 5 l1.5 1.5 l2.8 -3" stroke="#fff" stroke-width="1.3" fill="none"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 60">${legs}${torso}${arms}${head}${extra}</svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}
const FIG = {};
export const fig = (tone, pose) => (FIG[`${themeName}:${tone}:${pose}`] ||= figure(tone, pose));

// ---------- Cytoscape styles for the current theme ----------
export function buildStyle(extra = []) {
  return [
    { selector: "node.company", style: { "background-color":T.company, "border-width":1, "border-color":T.companyBorder, "shape":"round-rectangle",
      "label":"data(label)", "text-valign":"top", "text-halign":"center", "text-margin-y":-10, "color":T.strong, "font-size":16, "font-weight":600, "padding":36 } },
    { selector: "node.agent", style: { "shape":"rectangle", "width":34, "height":51, "background-opacity":0, "border-width":0,
      "background-image":"data(img)", "background-fit":"contain", "background-clip":"none", "background-image-containment":"over",
      "label":"data(label)", "text-wrap":"wrap", "text-max-width":150, "text-valign":"bottom", "text-margin-y":7,
      "color":T.text, "font-size":10.5, "line-height":1.3, "min-zoomed-font-size":7 } },
    { selector: "node.agent[level = 0]", style: { "width":44, "height":66, "font-size":12, "font-weight":600 } },
    { selector: "node.agent:selected", style: { "overlay-color":T.select, "overlay-opacity":0.1, "overlay-padding":10, "overlay-shape":"round-rectangle" } },
    { selector: "node.packet", style: { "width":20, "height":20, "background-color":T.packetBg, "border-width":1, "border-color":T.packetFg, "label":"data(label)",
      "text-valign":"center", "text-halign":"center", "font-size":11, "color":T.packetFg, "z-index":99, "events":"no" } },
    { selector: "node.packet.dot", style: { "width":6, "height":6, "label":"", "background-color":T.packetFg, "border-width":0 } },
    { selector: "node.packet.bad", style: { "border-color":RED } },
    { selector: "node.packet.dot.bad", style: { "background-color":RED } },
    { selector: "node.packet.money", style: { "border-color":GREEN } },
    { selector: "edge.reports", style: { "curve-style":"taxi", "taxi-direction":"horizontal", "taxi-turn":"50%", "width":1.4, "line-color":T.reports, "events":"no" } },
    { selector: "edge.msg", style: { "curve-style":"unbundled-bezier", "control-point-distances":[-40], "control-point-weights":[0.5], "width":"mapData(w, 1, 12, 1, 4)", "line-color":T.msg,
      "target-arrow-shape":"triangle", "target-arrow-color":T.msg, "arrow-scale":0.7, "line-style":"dashed", "line-dash-pattern":[6, 4], "events":"no" } },
    { selector: "edge.flash", style: { "line-color":T.flash, "target-arrow-color":T.flash, "line-style":"solid" } },
    { selector: "edge.flash.bad", style: { "line-color":RED, "target-arrow-color":RED } },
    { selector: "edge.flash.money", style: { "line-color":GREEN, "target-arrow-color":GREEN } },
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
  const LEVEL = opt.levelGap ?? 210, LEAF = opt.leafGap ?? 112, CENTER = opt.center ?? 200, STACK = opt.stackGap ?? 230;
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
  const p = cy.add({ group:"nodes", data:{ id:pid, label: opts.label || "•" }, position:{ ...from.position() }, classes:"packet " + (opts.dot ? "dot " : "") + cls });
  p.animate({ position:{ ...to.position() } }, { duration: opts.duration ?? 850, easing:"ease-in-out-cubic", complete: () => p.remove() });
}
