# Deal Room design spec: Two Clocks: a monochrome command center where the gap between the human line and the agent line tells the story

## rationale
Winner: Material "Two Clocks". It had the best projector engineering, and the idea of folding the stepper into the chart's x-axis carried both judges. Grafts and conflict rulings:

1) ONE TIMELINE. The pill stepper and the header clock are deleted. The 10 stages become the columns of the humans-vs-agents chart. Under the plot sits a segmented progress bar with short labels. "Closed" is a terminal chip in the right margin. The clock number moves into a KPI tile. The audience learns one object: a column is a stage, and the vertical distance between the two lines is the speedup.

2) DOCK UNDER THE GRAPH COLUMN ONLY (from Product; this fixes the risk both judges flagged in Material). The right panel keeps full height, so the spotlight transcript gets 796px at 1440 and 624px at 1280, not 408. To keep the chart wide, the KPIs sit in a horizontal row on top of the dock (from Editorial) instead of a left column. That gives 82px columns at 1440 and at least 61px in the tightest spotlight state.

3) CLOSED TAKEOVER (from Editorial) replaces the small closed banner. It shows "3m 42s" at 128px over the canvas, with the chart dock still visible underneath. This is wow moment 3.

4) CHAPTER HEADING (from Editorial). "Stage 4 of 11" and "Negotiation" at 28px sit top-left of the canvas and tell the back row where the deal is. The tour pill lives inside this heading, so there is one overlay instead of two.

5) PACKET CODES (from Product). The emoji ART map becomes 2 to 5 letter mono codes (RFP, OFFER, BLOCK, PAY), drawn as filled chips. This is the biggest professionalism gain per minute of work.

6) STATUS ON FIVE SURFACES AT ONCE (from Material), with one body class, `body.is-blocked`, held for 1800ms. The figure pose, edge flash, BLOCK packet, caption rule, chart head, current stage segment, chapter eyebrow and status pill all turn red together. Everything else stays gray, so the one red event reads from the back row.

7) TWO FAMILIES ONLY: Inter and JetBrains Mono. There is no Instrument Serif (four families, and it reads like a newspaper) and no Geist (reads as a Vercel clone). Material Symbols is dropped: an icon font with display=block is risky on venue wifi. Glyphs are Unicode or CSS instead. Humans and agents are told apart by line style (dashed gray 2.5px vs solid ink 3px) and by end labels, with no legend.

8) The SIMULATION badge is a neutral dashed badge, not amber. Amber means working, and color is reserved for status. The only colors anywhere are red (blocked), amber (working or running) and green (paid, done, closed). Every gray is R=G=B, so there is no blue tint.

9) FEASIBILITY. Reuse the existing timechart.js (Chart.js 4, log axis, stage math) instead of writing a new SVG module. One ~60-line Chart.js plugin adds the current-column band, the gap bracket and the end labels. An HTML head dot animates with CSS. One shared tokens.css feeds both pages, and graph.js reads its Cytoscape colors from the same CSS variables, so both themes have one source of truth. A cross-document View Transition keeps the dock pinned in place when the tour goes from live to scale.

10) HONESTY. The benchmark is labeled a "134-day average". The source comment in timechart.js says average (mean), not median. The plot's corner note reads "log scale · human stage split illustrative". The speedup updates only when a stage completes, so the hero number never drifts down mid-stage.

## layout
GLOBAL: html,body { height:100%; margin:0; overflow:hidden; background:var(--bg); } body { display:grid; grid-template-rows:56px minmax(0,1fr); } Spacing is on an 8px grid (4/8/12/16/20/24/32). Radii: tags and code chips 4, segment inner and kbd 6, buttons, inputs and segmented control 8, cards, tiles, caption and invoice 12, Cytoscape company box 16. z-index: #cy 0, canvas overlays 5, caption 6, invoice 7, takeover 20, options popover 30.

LIVE VIEW @1440x900 (default)
- header: 1440x56, padding 0 24px, flex, align-items center, gap 12, border-bottom 1px var(--line), background var(--bg).
- .main: display grid; grid-template-columns: minmax(0,1fr) 400px; min-height 0; transition: grid-template-columns 320ms var(--ease-out).
  - .main.spot → minmax(0,1fr) 560px.
  - .main.nopanel (key "]") → minmax(0,1fr) 0px, with .side overflow hidden and border 0.
- .left (graph column): display grid; grid-template-rows: minmax(0,1fr) 288px; min-width 0; min-height 0.
  - .stage (canvas): position relative, 1040x556 with the panel open (880x556 in spotlight, 1440x556 with the panel collapsed). #cy is absolute with inset 0.
  - .dock: 1040x288, background var(--surface-1), border-top 1px var(--line-strong), padding 12px 24px, display grid, grid-template-rows 82px 172px, row-gap 10px (12+82+10+172+12=288).
    - .kpis: display grid; grid-template-columns: 1.6fr 1fr 1fr .8fr .8fr; gap 8px.
    - .race: display grid; grid-template-rows 140px 32px. .race-plot is position relative, height 140, and holds the <canvas> and #raceHead. .chips is 32px tall.
    - Set on .race: --race-l:56px; --race-r:120px. The plot is 992-56-120 = 816px wide, so each of the 10 columns is 81.6px (65.6px in spotlight).
- .side (right panel): full height 844, background var(--surface-1), border-left 1px var(--line-strong), flex column. Tabs row 48px, then .pane with flex 1, overflow auto, padding 20px 24px.
- Canvas overlays (inside .stage):
  - Chapter heading: top 20, left 24, max-width 420.
  - Camera segmented control [Follow F | Fit B]: top 20, right 24.
  - Status legend: top 64, right 24.
  - Caption: left 24, bottom 16, max-width 640.
  - Invoice card: right 24, bottom 16, width 360. While it shows, .stage.has-invoice .caption { max-width: calc(100% - 432px); }
  - Closed takeover: position absolute, inset 0 (canvas only; the dock stays visible).
- Camera: every fit goes through fitSafe(). Its safe area is top 92, right 32, bottom 124, left 32. When the invoice is visible, right = invoice.offsetWidth + 48. Paste into index.html:
  const SAFE=()=>(innerWidth<=1360||innerHeight<=780)?{t:80,r:24,b:112,l:24}:{t:92,r:32,b:124,l:32};
  function fitSafe(eles=cy.elements(),dur=600,maxZ=1.6){if(!eles.length)return;const p=SAFE(),inv=$("#invoice");if(!inv.classList.contains("hidden"))p.r=inv.offsetWidth+48;const w=cy.width(),h=cy.height(),bb=eles.boundingBox(),z=Math.min((w-p.l-p.r)/Math.max(bb.w,1),(h-p.t-p.b)/Math.max(bb.h,1),maxZ),cx=p.l+(w-p.l-p.r)/2,cyy=p.t+(h-p.t-p.b)/2;cy.animate({zoom:z,pan:{x:cx-z*(bb.x1+bb.w/2),y:cyy-z*(bb.y1+bb.h/2)}},{duration:dur,easing:"ease-in-out-cubic"});}
  - zoomTo(id) becomes fitSafe(cy.getElementById(id).closedNeighborhood(), 600, 1.4).
  - Spotlight fit becomes fitSafe(partners, 700, 1.6).
  - Replace every cy.fit and cy.animate({fit}) with fitSafe.
