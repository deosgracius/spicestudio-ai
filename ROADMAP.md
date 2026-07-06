# SpiceStudio → "KiCad + Fritzing + Wokwi" — build roadmap

Goal: fuse three tools into one browser app, all driven by ONE circuit model:
- **PCB layout + Gerber + 3D** → KiCad's core
- **Breadboard view** → Fritzing
- **Firmware running on the circuit** → Wokwi / Proteus

Everything below hangs off the netlist that already works today in `spicestudio-ai.html`.

---

## 0. Where we are (what is already real)

`spicestudio-ai.html` today:
- `S.comps` / `S.wires` — the schematic data model
- `extractNets()` — union-find net extraction (pin/wire grid points → nets)
- `buildCircuit()` — netlister → MNA engine (DC / transient / AC), all verified in Node
- AI copilot (local engine + optional Claude API)

The netlist (`nets.pinNet`: `compUid:pinIndex → netName`) is the shared input every new view needs. That is the whole reason these are now tractable instead of fake.

---

## PHASE 0 — Shared foundation (do this FIRST; ~2–3 days)

All three features need two upgrades to the core model. Build once, reuse three times.

### 0.1 Named, positioned pins
Today a 2-pin part has anonymous pins at `[-1,0],[1,0]`. ICs, MCUs, and footprints need **named** pins.

```js
PARTS.LM358 = {
  pins: [ {name:'OUT1',dx:-2,dy:-1}, {name:'IN1-',dx:-2,dy:0}, ... ], // schematic pin geometry
  footprint: 'SOIC-8',                                                 // → PCB
  package:   'DIP-8',                                                  // → breadboard
  mcu:       null,                                                     // → firmware (set for ATmega328P etc.)
}
```
`pinCoords()` and `extractNets()` generalize from index `0/1` to pin `name`. `nets.pinNet` key becomes `compUid:pinName`. This is the one breaking change — everything else is additive.

### 0.2 Unified connectivity object
One function every view consumes:
```js
getConnectivity() -> {
  nets: [ {name, pins:[{ref, pin}]} ],   // net → the pads/holes/MCU-pins on it
  parts:[ {ref, type, footprint, package, mcu, value} ]
}
```
PCB ratsnest, breadboard auto-wiring, and firmware pin-mapping are all just different renderings of this.

### 0.3 Multi-view shell
Add a top tab bar: **Schematic · PCB · Breadboard · Firmware**. All share `S.comps` + connectivity; each keeps its own layout state (`S.pcb`, `S.bb`, `S.fw`). Switching tabs never re-derives the circuit — it's one source of truth.

---

## PHASE 1 — PCB layout + Gerber (KiCad core) — ~1.5–2 weeks

**Reference:** KiCad Pcbnew.

### Data model
```js
S.pcb = {
  boardW, boardH,                    // mm
  footprints: [ {ref, fp, x, y, rot, layer, pads:[{name,x,y,shape,w,h,drill,net}]} ],
  tracks:     [ {layer, net, pts:[[x,y]...], width} ],
  vias:       [ {x,y,drill,net} ],
  zones:      [ {layer, net, poly} ],   // copper pours (later)
}
```

### Pieces, in order
1. **Footprint library** — start with ~10: axial (R/D), radial (C/LED), SOIC-8, DIP-8/14/28, SOT-23, 2-pin header, TO-92. Each = pad list in mm.
2. **Auto-place** — one footprint per schematic part; grid layout; pads inherit net from `getConnectivity()`.
3. **Ratsnest** — thin lines pad↔pad for every net not yet copper-connected. This is the "airwire" that makes it feel like KiCad. Recompute on drag.
4. **Interactive routing** — click pad → click pad → orthogonal/45° track on the active copper layer; snap to grid; drop vias to switch layers.
5. **DRC-lite** — unrouted count, track-to-track clearance check, pad overlap. Show a live "N unrouted / M violations" badge.
6. **Export** — **Gerber RS-274X** per copper layer + **Excellon drill** file, zipped. This is a real, testable text format.
7. **3D preview (optional)** — extrude board + simple part bodies in WebGL (three.js) from footprint outlines.

### Verification (headless, like the engine)
- Ratsnest count == (Σ pins per net − 1) summed over nets, before any routing.
- A hand-routed 2-net board → Gerber parses (aperture defs + D-codes well-formed) and pad coords match.
- DRC flags a deliberately overlapping pad pair.

**Risk:** interactive routing UX is fiddly; Gerber spec details (apertures, polarity). Both are well-documented, no research risk.

---

## PHASE 2 — Breadboard view (Fritzing) — ~1 week

**Reference:** Fritzing breadboard.

