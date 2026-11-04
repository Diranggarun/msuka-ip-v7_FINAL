// Check that every "Find" string occurs in the paper exactly once, so the
// student's Ctrl+H lands on the right sentence.
// Usage: node verify-finds.js <paper.txt> <finds.json>
//   finds.json is an array of strings.
const fs = require('fs');

const [paperPath, findsPath] = process.argv.slice(2);
if (!paperPath || !findsPath) {
  console.error('usage: node verify-finds.js <paper.txt> <finds.json>');
  process.exit(1);
}

// The Drive extraction adds markdown (bold markers, escaped brackets) that is
// not in the real document, so compare against a cleaned copy.
const clean = (s) => s.replace(/\*\*/g, '').replace(/\\([[\]_*!&`<>-])/g, '$1').replace(/<comment_(start|end) id=[^>]+>/g, '');
const paper = clean(fs.readFileSync(paperPath, 'utf8'));
const finds = JSON.parse(fs.readFileSync(findsPath, 'utf8'));

let bad = 0;
for (const f of finds) {
  const count = paper.split(f).length - 1;
  if (count !== 1) {
    bad++;
    console.log(`${count === 0 ? 'NOT FOUND' : `FOUND ${count}x`}: ${f.slice(0, 90)}`);
  }
}
console.log(`${finds.length - bad}/${finds.length} find strings OK`);
process.exit(bad ? 1 : 0);