- Panel-width change (spotlight on/off, "]"): run a rAF loop that calls cy.resize() for 340ms, then fitSafe(). Chart.js resizes itself through its ResizeObserver.
  function relayout(after){const t0=performance.now();(function f(){cy.resize();if(performance.now()-t0<340)requestAnimationFrame(f);else{cy.resize();after&&after();}})();}

LIVE VIEW @1280x720 PROJECTOR. Use @media (max-width:1360px), (max-height:780px):
- body grid-template-rows: 48px minmax(0,1fr). Header padding 0 16px.
- .main grid-template-columns: minmax(0,1fr) 360px; .main.spot → 480px.
- .left grid-template-rows: minmax(0,1fr) 232px. Canvas 920x440 (800x440 in spotlight).
- .dock padding 10px 16px; grid-template-rows 64px 140px; row-gap 8 (10+64+8+140+10=232).
- .race grid-template-rows 108px 32px; --race-l:48px; --race-r:104px. Columns are 73.6px (61.6px in spotlight). The short chip labels fit at 12px down to about 60px.
- Overlays use a 16px inset (chapter top 16, left 16; caption bottom 12). Caption max-width 520. Invoice width 320, and has-invoice caption max-width calc(100% - 368px). Status legend top 56.
- Side pane padding 16px. Header meta and kbd hints are hidden. KPI sub-lines are hidden.

SCALE VIEW (scale.html), same shell with no side panel:
- 1440x900: body rows 56px 1fr. .left is one column: canvas 1440x556, dock 1440x288, identical markup and classes. The chart block is one 172px canvas: x-axis tick labels are drawn by Chart.js, there is no chip row, and --race-l/--race-r stay 56/120.
- 1280x720: rows 48px 1fr, dock 232, chart canvas 140.
- Overlays:
  - Chapter heading top-left (eyebrow "Simulation · same chain of command" plus the tour pill; title "4,507 agents · 7 companies", live).
  - Footnote bottom-left, max-width 520, 12/16 text-3, on --overlay with radius 8 and padding 8 12. Hidden when width ≤1360.
- #cy inset 0. The scale fit uses the same fitSafe with safe area t 92, r 32, b 48, l 32.
- Header left: wordmark "Deal Room", then "/ Scale" (text-3). No badge; the chapter eyebrow says "Simulation".
- Header right:
  - Segmented "Depth" control: L1 | L2 | L3 | L4.
  - "+ Vendor" (ghost).
  - "Pause" (ghost) with kbd hint "Space".
  - Theme icon button ◐.
  - "← Live deal" (ghost).

Below 1100px wide (not a stage target):
- .main becomes a single column: grid-template-rows 60vh auto auto. The dock follows the canvas and the panel goes last.
- .kpis becomes 2 columns. Gutters 16px, no horizontal scroll.

## typography
Families: Inter (all UI, chart text and Cytoscape labels) and JetBrains Mono (codes, timestamps, transcripts, chart ticks). Nothing else, and no icon font. Put this in <head> of both pages, before tokens.css:
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400..800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">

Base: html { font: 400 14px/20px Inter, system-ui, -apple-system, "Segoe UI", sans-serif; -webkit-font-smoothing: antialiased; font-optical-sizing: auto; font-feature-settings: "cv11" 1, "ss01" 1; }. Every number element uses font-variant-numeric: tabular-nums. Mono stack: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace. Floor: no static DOM text below 12px. Sentence case everywhere. The only all-caps are the SIMULATION badge, the PAID stamp and artifact/packet codes (RFP, OFFER, which are uppercase by nature).

ROLES: size/line-height, weight, tracking, color. [1280 values in brackets]
- Takeover headline "3m 42s": Inter 128/120, 700, -0.045em, tnum, --text [96/92]
- Takeover hero line "52,151× faster": Inter 32/40, 700, -0.02em, --text [28/36]
- Takeover sub "vs. 134 days for a human team": Inter 24/32, 500, --text-2 [20/28]
- Takeover eyebrow "Deal closed": Inter 14/20, 600, +0.01em, --green
- Hero KPI value (Faster than humans): Inter 40/44, 700, -0.025em, tnum [32/36]. The "×" suffix is Inter 28px, 500, --text-2 [22px].
- KPI value (other tiles): Inter 28/44 (line box matches the hero), 600, -0.015em, tnum [22/36]
- KPI label: Inter 12/16, 500, +0.02em, --text-3
- KPI sub: Inter 12/16, 400, --text-3, inline after the value with margin-left 6 [hidden]
- Chapter eyebrow "Stage 4 of 11": JetBrains Mono 12/16, 500, --text-3
- Chapter title "Negotiation": Inter 28/32, 650, -0.02em, --text [24/28]
- Caption who line: Inter 13/16, 600, --text-2
- Caption text: Inter 18/26, 500, --text, 2-line clamp [16/24]
- Wordmark "Deal Room": Inter 18/24, 650, -0.01em [16/24]
- Header meta "deal 7f3a2c · Acme Corp ↔ 2 vendors": JetBrains Mono 12/16, 500, --text-3 [hidden]
- Buttons and tabs: Inter 14/20, 500, +0.005em [13/18]
- Kbd hints: JetBrains Mono 12/16, 500, --text-3 [hidden]
- Panel title (agent name, spotlight title): Inter 22/28, 600, -0.01em [20/26]
- Panel sub: Inter 14/20, 400, --text-2
- Overline (section heads: "Can do alone", "Must ask", "Must prove", "Received", "Model output", "Inbox / outbox"): Inter 12/16, 600, +0.01em, --text-2
- Body (lists, log text, job): Inter 14/20, 400, --text
- Mono L, model output in spotlight (the star text): JetBrains Mono 14/22, 400, --text [13/20]
- Mono M, received and instructions blocks: JetBrains Mono 13/20, 400, --text-2 [12/18]
- Mono S (call meta, log times "+01:42", header meta): JetBrains Mono 12/16, 500, --text-3
- Code chip (RFP, OFFER, BLOCK…): JetBrains Mono 12/16, 700, +0.04em
- Status pill and tour pill: Inter 12/16, 600
- SIMULATION badge: JetBrains Mono 12/16, 600, uppercase, +0.08em
- Chart:
  - y ticks: JetBrains Mono 12px, 500, --text-3
  - Stage chip labels: Inter 12/16, 500 (current 600)
  - End labels: series name Inter 600 12px, value JetBrains Mono 500 12px
  - Gap bracket label: Inter 700 14px, --text
  - Corner note: Inter 500 12px, --text-3
- Invoice:
  - Title: Inter 14/20, 600
  - Amount: Inter 40/48, 700, -0.02em, tnum [32/40]
  - Rows: Inter 14/20
  - Mode pill: JetBrains Mono 12/16, 700
  - PAID stamp: Inter 28/32, 800, +0.08em
