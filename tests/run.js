// Test runner: regenerate app_extract.js, then run every test file and summarize.
const { execFileSync } = require('child_process');
const path = require('path');

const dir = __dirname;
function run(file, timeout = 30000) {
  try {
    const out = execFileSync(process.execPath, [file], { cwd: dir, timeout, encoding: 'utf8' });
    const last = out.trim().split('\n').pop();
    return { ok: true, last, out };
  } catch (e) {
    const out = (e.stdout || '') + (e.stderr || '');
    const last = out.trim().split('\n').pop() || e.message;
    return { ok: false, last, out };
  }
}

console.log('• extracting app code…');
console.log('  ' + run('extract.js').last);

// mna.js runs its own analytic self-tests when executed directly; the rest require app_extract.js
const tests = [
  'mna.js', 'netlist_test.js', 'app_harness.js', 'spectest.js', 'mostest.js',
  'qtest.js', 'oatest.js', 'logictest.js', 'routetest.js', 'hbtest.js',
  'parsetest.js', 'modeltest.js', 'bbtest.js', 'fwtest.js', 'fwtest2.js', 'layouttest.js', 'coltest.js', 'flowtest.js', 'gatetest.js', 'persisttest.js',
];

let allPass = true;
console.log('\n• running ' + tests.length + ' suites:\n');
for (const t of tests) {
  const r = run(t);
  const pass = /\d+ passed, 0 failed/.test(r.out) && !/[1-9]\d* failed/.test(r.out);
  if (!pass) allPass = false;
  const badge = pass ? 'PASS' : 'FAIL';
  console.log('  [' + badge + '] ' + t.padEnd(18) + ' ' + r.last);
  if (!pass) console.log(r.out.split('\n').filter(l => /FAIL|Error|threw/.test(l)).slice(0, 4).map(l => '        ' + l).join('\n'));
}
console.log('\n' + (allPass ? '✓ all suites passed' : '✗ some suites failed'));
process.exit(allPass ? 0 : 1);
