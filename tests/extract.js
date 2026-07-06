// Pull the <script> block out of ../spicestudio-ai.html into app_extract.js so the app-level
// tests can require the real app code in Node (with a DOM/canvas stub).
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'spicestudio-ai.html'), 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error('no <script> block found'); process.exit(1); }
fs.writeFileSync(path.join(__dirname, 'app_extract.js'), m[1]);
console.log('extracted app_extract.js (' + m[1].split('\n').length + ' lines)');