- Cytoscape canvas labels. Set "font-family" on every node style: Inter for labels, "JetBrains Mono" for packets.
  - Company: 20px, 600
  - Orchestrator: 14px, 600
  - Department agent: 12px, 500, line-height 1.3
  - Packet code: 11px, 700 mono
  - Scale-view company name: 26px, 700
  - min-zoomed-font-size 8 (company label 20px survives to zoom 0.4)
- Font loading: run document.fonts.ready.then(() => { cy.style(buildStyle(...)); raceChart.chart.update("none"); }). Otherwise the canvases keep the fallback font. Also set Chart.defaults.font.family = "Inter, system-ui, sans-serif" before creating charts.

## tokensDark
/* public/tokens.css. Dark is the default (dim hall); T toggles. */
:root, :root[data-theme="dark"] {
  color-scheme: dark;
  --bg:#0A0A0A; --surface-1:#121212; --surface-2:#1A1A1A; --surface-3:#262626;
  --line:#2B2B2B; --line-strong:#474747;
  --text:#F5F5F5; --text-2:#B3B3B3; --text-3:#858585; --text-4:#5C5C5C;
  --hover:rgba(255,255,255,.08); --press:rgba(255,255,255,.12);
  --overlay:rgba(18,18,18,.92); --scrim:rgba(10,10,10,.86);
  --shadow-md:0 8px 24px rgba(0,0,0,.50); --shadow-lg:0 24px 64px rgba(0,0,0,.60);
  --focus:0 0 0 2px #0A0A0A, 0 0 0 4px #F5F5F5;
  --red:#FF5A5F; --red-bg:rgba(255,90,95,.14); --red-line:rgba(255,90,95,.55);
  --green:#3DD68C; --green-bg:rgba(61,214,140,.14); --green-line:rgba(61,214,140,.55);
  --amber:#F5A524; --amber-bg:rgba(245,165,36,.14); --amber-line:rgba(245,165,36,.55);
  --on-red:#FFFFFF; --on-status:#0A0A0A;
  --chart-human:#8C8C8C; --chart-agent:#F5F5F5; --chart-grid:#2E2E2E; --chart-band:rgba(255,255,255,.06); --chart-knockout:#121212;
  --g-frontier:#F5F5F5; --g-open:#8F8F8F; --g-screen:#0A0A0A;
  --g-company:#111111; --g-company-line:#3A3A3A; --g-company-label:#F5F5F5; --g-label:#D4D4D4;
  --g-reports:#4A4A4A; --g-msg:#5E5E5E; --g-chan:#707070; --g-flash:#FFFFFF;
  --g-packet:#F5F5F5; --g-packet-text:#0A0A0A; --g-select:#FFFFFF; --g-dot:#BDBDBD;
  --paper:#FFFFFF; --paper-text:#0A0A0A; --paper-text-2:#525252; --paper-line:#EBEBEB; --paper-border:#D4D4D4; --paper-green:#15803D; --paper-amber:#B45309;
  --paper-shadow:0 24px 64px rgba(0,0,0,.55);
  --ease-out:cubic-bezier(.2,0,0,1); --ease-in-out:cubic-bezier(.4,0,.2,1); --ease-stamp:cubic-bezier(.3,1.35,.5,1);
}

## tokensLight
:root[data-theme="light"] {
  color-scheme: light;
  --bg:#FFFFFF; --surface-1:#F7F7F7; --surface-2:#FFFFFF; --surface-3:#EDEDED;
  --line:#E5E5E5; --line-strong:#BDBDBD;
  --text:#0A0A0A; --text-2:#474747; --text-3:#6B6B6B; --text-4:#A3A3A3;
  --hover:rgba(0,0,0,.05); --press:rgba(0,0,0,.08);
  --overlay:rgba(255,255,255,.94); --scrim:rgba(255,255,255,.90);
  --shadow-md:0 1px 2px rgba(0,0,0,.06), 0 8px 24px rgba(0,0,0,.08); --shadow-lg:0 24px 64px rgba(0,0,0,.16);
  --focus:0 0 0 2px #FFFFFF, 0 0 0 4px #0A0A0A;
  --red:#DC2626; --red-bg:rgba(220,38,38,.08); --red-line:rgba(220,38,38,.45);
  --green:#15803D; --green-bg:rgba(21,128,61,.09); --green-line:rgba(21,128,61,.45);
  --amber:#B45309; --amber-bg:rgba(180,83,9,.10); --amber-line:rgba(180,83,9,.45);
  --on-red:#FFFFFF; --on-status:#FFFFFF;
  --chart-human:#8A8A8A; --chart-agent:#0A0A0A; --chart-grid:#E3E3E3; --chart-band:rgba(0,0,0,.045); --chart-knockout:#F7F7F7;
  --g-frontier:#0A0A0A; --g-open:#8C8C8C; --g-screen:#FFFFFF;
  --g-company:#FAFAFA; --g-company-line:#CCCCCC; --g-company-label:#0A0A0A; --g-label:#262626;
  --g-reports:#BDBDBD; --g-msg:#A3A3A3; --g-chan:#8F8F8F; --g-flash:#000000;
  --g-packet:#0A0A0A; --g-packet-text:#FFFFFF; --g-select:#000000; --g-dot:#525252;
  --paper:#FFFFFF; --paper-text:#0A0A0A; --paper-text-2:#525252; --paper-line:#EBEBEB; --paper-border:#D4D4D4; --paper-green:#15803D; --paper-amber:#B45309;
  --paper-shadow:0 1px 2px rgba(0,0,0,.08), 0 16px 40px rgba(0,0,0,.14);
}
/* shared, in the same file */
@view-transition { navigation: auto; }
.dock { view-transition-name: dock; }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } }

## components
HEADER (56px; 48px at 1280)
- Left cluster, gap 12:
  - Mark: a 10x10 square, radius 2, background --text.
  - Wordmark "Deal Room".
  - Divider: 1x20, --line-strong.
  - Status pill.
  - Mono meta "deal 7f3a2c · Acme Corp ↔ 2 vendors" (hidden ≤1360).
