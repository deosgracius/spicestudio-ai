# tools

`extract_all.js` regenerates the embedded component library (`LIB_BJT` / `LIB_DIO` / `LIB_MOS`
in `spicestudio-ai.html`) from the LTspice standard libraries.

1. Download `standard.bjt`, `standard.dio`, `standard.mos` from
   https://github.com/HenniePeters/LTSpice (`_STANDARD/`) into this directory.
2. `node extract_all.js` → writes `lib_full.js`.
3. Replace the generated block in `spicestudio-ai.html` (marked "FULL LTspice standard-library import").

Filters: BJTs need Is+BF (sane BF range); diodes need Is; MOSFETs need Vto+Kp, with Kp
clamped to 60 A/V² because the app's Level-1 engine has no Rs/Rd (VDMOS cards assume them).
