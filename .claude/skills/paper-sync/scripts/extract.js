// Pull the paper text and comments out of a saved Drive read_file_content result.
// Usage: node extract.js <saved-result.json> <out-dir>
// Writes paper.txt (the document text) and comments.json (comment threads).
const fs = require('fs');
const path = require('path');

const [src, outDir] = process.argv.slice(2);
if (!src || !outDir) {
  console.error('usage: node extract.js <saved-result.json> <out-dir>');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(src, 'utf8'));
fs.writeFileSync(path.join(outDir, 'paper.txt'), data.fileContent || '');
fs.writeFileSync(path.join(outDir, 'comments.json'), JSON.stringify(data.commentThreads || [], null, 2));

const open = (data.commentThreads || []).filter(c => c.status === 'OPEN');
console.log(`${data.title}: ${(data.fileContent || '').length} chars, ${open.length} open comments`);
for (const c of open) console.log(`- [${c.commentId}] ${c.headPost.authorName}: ${c.headPost.content.slice(0, 80)}`);
