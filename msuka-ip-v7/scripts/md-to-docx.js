// ── Markdown -> .docx, with no dependencies ─────────────────────────────────
//
// A .docx is a zip of XML parts. Neither pandoc nor python-docx is installed
// here, so this writes both the parts and the zip container itself.
//
//   node scripts/md-to-docx.js <input.md> [more.md ...] --out <dir>
//
// Handles what these documents actually use: headings, paragraphs, bold,
// italic, inline code, bullets, numbered lists, block quotes, tables, rules,
// and checkbox lines.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ── minimal ZIP writer ──────────────────────────────────────────────────────
// Written here rather than shelled out because both Windows zippers store entry
// names with backslashes (word\document.xml). The ZIP spec requires forward
// slashes, and Word refuses to open a package that uses anything else — which is
// silent until you try to open the file.
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
const crc32 = buf => {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};

function zip(entries) {
  const locals = [], central = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');       // already forward-slashed
    const deflated = zlib.deflateRawSync(data);
    const crc = crc32(data);

    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6);
    lh.writeUInt16LE(8, 8); lh.writeUInt16LE(0, 10); lh.writeUInt16LE(0, 12);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(deflated.length, 18);
    lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nameBuf.length, 26);
    lh.writeUInt16LE(0, 28);
    locals.push(lh, nameBuf, deflated);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8); cd.writeUInt16LE(8, 10); cd.writeUInt16LE(0, 12);
    cd.writeUInt16LE(0, 14); cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(deflated.length, 20); cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28); cd.writeUInt32LE(offset, 42);
    central.push(cd, nameBuf);

    offset += lh.length + nameBuf.length + deflated.length;
  }
  const cdBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cdBuf.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([Buffer.concat(locals), cdBuf, end]);
}

const xmlEsc = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

// ── inline formatting -> runs ──────────────────────────────────────────────
function runs(text) {
  const out = [];
  // Split on **bold**, *italic*, `code`, keeping the delimiters.
  const parts = String(text).split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g).filter(Boolean);
  for (const p of parts) {
    let props = '', body = p;
    if (/^\*\*[\s\S]+\*\*$/.test(p))      { props = '<w:b/>';                       body = p.slice(2, -2); }
    else if (/^\*[\s\S]+\*$/.test(p))     { props = '<w:i/>';                       body = p.slice(1, -1); }
    else if (/^`[\s\S]+`$/.test(p))       { props = '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="19"/>'; body = p.slice(1, -1); }
    out.push(`<w:r><w:rPr>${props}</w:rPr><w:t xml:space="preserve">${xmlEsc(body)}</w:t></w:r>`);
  }
  return out.join('') || '<w:r><w:t/></w:r>';
}

const para = (text, { style, indent, spacing } = {}) =>
  `<w:p><w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ''}` +
  `${indent ? `<w:ind w:left="${indent}"/>` : ''}` +
  `${spacing ? `<w:spacing w:before="${spacing}"/>` : ''}</w:pPr>${runs(text)}</w:p>`;

function table(rows) {
  const width = 9360;
  const colW = Math.floor(width / rows[0].length);
  let x = `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="${width}" w:type="dxa"/>` +
          `<w:tblBorders>${['top','left','bottom','right','insideH','insideV']
            .map(s => `<w:${s} w:val="single" w:sz="4" w:color="999999"/>`).join('')}</w:tblBorders></w:tblPr>`;
  rows.forEach((cells, i) => {
    x += '<w:tr>';
    for (const c of cells) {
      const shade = i === 0 ? '<w:shd w:val="clear" w:fill="F2E9DC"/>' : '';
      const content = i === 0 ? `**${c}**` : c;
      x += `<w:tc><w:tcPr><w:tcW w:w="${colW}" w:type="dxa"/>${shade}</w:tcPr>` +
           `<w:p><w:pPr><w:spacing w:before="40" w:after="40"/></w:pPr>${runs(content)}</w:p></w:tc>`;
    }
    x += '</w:tr>';
  });
  return x + '</w:tbl>' + para('');
}