- Right cluster (margin-left auto, gap 8):
  - Options (ghost, "Options ▾"). Popover: top 44, right 0, width 260, --surface-2, 1px --line-strong, radius 12, --shadow-lg, padding 12, grid gap 10. It holds "Buyer budget (private)" with a number input (h36, w100%, mono 14 tnum, --surface-3 bg, radius 8, padding 0 10), plus checkboxes "Aggressive buyer" and "All agents on Brainbase".
  - "Scale view" (ghost, kbd V).
  - "Start deal" (ghost, kbd S; submit of #start).
  - "▶ Demo tour" (primary, kbd D).
  - ◐ theme (icon, kbd T).
- The old .clock and .steps elements are deleted.

STATUS PILL
- h24, padding 0 10 0 8, radius 999, 1px --line-strong, Inter 12/16 600 --text, gap 6.
- Dot: 8x8 circle.
  - Idle: --text-3, label "Idle".
  - Running: --amber, label "Running", pulse ring.
  - Closed: --green, label "Closed".
  - No deal: --text-3, label "No deal".
- body.is-blocked turns the dot --red.

BUTTONS
- .btn: inline-flex, h36 (32 at 1280), padding 0 14 (0 12), radius 8, gap 8, Inter 14/20 500, border 1px transparent, cursor pointer, transition background 120ms var(--ease-out).
  - :focus-visible { box-shadow: var(--focus); }
  - :active adds the --press layer.
- .btn-primary: background --text, color --bg. Hover background color-mix(in srgb, var(--text) 88%, var(--bg)).
- .btn-ghost: transparent, border 1px --line-strong, color --text. Hover background --hover.
- .btn-icon: 36x36 (32x32), ghost, font-size 16.
- kbd: JetBrains Mono 12/16 500, min-width 20, h20, padding 0 5, radius 6, border 1px --line-strong, --text-3. Inside .btn-primary: border rgba(127,127,127,.5), color --bg at 70% opacity. Hidden ≤1360.
- Segmented (.seg): h36 (32), padding 2, radius 8, background --overlay, 1px --line-strong. Segments: h30 (26), padding 0 12, radius 6, Inter 13/18 500 --text-2. Active: background --surface-3, --text, weight 600.

PILLS AND CHIPS
- Tour pill: h24, radius 999, padding 0 10, background --text, color --bg, Inter 12/16 600, text "▶ Demo tour". It sits inline in the chapter eyebrow row, gap 8.
- SIMULATION badge: h24, padding 0 8, radius 6, border 1.5px dashed --text-2, color --text, mono 12/16 600 uppercase +0.08em.
- Code chip (.code): inline-flex, h20, padding 0 6, radius 4, 1px --line-strong, --text-2, mono 12/16 700 +0.04em.
  - .code.block: --red text, --red-line border, --red-bg background.
  - .code.money: same pattern with green.
  - .code.flag: same pattern with amber.
- Tags in the panel (model, calls): same as the code chip, but Inter 12/16 500, and the model name is in mono.

CHAPTER HEADING (canvas top-left)
- Row 1 (gap 8, align center): optional tour pill + mono eyebrow "Stage 4 of 11". Then a span.blk "· Blocked by charter" in --red 600, shown only under body.is-blocked.
- Row 2 (margin-top 4): stage name in full ("Security review"), Inter 28/32 650.
- Before a deal: eyebrow "Press D for the demo tour", title "Ready".
- On close: hidden (the takeover owns the moment).
- Title swap: 160ms opacity crossfade.

CAMERA CONTROL AND LEGEND (canvas top-right)
- .seg [Follow F | Fit B]. "Big picture" is renamed "Fit".
- Legend at top 64: flex gap 12, Inter 12/16 500 --text-3.
  - Three 8px dots: amber "Working", red "Blocked", green "Done".
  - Then a 1x12 --line-strong divider.
  - Two 6x12 radius-2 bars: --g-frontier "Frontier" and --g-open "Open-weight".

KPI TILES (5, top row of the dock)
- Tile: background --surface-2, 1px --line, radius 12, padding 10px 16px (8px 12px), display grid, grid-template-rows 16px 44px (16px 36px), row-gap 2, align-content center.
- Row 1 is the label. Row 2 is value + sub, baseline-aligned.
- Order and content (live view):
  1. HERO "Faster than humans": value e.g. "52,151" + "×" suffix. It uses the last completed stage: cumHuman[done] / agentAt[done]. Before the first stage completes it shows "—". Sub: none. The hero tile gets border 1px --line-strong.
  2. "Agent time": "3m 42s" via fmtDuration, ticking every 250ms. Sub "real, elapsed".
  3. "Human equivalent": "58 days" (cumulative human days through the last completed stage; 134 at close). Sub "of a 134-day average".
  4. "Messages": count of events with agent && to. Sub "agent to agent".
  5. "Agents": Object.keys(state.agents).length. Sub "3 companies".
- Scale view, same order:
  1. "57,600×".
  2. "Agent time": rounds × 1.5s, sub "simulated".
  3. "Human equivalent": rounds × 1 day.
  4. "Messages": live counter.
  5. "Agents": 4,507.
- Values render with toLocaleString("en-US"). No count-up tweens.
- On close, tile 1 gets border --green-line.

COMPARISON CHART: the full spec is in the chart field. This entry covers its stage chip row (the old stepper).
- <ol class="chips">: display grid, grid-template-columns repeat(10,minmax(0,1fr)), padding 0 var(--race-r) 0 var(--race-l), position relative, list-style none, margin 0.
- Each li.chip is a flex column, gap 6, padding-top 6, min-width 0, text-align center, with a --i index.
  - li.chip::before: content "", height 4, radius 2, margin 0 2px, background --line-strong, transition background 200ms var(--ease-out) calc(var(--i)*40ms).
  - span: Inter 12/16 500, --text-3, white-space nowrap, overflow hidden.
- Short labels, in order: Intake, Proposals, Security, Negotiate, Legal, Award, Approvals, PO, Invoice, Provision. The full name lives in the chapter heading.
- States:
  - .done: bar --text-2, text --text-2.
  - .on: bar --amber, text --text 600.
  - body.is-blocked .on: bar --red.
  - .chips.closed: every bar --green, staggered 40ms left to right.
- li.chip-end "Closed": position absolute, right 0, top 0, width calc(var(--race-r) - 16px). Same structure. It gets .on with a --green bar and --green 600 text when state.done.

CAPTION (canvas bottom-left)
- Shows only the latest non-stage event.
- Card: background --overlay, backdrop-filter blur(8px), 1px --line-strong, border-left 4px solid --text, radius 12, padding 12px 16px 12px 14px, --shadow-md.
- Row 1 (flex, gap 8): code chip, then who line "Beacon · Deal desk → Acme · Procurement".
- Row 2 (margin-top 4): the text, 2-line clamp.
- Kind colors on the left rule and code chip: block/fraud red; money/win green; escalate/flag amber.
- Swap animation: opacity 0 → 1 with translateY(4px) → 0, 160ms var(--ease-out).

RIGHT PANEL
- Tabs row h48, 2 equal buttons: "Agent" (reads "Spotlight" while spotlighting) and "Deal log" (kbd L). Tab text is Inter 14/20 500 --text-3. The active tab is --text with box-shadow inset 0 -2px 0 var(--text). Border-bottom 1px --line.
- AGENT FOCUS pane:
  - Title (role), then sub "Acme Corp · reports to Orchestrator".
  - Tags row (margin-top 8, gap 6):
    - Model tag: "Frontier · claude…" or "Open-weight · llama…".
    - Calls tag: "14 calls".
    - Status tag with dot: working amber, blocked red, done green, idle --text-3.
  - Primary .btn, full width, h40, margin 16px 0: "Spotlight real work" with kbd "⏎".
  - Job line: body text.
  - Three charter sections, each margin-top 20: overline, then a list (margin 8 0 0, padding 0, list-style none). Each li is 14/20 with padding-left 16 and a ::before 4x4 --text-3 square at left 2, top 8. Items are separated by 6px.
  - "Price per year, round by round": the existing SVG, restyled.
    - viewBox 360x160, width 100%, background --surface-2, 1px --line, radius 8.
    - Vendor 1 line: --text, 2px.
    - Vendor 2 line: --text-3, 2px.
    - Buyer line: dashed 3 3, --text-3.
    - Budget line: dashed 4 4, --line-strong, label "Buyer budget (private)" Inter 12 --text-3.
    - Blocked-ask ✕: --red, 14px.
    - Point labels: Inter 600 12px.
  - Inbox / outbox rows: padding 10 0, border-bottom 1px --line. Meta line in Mono S: "12:04:31 · sent → Beacon · Deal desk" + code chip. Text is 14/20, class k-kind colored (block red, money/win green, flag/escalate amber, stage 600 --text).
- DEAL LOG pane rows: grid-template-columns 56px 1fr, gap 12, padding 10 0, border-bottom 1px --line.
  - Column 1: time as mono "+01:42", relative to startedAt.
  - Column 2: who (Inter 13/16 600 --text-2) + code chip, then text 14/20.
  - Stage events render as a divider row "Stage 4 · Negotiation" in Inter 12/16 600 --text-2, with a 1px --line-strong top border and padding-top 16.
  - Block/money/escalate rows get a 2px left rule in their status color (padding-left 10).
- Empty state: "Select an agent to see its charter, inbox and outbox. Double-click an agent to spotlight its real model calls." 14/20 --text-3.

SPOTLIGHT TRANSCRIPT (panel 560 wide at 1440, 480 at 1280)
- Head (flex, gap 12, margin-bottom 16):
  - Overline "Spotlight".
  - Title (role).
  - Sub "Beacon Analytics · open-weight · llama-3.3-70b · reports to Orchestrator".
  - Ghost .btn h32 "Exit" with kbd "Esc" (margin-left auto).
- Overline "Real model calls · 7".
- Call card:
  - Background --surface-2, 1px --line-strong, radius 12, padding 16, margin-bottom 12.
  - Entrance: opacity 0 with translateY(8px), 240ms var(--ease-out).
  - .running: border-color --amber-line, box-shadow inset 3px 0 0 var(--amber). The output shows "working" + a blinking caret ▍ (1s steps(2) infinite).
- Meta row (Mono S, space-between, wrap): left "Call 3 · 12:04:31 · llama-3.3-70b · 2.4s"; right "Brainbase thread 7f3a2c1b…" or "Cloudflare Workers AI".
- Blocks:
  - "Received": pre, Mono M, max-height 132, overflow auto, --text-2.
  - <details> summary "Instructions and charter given to the model": Inter 13/16 --text-3, cursor pointer, margin-top 10. Expands to a pre in Mono M.
  - "Model output": pre, Mono L, --text, max-height 260, overflow auto. Typed out at max(3, len/90) chars every 18ms with a trailing caret while typing.
- Charter check row (margin-top 12, radius 8, padding 10 12, flex, gap 10):
  - Icon: 18px circle.
  - ok: background --green-bg, border 1px --green-line. Circle --green with ✓ in --on-status. Title "Charter check passed" (Inter 14/20 600 --green). Notes Inter 13/20 --text-2.
  - bad: background --red-bg, border --red-line. Circle --red with ✕ in --on-red. Title "Blocked by charter" in --red, then the notes joined with " · ".
- Sent row (margin-top 10, Inter 14/20): "→ Sent to <b>Beacon · Deal desk</b>" + code chip.
- Auto-scroll to the bottom when the reader was already within 60px of the bottom.

INVOICE CARD (canvas bottom-right; paper, light in both themes)
- Width 360 (320), padding 20, radius 12, background --paper, color --paper-text, 1px --paper-border, --paper-shadow.
- Top row (space-between): "Invoice INV-0042" (Inter 14/20 600) and a mode pill ("Stripe sandbox" / "Live" / "Simulated": mono 12/16 700 uppercase, h20, padding 0 6, radius 4, 1px solid --paper-text).
- "Beacon Analytics → Acme Corp": 14/20 --paper-text-2, margin-top 4.
- Amount "$118,000" (margin 8 0 12).
- Three rows: flex space-between, padding 8 0, border-bottom 1px --paper-line. Label --paper-text-2, value 600.
  - Purchase order: PO-2026-0412.
  - Terms: net 30 · 2% early-pay discount.
  - Status: "Sent · awaiting payment" in --paper-amber; once paid, "Paid by Acme's finance agent" in --paper-green.
- Link "Open in Stripe →": 14 600, underline, text-underline-offset 3, margin-top 12.
- PAID stamp: absolute, right 20, top 56. Border 3px solid --paper-green, color --paper-green, padding 2px 12px, radius 6, rotate(-8deg), opacity 0.
- .invoice.paid .stamp: animation stamp 260ms var(--ease-stamp) forwards (from opacity 0 scale 1.4 to opacity 1 scale 1, keeping rotate -8deg). At the same time the card border flashes to --paper-green (600ms) and settles back to --paper-border.
- Enter: opacity 0 with translateY(16px) → 0, 320ms var(--ease-out). The show/hide rules stay unchanged (hide 12s after paid).

CLOSED TAKEOVER (replaces the closed banner; position absolute, inset 0 of .stage)
- Background --scrim. display grid, place-items center, text-align center, padding 32.
- Enter: the scrim fades in over 400ms; the content goes from translateY(12px) to 0 with opacity 0 → 1 over 500ms, delay 150ms.
- Content, max-width 760, flex column, gap 8:
  - Eyebrow "Deal closed" in --green, with an 8px green dot before it.
  - Headline "3m 42s" (finishedAt − startedAt).
  - Sub "vs. 134 days for a human team".
  - Hero line "52,151× faster" (134×86400 / secs).
  - Detail row (margin-top 12, Mono 14/20 --text-2): "Beacon Analytics · $118,000/yr · 12 mo · TCV $118,000 · PO-2026-0412".
  - Buttons (margin-top 20, gap 8, centered): primary h40 "Open provisioned workspace →", ghost h40 "Stripe invoice →", ghost h40 "View graph" with kbd Esc (hides the takeover).
- No-deal variant: eyebrow "No deal" in --text-2; headline "No deal" at 64/64 700; sub "No vendor fit inside the buyer's charter, so the agents walked away."

SCALE VIEW EXTRAS
- Depth segmented control: labels "L1", "L2", "L3", "L4" (mono 12 600), each with title "Departments", "Teams", "Specialists", "Sub-specialists". Active = the current depth.
- Keys: ↑/↓ change depth, = adds a vendor, Space pauses, T theme, V live deal.
- Tour steps call setDepth(2), setDepth(3), addVendor(), addVendor() instead of clicking #grow.
- The orchestrator-to-orchestrator packet label "💬" becomes "MSG".

KEYBOARD (live view): D demo tour, S start deal, F follow, B fit, T theme, L log tab, ] toggle panel, V scale view, Enter spotlights the focused agent, Esc exits spotlight or hides the takeover. Ignore keys while an input is focused.