### Data model
```js
S.bb = {
  holes: 63 columns × (2 rails + 10 tie-points),   // standard half+ board
  placements: [ {ref, package, col, row, rot} ],   // where each part sits
  jumpers:    [ {from:[col,row], to:[col,row], color} ],
}
```

### Pieces
1. **Board render** — the classic breadboard: two power rails top/bottom, center gap, tie-point columns (each column of 5 holes internally connected).
2. **Package placement** — DIP straddles the center gap; axial/radial parts span holes; leads snap to holes.
3. **Auto-jumper from netlist** — for each net in `getConnectivity()`, drop jumper wires connecting the columns its pins land in (nets already known — no routing logic needed, just visual wiring). Rails auto-bind to VCC/GND nets.
4. **Manual edit** — drag parts to holes, add/recolor jumpers, and (nice touch) **feed the resulting connectivity back into the simulator** so the breadboard is also live.

### Verification
- Column-equivalence: two pins in the same tie-point column resolve to the same net.
- Auto-jumpered breadboard of the LED demo → same netlist as the schematic → same DC solve (10 mA). This proves breadboard ≡ schematic.

**Risk:** low. Mostly rendering + a fixed connectivity model.

---

## PHASE 3 — Firmware / MCU co-simulation (Wokwi) — ~2–4 weeks (hardest)

**Reference:** Wokwi (uses `avr8js`), Proteus.

### The real version
Run **actual AVR machine code** on an emulated ATmega328P, with its pins wired into the analog solver.

1. **MCU emulator** — integrate [`avr8js`](https://github.com/wokwi/avr8js) (MIT, browser-ready): cycle-accurate AVR core + GPIO/timer/ADC/UART peripherals.
2. **Pin bridge** — the MCU is just more parts on the netlist:
   - A **digital output pin** high/low → a `V` source (0 V / 5 V) on that pin's net, re-stamped when the pin toggles.
   - `analogRead(A0)` → sample the solved node voltage on A0's net, feed the emulator's ADC register.
   - This is exactly why Phase 0's named pins matter: `PD13 → net`, `ADC0 → net`.
3. **Co-sim loop** — run the analog transient and the MCU clock on a shared timeline; the MCU steps at its cycle rate, the solver advances Δt, they exchange pin states each step (mixed-signal event loop).
4. **Code editor + build** — this is the real snag. Options, honest tradeoffs:
   - **(a) Precompiled `.hex` upload** — simplest; user compiles in Arduino IDE, drops the hex in. Ships first.
   - **(b) Hosted compile API** — POST `.ino` to a cloud `avr-gcc` (Wokwi/PlatformIO-style) → hex. Best UX, needs a backend.
   - **(c) JS Arduino-API shim** — reinterpret `setup()/loop()` in JS (no real compilation). Fast, but it's emulating the *sketch*, not the silicon — less authentic. Good as a fallback tier.

### Verification
- Blink sketch → D13 net toggles at the coded interval in the transient trace.
- `analogRead` of a divider node returns the expected 0–1023 code.
- PWM `analogWrite(128)` → 50% duty on the pin net (already have the RC-filter demo to average it).

**Risks:** (1) real-time performance of mixed-signal co-sim in JS; (2) the compile story (start with hex upload). No unknown-unknowns — avr8js is proven (it's what Wokwi ships).

---

## Cross-cutting: one project file

A single `.ssct` JSON holding `{schematic, pcb, breadboard, firmware}` + versioned. Plus importers/exporters that make it interoperable, each independently testable:
- Export **KiCad netlist** (`.net`), **Gerber/drill**, **`.ino`**.
- Import **SPICE `.lib`/`.subckt`** model cards (ties back to the LTspice/Würth libraries you linked).

---

## Suggested build order & effort

| # | Feature | Effort | Unlocks |
|---|---------|--------|---------|
| 0 | Shared foundation (named pins, connectivity, tab shell) | 2–3 d | everything |
| 1 | PCB + ratsnest + Gerber | 1.5–2 wk | KiCad parity core |
| 2 | Breadboard | ~1 wk | maker/teaching |
| 3 | Firmware co-sim (hex-upload tier first) | 2–4 wk | Wokwi parity |
| — | `.ssct` file + KiCad/Gerber/ino I/O | ongoing | interoperability |

**Discipline that carries over:** every phase gets headless Node tests (netlist→ratsnest counts, Gerber syntax, breadboard net-equivalence, firmware pin toggles) *before* the UI is trusted — the same method that caught the diode/LED bug in the engine.

Recommended first concrete step: **Phase 0 + Phase 1 ratsnest** — placing footprints and drawing airwires from the netlist is the single most convincing "this is really KiCad" moment, and it's only a few days on top of what exists.
