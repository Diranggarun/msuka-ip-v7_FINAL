// ── Generate the Entity-Relationship Diagram from the live schema ────────────
//
// Figure 3.5 in the capstone paper has to match the database it documents, and
// a hand-drawn diagram drifts the moment a column is added. This reads the real
// tables, columns and foreign keys and emits two files into docs/:
//
//   erd.mmd  — Mermaid source (paste into mermaid.live to export PNG/SVG)
//   erd.svg  — a self-contained SVG, ready to drop straight into Word
//
//   node scripts/make-erd.js
//
const fs = require('fs');
const path = require('path');
const db = require('../db');

// Left-to-right column layout. users sits in the middle because six of the
// seven relationships terminate on it; survey_responses is placed apart
// because it deliberately has none.
const LAYOUT = [
  ['groups_table', 'group_members'],
  ['users'],
  ['messages', 'calls', 'audit_logs'],
  ['survey_responses'],
];

const NOTE = {
  users: 'Accounts, roles, bcrypt hash,\nand the token version used\nfor session revocation.',
  messages: 'One row per message.\nBody encrypted at rest\n(AES-256-GCM).',
  groups_table: 'Group chats.',
  group_members: 'Resolves users <-> groups.\nUNIQUE(group_id, user_id).',
  calls: 'Voice call records.\nAudio is peer-to-peer and\nis never stored.',
  audit_logs: 'Security-relevant actions\nwith actor, IP and device.\n(RA 10173 s.20)',
  survey_responses: 'Evaluation results.\nNO link to users — that\nabsence is what makes the\nsurvey anonymous.',
};

(async () => {
  const [tables] = await db.query(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");

  const schema = {};
  const rels = [];
  for (const { name } of tables) {
    const [cols] = await db.query(`PRAGMA table_info(${name})`);
    const [fks] = await db.query(`PRAGMA foreign_key_list(${name})`);
    schema[name] = cols.map(c => ({
      name: c.name,
      type: (c.type || 'TEXT').toUpperCase(),
      pk: !!c.pk,
      fk: fks.some(f => f.from === c.name),
    }));
    for (const f of fks) rels.push({ from: name, col: f.from, to: f.table, toCol: f.to });
  }

  // ── Mermaid ───────────────────────────────────────────────────────────────
  let mmd = 'erDiagram\n';
  for (const [t, cols] of Object.entries(schema)) {
    mmd += `    ${t} {\n`;
    for (const c of cols) {
      const key = c.pk ? ' PK' : c.fk ? ' FK' : '';
      mmd += `        ${c.type.toLowerCase()} ${c.name}${key}\n`;
    }
    mmd += '    }\n';
  }
  for (const r of rels) {
    // one-to-many from the referenced table to the referencing one
    mmd += `    ${r.to} ||--o{ ${r.from} : "${r.col}"\n`;
  }

  // ── SVG ───────────────────────────────────────────────────────────────────
  const ROW_H = 17, HEAD_H = 26, PAD = 10, COL_W = 232, COL_GAP = 74, TOP = 60;
  const box = {};
  let x = 40;
  const colX = [];
  for (const col of LAYOUT) {
    colX.push(x);
    let y = TOP;
    for (const t of col) {
      const h = HEAD_H + schema[t].length * ROW_H + PAD;
      box[t] = { x, y, w: COL_W, h };
      y += h + 46;
    }
    x += COL_W + COL_GAP;
  }
  // vertically centre each column against the tallest
  const colBottom = LAYOUT.map(col => Math.max(...col.map(t => box[t].y + box[t].h)));
  const tallest = Math.max(...colBottom);
  LAYOUT.forEach((col, i) => {
    const shift = (tallest - colBottom[i]) / 2;
    col.forEach(t => { box[t].y += shift; });
  });

  const W = x - COL_GAP + 40;
  const H = tallest + 60;
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Segoe UI, Arial, sans-serif">
<rect width="${W}" height="${H}" fill="#ffffff"/>
<text x="${W / 2}" y="34" text-anchor="middle" font-size="17" font-weight="700" fill="#4a0000">MSUkaIP — Entity-Relationship Diagram</text>
<defs><marker id="crow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto">
  <path d="M0,5 L9,0 M0,5 L9,5 M0,5 L9,10" stroke="#6B0000" fill="none" stroke-width="1.2"/></marker></defs>\n`;

  // relationship lines first, so boxes paint over the ends
  for (const r of rels) {
    const a = box[r.to], b = box[r.from];
    if (!a || !b) continue;
    const ax = a.x + a.w, ay = a.y + a.h / 2;
    const bx = b.x, by = b.y + b.h / 2;
    const from = ax < bx ? { x: ax, y: ay } : { x: a.x, y: ay };
    const to = ax < bx ? { x: bx, y: by } : { x: b.x + b.w, y: by };
    const mid = (from.x + to.x) / 2;
    svg += `<path d="M${from.x},${from.y} C${mid},${from.y} ${mid},${to.y} ${to.x},${to.y}" `
        +  `stroke="#6B0000" fill="none" stroke-width="1.3" marker-end="url(#crow)" opacity=".75"/>\n`;
  }

  for (const [t, cols] of Object.entries(schema)) {
    const b = box[t];
    if (!b) continue;
    svg += `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="7" fill="#fff" stroke="#6B0000" stroke-width="1.4"/>\n`;
    svg += `<path d="M${b.x},${b.y + HEAD_H} h${b.w}" stroke="#6B0000" stroke-width="1.1"/>\n`;
    svg += `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${HEAD_H}" rx="7" fill="#6B0000"/>\n`;
    svg += `<rect x="${b.x}" y="${b.y + HEAD_H - 8}" width="${b.w}" height="8" fill="#6B0000"/>\n`;
    svg += `<text x="${b.x + 10}" y="${b.y + 18}" font-size="12.5" font-weight="700" fill="#FFD700">${esc(t)}</text>\n`;
    cols.forEach((c, i) => {
      const ty = b.y + HEAD_H + 13 + i * ROW_H;
      const key = c.pk ? 'PK' : c.fk ? 'FK' : '';
      svg += `<text x="${b.x + 10}" y="${ty}" font-size="10.5" fill="#2a1a0a"${c.pk ? ' font-weight="700"' : ''}>${esc(c.name)}</text>\n`;
      svg += `<text x="${b.x + b.w - 10}" y="${ty}" font-size="9" text-anchor="end" fill="#8a7a6a">${esc(c.type)}${key ? ' ' + key : ''}</text>\n`;
    });
    const note = NOTE[t];
    if (note) {
      note.split('\n').forEach((ln, i) => {
        svg += `<text x="${b.x}" y="${b.y + b.h + 13 + i * 11}" font-size="9" fill="#7a6a5a">${esc(ln)}</text>\n`;
      });
    }
  }
  svg += '</svg>\n';

  const out = path.join(__dirname, '..', '..', 'docs');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'erd.mmd'), mmd);
  fs.writeFileSync(path.join(out, 'erd.svg'), svg);

  console.log(`tables: ${Object.keys(schema).length}  relationships: ${rels.length}`);
  rels.forEach(r => console.log(`   ${r.to}.${r.toCol} 1--N ${r.from}.${r.col}`));
  const orphan = Object.keys(schema).filter(t => !rels.some(r => r.from === t || r.to === t));
  console.log('no relationships:', orphan.join(', ') || '(none)');
  console.log(`wrote docs/erd.mmd and docs/erd.svg (${W}x${H})`);
})();