## graph
SOURCE OF TRUTH: graph.js drops the hardcoded THEMES and RED/GREEN/AMBER constants and reads CSS variables. Replace the THEMES block with:
const V=(n)=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
function readTheme(){return{frontier:V("--g-frontier"),open:V("--g-open"),screen:V("--g-screen"),text:V("--g-label"),strong:V("--g-company-label"),company:V("--g-company"),companyBorder:V("--g-company-line"),reports:V("--g-reports"),msg:V("--g-msg"),chan:V("--g-chan"),flash:V("--g-flash"),packetBg:V("--g-packet"),packetFg:V("--g-packet-text"),select:V("--g-select"),dot:V("--g-dot"),red:V("--red"),green:V("--green"),amber:V("--amber"),onRed:V("--on-red"),onStatus:V("--on-status")};}
- applyTheme(name) sets dataset.theme and then does T = readTheme().
- The figure cache key already includes themeName.
- Export getters so index.html's price chart uses theme().red and similar instead of RED.

FIGURES (the existing pictogram SVG keeps its geometry, only its colors change)
- Frontier figures use T.frontier (ink); open-weight figures use T.open (gray).
- work1/work2: the tablet has fill T.screen and a 1.6px stroke in T.amber, with amber bars.
- block: badge circle in T.red with a bar in T.onRed.
- done: badge circle in T.green with a check in T.onStatus.
- Node sizes: agent 36x54 (was 34x51); orchestrator (level 0) 48x72.