function mdToBody(md) {
  const lines = md.split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const ln = lines[i];

    // table: a header row followed by a |---| separator
    if (/^\s*\|/.test(ln) && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] || '')) {
      const rows = [];
      const cells = l => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      rows.push(cells(ln));
      i += 2;
      while (i < lines.length && /^\s*\|/.test(lines[i])) { rows.push(cells(lines[i])); i++; }
      out.push(table(rows));
      continue;
    }

    if (/^\s*$/.test(ln))            { i++; continue; }
    if (/^---+\s*$/.test(ln))        { out.push(para('')); i++; continue; }

    let m;
    if ((m = ln.match(/^(#{1,4})\s+(.*)$/))) {
      out.push(para(m[2].trim(), { style: 'Heading' + m[1].length }));
      i++; continue;
    }
    if ((m = ln.match(/^\s*>\s?(.*)$/))) {
      // gather the whole quote block into one indented paragraph
      const buf = [m[1]];
      i++;
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
      const text = buf.join(' ').replace(/\s+/g, ' ').trim();
      if (text) out.push(para(text, { indent: 460, spacing: 80 }));
      continue;
    }
    if ((m = ln.match(/^\s*[-*]\s+\[[ x]\]\s+(.*)$/))) {
      out.push(para('☐  ' + m[1], { indent: 360 })); i++; continue;
    }
    if ((m = ln.match(/^\s*[-*]\s+(.*)$/))) {
      out.push(para('•  ' + m[1], { indent: 360 })); i++; continue;
    }
    if ((m = ln.match(/^\s*(\d+)\.\s+(.*)$/))) {
      out.push(para(m[1] + '.  ' + m[2], { indent: 360 })); i++; continue;
    }

    // paragraph: join continuation lines
    const buf = [ln.trim()];
    i++;
    while (i < lines.length && !/^\s*$/.test(lines[i]) &&
           !/^(#{1,4}\s|\s*[-*]\s|\s*\d+\.\s|\s*>|---+\s*$|\s*\|)/.test(lines[i])) {
      buf.push(lines[i].trim()); i++;
    }
    out.push(para(buf.join(' ')));
  }
  return out.join('');
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

const heading = (id, size, colour, before) =>
  `<w:style w:type="paragraph" w:styleId="Heading${id}"><w:name w:val="heading ${id}"/>` +
  `<w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="${before}" w:after="120"/></w:pPr>` +
  `<w:rPr><w:b/><w:color w:val="${colour}"/><w:sz w:val="${size}"/></w:rPr></w:style>`;

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr>
  <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/>
</w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault>
</w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
${heading(1, 34, '6B0000', 240)}${heading(2, 28, '6B0000', 280)}
${heading(3, 24, '8B1A1A', 240)}${heading(4, 22, '8B1A1A', 200)}
<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/></w:style>
</w:styles>`;

function build(mdPath, outDir) {
  const md = fs.readFileSync(mdPath, 'utf8');
  const name = path.basename(mdPath, '.md');
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${mdToBody(md)}
<w:sectPr><w:pgSz w:w="12240" w:h="15840"/>
<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
</w:body></w:document>`;

  // Forward slashes, and [Content_Types].xml first — both are OPC requirements.
  const buf = zip([
    { name: '[Content_Types].xml',        data: Buffer.from(CONTENT_TYPES, 'utf8') },
    { name: '_rels/.rels',                data: Buffer.from(RELS, 'utf8') },
    { name: 'word/document.xml',          data: Buffer.from(doc, 'utf8') },
    { name: 'word/styles.xml',            data: Buffer.from(STYLES, 'utf8') },
    { name: 'word/_rels/document.xml.rels', data: Buffer.from(DOC_RELS, 'utf8') },
  ]);
  const out = path.join(outDir, name + '.docx');
  fs.writeFileSync(out, buf);
  return out;
}

const args = process.argv.slice(2);
const oi = args.indexOf('--out');
const outDir = oi >= 0 ? args[oi + 1] : '.';
const inputs = (oi >= 0 ? args.slice(0, oi) : args);
fs.mkdirSync(outDir, { recursive: true });
for (const f of inputs) {
  const o = build(f, outDir);
  console.log('  ' + path.basename(o) + '  (' + Math.round(fs.statSync(o).size / 1024) + ' KB)');
}
