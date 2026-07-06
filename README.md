# SpiceStudio AI

A **browser-native circuit simulator + schematic editor with an AI copilot** — a single, self-contained HTML file (`spicestudio-ai.html`). Open it in any browser; no install, no build, no backend.

It's a real analog/mixed-signal EDA tool: whatever you draw (or describe, or paste) is turned into a netlist and solved with a from-scratch **Modified Nodal Analysis (MNA)** engine, so editing a value actually changes the waveform.

## Features

**Simulation engine (MNA, verified against analytic results)**
- DC operating point, transient (Backward-Euler companion models), and AC sweep (complex MNA, small-signal linearized at the DC op-point).
- Devices: R, C, L, diodes/LEDs (Shockley + SPICE `pnjlim` limiting), **MOSFETs** (Level-1 Shichman-Hodges), **BJTs** (Ebers-Moll), ideal **op-amp** (VCVS), and independent V/I sources (DC, sine, pulse/PWM). Damped Newton for robust convergence.

**Schematic editor**
- Drag-and-drop parts, wire pin-to-pin, rotate, edit values, delete.
- Union-find **net extraction**, drag-to-pan, and "Fit" to frame the whole circuit.
- **Auto-router** that turns an abstract netlist into real wires (with pin-escape routing and **hop-over jumpers** at crossings), verifying connectivity per-net and falling back to a label only where a wire would be unsafe.

**AI copilot** — three input paths, no key required for most:
- Built-in builders for common circuits (filters, rectifiers, LED driver, divider, Sallen-Key, CMOS logic, H-bridge…).
- Paste a **SPICE netlist** (`R/C/L/D/M/Q/V/I/E` + `.model` + `.ac/.tran`) → it builds and simulates.
- Paste a clean **`COMPONENTS:/NETS:`** structured block.
- Optional: connect an Anthropic API key to design *arbitrary* circuits from a natural-language description.

**Other views**
- **PCB** — footprints, ratsnest from the netlist, copper routing, vias, DRC, RS-274X Gerber + Excellon drill export, and a 3D board preview.
- **Breadboard** — auto-built from the schematic (connectivity mirrors the netlist).
- **Firmware** — a JS Arduino runtime: write a sketch, watch pins toggle and an LED blink, with a serial monitor.

See [`ROADMAP.md`](ROADMAP.md) for the plan toward full KiCad + Fritzing + Wokwi parity.

## Run it

Just open `spicestudio-ai.html` in a browser. (Some browsers cache `file://` aggressively — if you edit the file, hard-reload with `Ctrl+Shift+R`, or serve it over HTTP.)

## Tests

The numerical core and the app logic are verified headlessly in Node — the MNA engine is checked against analytic results (resistor divider, RC decay, diode drop, MOSFET/BJT bias and gain, AC −3 dB points), and the app's real code (netlister, auto-router, parsers, builders) is exercised with a DOM stub.

```bash
npm install     # installs @napi-rs/canvas (used by the render-based tests)
npm test        # regenerates tests/app_extract.js from the app, then runs all suites
```

## License

MIT