CYTOSCAPE STYLE (buildStyle)
- node.company:
  - background-color T.company, border-width 1.5, border-color T.companyBorder, shape round-rectangle, corner-radius 16, padding 40.
  - Label data(label) = "Acme Corp · buyer" / "Beacon Analytics · vendor".
  - text-valign top, text-halign center, text-margin-y -12, color T.strong, font-family "Inter, system-ui, sans-serif", font-size 20, font-weight 600, min-zoomed-font-size 8.
- node.agent:
  - shape rectangle, width 36, height 54, background-opacity 0, border-width 0.
  - background-image data(img), background-fit contain, background-clip node.
  - Label "role\nmodel": text-wrap wrap, text-max-width 140, text-valign bottom, text-margin-y 8.
  - color T.text, font-family Inter, font-size 12, font-weight 500, line-height 1.3, min-zoomed-font-size 8.
- node.agent[level = 0]: width 48, height 72, font-size 14, font-weight 600, color T.strong.
- node.agent.focused: underlay-color T.select, underlay-opacity 0.10, underlay-padding 8, underlay-shape round-rectangle.
- node.agent.spot: underlay-color T.select, underlay-opacity 0.16, underlay-padding 14, font-weight 700. The spotlight halo is ink, not amber, because spotlight is not a status.
- node.packet:
  - shape round-rectangle, height 20, width data(pw), background-color T.packetBg, border-width 0.
  - Label data(label): font-family "JetBrains Mono, ui-monospace, monospace", font-size 11, font-weight 700, color T.packetFg, text-valign center, text-halign center.
  - z-index 99, events no.
  - In sendPacket, set data.pw = 14 + label.length * 7.
- node.packet.bad: background-color T.red, color T.onRed.
- node.packet.money: background-color T.green, color T.onStatus.
- node.packet.dot: shape ellipse, width 6, height 6, label "", background-color T.dot.
- node.packet.dot.bad: background-color T.red.
- edge.reports: curve-style taxi, taxi-direction horizontal, taxi-turn 50%, width 1.5, line-color T.reports, events no.
- edge.msg:
  - curve-style unbundled-bezier, control-point-distances [-40], control-point-weights [0.5].
  - width mapData(w,1,12,1.5,4), line-color T.msg, line-style dashed, line-dash-pattern [6,4].
  - target-arrow-shape triangle, target-arrow-color T.msg, arrow-scale 0.8.
- edge.flash: line-color T.flash, target-arrow-color T.flash, line-style solid, width 3. .bad uses T.red; .money uses T.green. Flash lasts 900ms (unchanged).
- edge.chan (counterpart channel): curve-style unbundled-bezier, control-point-distances [30], width 1.5, line-color T.chan, line-style dotted, line-dash-pattern [2,4].
- .dim: opacity 0.12. edge.dim: opacity 0.08.

PACKET CODES (the ART map, used for packets and code chips): rfp RFP, proposal PROP, questionnaire SECQ, grade GRADE, counter CNTR, offer OFFER, redline REDLN, award AWARD, debrief DEBRF, escalate ESC, approve OK, deny DENY, signature SIGN, fraud FRAUD, po PO, invoice INV, payment PAY, provision PROV, eliminate ELIM, block BLOCK, task TASK, result RSLT, channel LINK. Default "MSG".

LAYOUT CONSTANTS: live treeLayout opts {levelGap:210, leafGap:100, stackGap:150, center:200}. This is about 15% shorter than now, so labels survive the fit at 1280x720.

SCALE VIEW EXTRA STYLE
- node.agent.mini: 12x18, font-size 9, text-margin-y 3, min-zoomed-font-size 10.
- node.agent.micro: 7x10, label "".
- edge.reports: haystack, width 1, T.reports.
- node.coname: font 26px 700 Inter, color T.strong, no background.
- Traffic packets: dot 6x6 in T.dot; 3% are .bad red.
- Orchestrator packets: code "MSG", duration 1100.

THEME SWITCH: applyTheme, then cy.style(buildStyle(extra)), then applyPoses(), then race.recolor(). This happens instantly with no transition, so the canvas and DOM never disagree.

## chart
LIBRARY: Chart.js 4.4.4 UMD, loaded in both pages as <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"></script>. Reuse /public/timechart.js (HUMAN_DAYS, fmtDuration, stage-time math) and extend it. No other chart library, no Chart.js legend, no tooltips (projector: no hover boxes).
Chart.defaults.font.family="Inter, system-ui, sans-serif"; Chart.defaults.animation=false.
Helpers: css(n) reads a CSS var; LW = parseInt(css("--race-l")); RW = parseInt(css("--race-r")).

LIVE DEAL CHART (createDealChart(canvas, headEl))
- Canvas lives in .race-plot, 100% x 140px (108 at 1280). options: responsive:true, maintainAspectRatio:false.
- labels: the 10 stages. "Closed" is not a column; it is the terminal chip.
- Dataset 0 HUMANS: cumulative HUMAN_DAYS×86400, drawn in full from deal start.
  - borderColor --chart-human, borderWidth 2.5, borderDash [6,5], pointRadius 0, tension 0.
- Dataset 1 AGENTS: the real elapsed seconds at each completed stage boundary, plus a live last point = now − startedAt. It updates every 250ms, so the line grows upward in real time.
  - borderColor --chart-agent, borderWidth 3, tension 0, pointBackgroundColor --chart-agent.
  - pointRadius: ctx => ctx.dataIndex === ctx.dataset.data.length-1 ? 0 : 3.5. The live point is the HTML head.
- layout.padding: () => ({top:12, right:RW, bottom:0, left:0}).
- scales.x: type category, offset true, grid {offset:true, color:--chart-grid, lineWidth:1, drawTicks:false}, ticks {display:false}, border {display:false}. The HTML chip row below is a 10-column grid with padding-left LW and padding-right RW, so its columns line up exactly with the category bands.
- scales.y: type logarithmic, min 1, max 200*86400.
  - afterBuildTicks sets the ticks to exactly [1,"1s"], [60,"1m"], [3600,"1h"], [86400,"1d"], [134*86400,"134d"].
  - ticks: font {family:"JetBrains Mono", size:12, weight:500}, color --text-3, padding 8.
  - grid color --chart-grid; border display false.
  - afterFit: s => { s.width = LW; }
- Scale: 1440 plot ≈ 816x128 (≈17.7px per decade); the human-agent gap is ≈3.3 decades, about 58px, at the end.

RACE PLUGIN (inline, ~60 lines; state on chart.$race = {cur, done, speedup, agentSec, closed, blocked})
1. beforeDatasetsDraw: fill the current stage column with --chart-band: x = a.left + cur*w, w = (a.right-a.left)/10, full plot height.
2. afterDatasetsDraw:
   a. Corner note at (a.left+8, a.top+10): "Time to close · log scale · human stage split illustrative", Inter 500 12px, --text-3.
   b. GAP BRACKET at the last completed stage d = done:
      - bx = x.getPixelForValue(d) + 14. Flip to −14 with the label on the left if bx + 150 > a.right.
      - Vertical 1.5px --text-2 line from y(agent[d]) to y(human[d]), with 6px horizontal end ticks.
      - Label `${speedup.toLocaleString("en-US")}× faster` in Inter 700 14px --text on a --chart-knockout rounded rect (padding 3 6, radius 4), centered at the bracket's vertical midpoint, 8px right of the line.
      - Not drawn before the first stage completes.
   c. END LABELS in the right margin, x = a.right + 12, textBaseline middle:
      - HUMANS at hy = y(134 days): "Humans" Inter 600 12px --chart-human at hy−8; "134 days" JetBrains Mono 500 12px --chart-human at hy+8.
      - AGENTS at ay = max(y(liveAgent), hy+40): "Agents" Inter 600 12px --text at ay−8; fmtDuration(agentSec) mono 500 12px --text at ay+8. Status color: --red while blocked, --green when closed.
   d. HEAD position: headEl.style.transform = `translate(${x.getPixelForValue(cur)-6}px, ${y.getPixelForValue(live)-6}px)`.
- Head element #raceHead:
  - position absolute, left 0, top 0, 12x12, radius 50%, background --amber, 2px ring in --chart-knockout (box-shadow 0 0 0 2px var(--chart-knockout)), pointer-events none.
  - ::after pulse: inset 0, radius 50%, animation pulse 1.4s var(--ease-out) infinite, keyframes from box-shadow 0 0 0 0 var(--amber-line) to 0 0 0 10px transparent.
  - body.is-blocked → background --red.
  - .race.closed → background --green, no pulse.
  - No deal → --text-3.

UPDATE LOOP: replace the old clock interval with setInterval(()=>{ if(!state) return; const k = race.update(state); renderKpis(k); renderChips(k); }, 250).
- race.update computes stageTimes from "Stage N:" events (as now).
  - agent[i] = (start of stage i+1, or of Closed) − startedAt for completed stages, and (now or finishedAt) − startedAt for the current stage.
  - cur = agent.length−1; done = state.done ? 9 : cur−1.
  - humanDone = cumHuman[done]; speedup = Math.round(humanDone / agent[done]).
- It calls chart.update("none") and returns {agentSec, humanDoneDays, speedup, cur, done, closed:state.done}.
- On close: agentSec = finishedAt − startedAt; speedup = round(134*86400 / agentSec); all chips go green.

SCALE CHART (createScaleChart(canvas, headEl), same plugin, x = messages)
- x: type logarithmic, min 10, max 1e6.
  - Ticks exactly at 10, 100, 1K, 10K, 100K, 1M: mono 12 500 --text-3; grid --chart-grid.
  - Tick labels are shown (there is no chip row), so the canvas is 172px (140 at 1280).
- y: logarithmic, min 1, max 3*31536000, ticks [1s, 1m, 1h, 1d, 30d, 1y], afterFit width LW; padding right RW.
- Data {x:messages, y:seconds}:
  - Humans: rounds × 86400. Dashed --chart-human 2.5px.
  - Agents: rounds × 1.5. Solid --chart-agent 3px.
  - rounds = ceil(messages / agents).
- Push a point when messages grow by ≥2%, and update every tick (160ms) with update("none").
- Head at the last agent point. The bracket is at the last point: "57,600× faster".
- End labels: "Humans · 1 business day per reply" and "Agents · 1.5 s per reply (measured)", each as a 2-line label (name / value).
- Growth markers: on setDepth/addVendor, push {x:messages, label:"L3"} or "+V". Draw each as a vertical 1px dashed (3 3) --line-strong line at that x across the plot, with a mono 12 --text-3 label at the top +4.
- Scale-view KPIs are filled from its return: {agentSec, humanSec, speedup, messages, agents}.

KPI TILES: specified in components. The hero speedup appears twice on purpose, as the KPI and as the bracket label.

## motion
Principle: motion only explains a state change. Theme switching is instant.

EASING AND DURATION TOKENS
- --ease-out cubic-bezier(.2,0,0,1): entrances and panels.
- --ease-in-out cubic-bezier(.4,0,.2,1): swaps.
- --ease-stamp cubic-bezier(.3,1.35,.5,1): the PAID stamp only.
- Durations: 120ms hover/press state layers; 160ms caption and chapter-title crossfade; 200ms chip segment color; 240ms new transcript call card (opacity with translateY 8→0); 260ms PAID stamp; 320ms panel width (grid-template-columns) and invoice entrance (translateY 16→0); 400ms takeover scrim; 500ms takeover content (translateY 12→0, delay 150ms); 600ms camera fitSafe (Cytoscape ease-in-out-cubic); 700ms spotlight fit; 850ms packet flight (ease-in-out-cubic, Cytoscape); 900ms edge flash hold; 900ms scale-view layout growth (unchanged).
- Loops: the chart head pulse and the running status-pill dot both use 1.4s var(--ease-out) infinite (ring 0→10px, opacity .55→0). The typing caret ▍ blinks with 1s steps(2) infinite. Figures swap the work1/work2 pose every 380ms (unchanged).

STATUS BURST
- On any fresh event with kind==="block" or art in {fraud, eliminate}: document.body.classList.add("is-blocked"); clearTimeout(bt); bt=setTimeout(()=>document.body.classList.remove("is-blocked"),1800).
- For those 1.8s the chart head, current chip segment, status-pill dot and chapter "Blocked by charter" suffix are red. The figure's block pose, the red edge flash and the red BLOCK packet come from graph.js.
- No shake and no flashing backgrounds: professional.

SEQUENCES
- Spotlight in: .main.spot (320ms width), a relayout() rAF loop, fitSafe(partners, 700), then dimming applies (opacity snaps to 0.12).
- PAID: the stamp (260ms) and the invoice border flash to paper-green (600ms, then back), plus the status row color swap (200ms).
- Close: chip segments turn green left to right with transition-delay calc(var(--i)*40ms). Then the takeover scrim (400ms) and content (500ms, delay 150ms). The status pill turns green and tile 1 gets a green border.
- Live → scale: after 9s, location.href to scale.html?tour=1. @view-transition {navigation:auto} plus view-transition-name: dock on both pages make the dock hold still while the header and canvas cross-fade (default 250ms). The chart then keeps growing with new data in the same spot.

Reduced motion: prefers-reduced-motion disables all animations and transitions (in tokens.css).

## demoMoments
Presenter setup: dark theme in a dim room and light in a lit one (T, decided at the venue). 1280x720 mirrored. Press D to run the tour. All status color comes from events; the rest of the screen stays gray, so every colored thing on screen is news.

WOW 1: the charter block (Negotiation, about 1:10 into the pitch).
- The tour spotlights the vendor deal desk. The panel widens to 480/560, and the rest of the graph dims to 12%, leaving the desk, its boss and its counterpart.
- The transcript types the model's real output: a discount the agent wants to give. The charter check row lands in red: "✕ Blocked by charter · discount 28% exceeds the 20% limit".
- In the same 1.8s window, all of these turn red:
  - the desk figure snaps to its block pose with the red badge
  - a filled red BLOCK packet flies back
  - the edge flashes red
  - the caption's left rule and code chip
  - the chart head
  - the current Negotiate segment
  - the chapter heading's "· Blocked by charter"
  - the status-pill dot
- Line: "It tried to give away 28%. Its charter says 20. The code said no, not a prompt."

WOW 2: money moves (Invoice & payment).
- The white paper invoice slides up bottom-right. In dark mode it is the brightest object in the room: "$118,000 · Sent · awaiting payment" in amber.
- A green PAY packet flies from Acme finance to the vendor desk. The green PAID stamp thuds in with a slight overshoot. The status row flips to "Paid by Acme's finance agent", and the caption rule turns green.
- The dock underneath now shows the dashed human line about 3 decades above the solid agent line, with a live bracket reading "N× faster".
- Line: "A Stripe invoice, paid by an agent, inside its own spending limit."

WOW 3: closed, then scale.
- The canvas takeover shows "3m 42s" at 128px (96 at 1280), "vs. 134 days for a human team", "52,151× faster".
- Below it, the dock stays visible: all 10 segments sweep green left to right, the Closed chip lights green, and the chart shows the full gap.
- After 9s the view transition keeps the dock pinned while the page becomes the scale simulation:
  - The org grows L1 → L2 → L3, and 2 more vendors are added.
  - The Agents KPI climbs from 21 into the thousands, and Messages races.
  - The chart's agent line extends right along the messages axis, with the bracket holding "57,600× faster".
  - Each growth step leaves an "L2"/"L3"/"+V" marker on the chart.
- Line: "Same chain of command, same gap, at 4,507 agents."

Throughout the pitch the chapter heading (28px) tells the back row the stage, and the hero KPI (40px) tells them the multiplier. Nobody has to read the graph labels to follow the story.

## buildPlan
Ordered by demo value. Each step leaves the app working, so the team can stop after any step and still demo. Files are in /Users/khalifaibrahim/Projects/deal-room/public/.

1. (5 min) Create tokens.css with the dark and light blocks, @view-transition, and reduced motion, plus the shared .btn/.seg/.code/.pill/kbd classes from components. In index.html and scale.html:
   - Add the Google Fonts preconnect and link.
   - Add <link rel="stylesheet" href="/tokens.css">.
   - Add the Chart.js 4.4.4 UMD script (jsdelivr).
   - Delete each page's inline :root and [data-theme] blocks, then rename var usages: --panel → --surface-1, --panel2 → --surface-2, --muted → --text-2, --dim → --text-3, --line2 → --line-strong.
2. (5 min) graph.js:
   - readTheme() from CSS vars; applyTheme sets T.
   - Status colors come from T (in figures and packet styles).
   - Replace the ART map with codes; add packet pw in sendPacket.
   - Style values per the graph spec: sizes 36x54 and 48x72, Inter/Mono font-family, company 20px, corner-radius 16, edge widths.
   - treeLayout opts: leafGap 100, stackGap 150.
   - In index.html: document.fonts.ready.then(() => cy.style(buildStyle())).
3. (10 min) index.html structure:
   - Header: remove .clock; move the budget input into the Options popover; add the status pill, meta, and the Scale view / Start deal / Demo tour / theme buttons.
   - .main > .left (.stage + .dock) + .side, with the grid values from layout.
   - Dock markup: .kpis (5 tiles) + .race (.race-plot with canvas and #raceHead, then ol.chips).
   - Import createDealChart from timechart.js. Add the race plugin, y afterFit and padding, x offset grid, and dataset styles.
   - Replace the clock interval with the 250ms update loop (race.update → renderKpis → renderChips).
   - Delete #steps and renderSteps.
4. (4 min) Chip row (short labels and states) and the Closed end chip. Chapter heading overlay, with the tour pill moved inside it (delete the old centered #tourPill). The body.is-blocked burst in animateEvent.
5. (3 min) Paste fitSafe and relayout(). Replace every cy.fit and fit animation with them. Wire spotlight, exit and "]" through relayout(). Add the camera .seg (Follow/Fit) and the legend.
6. (4 min) Caption: latest event only, the new card, code chip and kind rule. Invoice paper card: tokens, stamp keyframes, border flash, entrance. The has-invoice caption width.
7. (5 min) Closed takeover: replaces #closed (same element id, new markup and CSS), with the no-deal variant, Esc/"View graph" to dismiss, and the chip green sweep. Keep the tour's 9s hop to /scale.html?tour=1.
8. (3 min) Right panel restyle: tabs, agent focus (overlines, square bullets, primary spotlight button, restyled price SVG), deal log grid rows with "+mm:ss" times. Spotlight transcript: call cards, charter-check rows, typing caret.
9. (6 min) scale.html:
   - Same header shell with the SIMULATION badge and the Depth .seg; setDepth() and addVendor() replace #grow/#vendors, and the tour steps call them.
   - .left with an identical .dock; createScaleChart with log x, growth markers and KPI wiring in tick().
   - Chapter heading + footnote overlays; "MSG" packet code.
10. (3 min) Keyboard map (D S F B T L ] V Enter Esc; scale: ↑ ↓ = Space T V). QA at 1280x720 and 1440x900 in both themes:
    - no text under 12px
    - chips not clipped in spotlight
    - no node under an overlay after fitSafe
    - the red burst and the PAID stamp both fire during a full tour run.
If time runs short, cut in this order: growth markers (step 9), the invoice border flash, the legend, kbd hints. Never cut steps 1 to 4 or 7: they carry the user's chart request and wow moment 3.
