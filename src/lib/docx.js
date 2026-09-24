// Just enough of the .docx format to import and hand out the member roster,
// with no dependencies: a .docx is a ZIP archive whose text lives in
// word/document.xml. Reading inflates that one entry with the platform's
// DecompressionStream; writing stores entries uncompressed, which every Word
// version opens. Runs in the browser and under `node --test`.

const te = new TextEncoder()
const td = new TextDecoder()

// ── Reading ──────────────────────────────────────────────────
async function inflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

// Returns the bytes of one named entry, found through the ZIP's central
// directory (local headers may omit sizes when a data descriptor is used).
async function zipEntry(buffer, wanted) {
  const bytes = new Uint8Array(buffer)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let eocd = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('That file isn’t a Word document (.docx). Save it as .docx and try again.')
  const count = view.getUint16(eocd + 10, true)
  let p = view.getUint32(eocd + 16, true)
  for (let n = 0; n < count; n++) {
    if (view.getUint32(p, true) !== 0x02014b50) break
    const method = view.getUint16(p + 10, true)
    const compSize = view.getUint32(p + 20, true)
    const nameLen = view.getUint16(p + 28, true)
    const extraLen = view.getUint16(p + 30, true)
    const commentLen = view.getUint16(p + 32, true)
    const localOffset = view.getUint32(p + 42, true)
    const name = td.decode(bytes.subarray(p + 46, p + 46 + nameLen))
    if (name === wanted) {
      const lNameLen = view.getUint16(localOffset + 26, true)
      const lExtraLen = view.getUint16(localOffset + 28, true)
      const start = localOffset + 30 + lNameLen + lExtraLen
      const data = bytes.subarray(start, start + compSize)
      if (method === 0) return data
      if (method === 8) return inflateRaw(data)
      throw new Error('This Word document uses an unsupported compression. Re-save it from Word or Google Docs as .docx.')
    }
    p += 46 + nameLen + extraLen + commentLen
  }
  throw new Error('No document text found — is this a Word (.docx) file?')
}

const unescapeXml = (s) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, '&')

// The visible text of an XML fragment: every <w:t> run, with tabs and breaks
// kept as spaces so neighbouring words don't fuse.
function runText(xml) {
  let out = ''
  const re = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:(?:tab|br)\b[^>]*\/>/g
  let m
  while ((m = re.exec(xml))) out += m[1] != null ? unescapeXml(m[1]) : ' '
  return out
}

const blocks = (xml, tag) => xml.match(new RegExp(`<w:${tag}\\b[\\s\\S]*?</w:${tag}>`, 'g')) || []

// Everything a roster import needs from a .docx: the rows of every table (one
// array of cell strings per row) and, for documents without a table, the text
// of each paragraph.
export async function readDocx(buffer) {
  const xml = td.decode(await zipEntry(buffer, 'word/document.xml'))
  const tableRows = []
  for (const tbl of blocks(xml, 'tbl')) {
    for (const tr of blocks(tbl, 'tr')) tableRows.push(blocks(tr, 'tc').map((tc) => runText(tc).trim()))
  }
  const outside = xml.replace(/<w:tbl\b[\s\S]*?<\/w:tbl>/g, '')
  const paragraphs = blocks(outside, 'p').map((p) => runText(p).trim()).filter(Boolean)
  return { tableRows, paragraphs }
}

// ── Writing ──────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(bytes) {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

// A ZIP of uncompressed ("stored") entries: [{ name, data: string }].
export function zipStore(files) {
  const parts = []
  const central = []
  let offset = 0
  for (const f of files) {
    const name = te.encode(f.name)
    const data = te.encode(f.data)
    const crc = crc32(data)
    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true)
    local.setUint16(4, 20, true)
    local.setUint32(14, crc, true)
    local.setUint32(18, data.length, true)
    local.setUint32(22, data.length, true)
    local.setUint16(26, name.length, true)
    parts.push(new Uint8Array(local.buffer), name, data)
    const cen = new DataView(new ArrayBuffer(46))
    cen.setUint32(0, 0x02014b50, true)
    cen.setUint16(4, 20, true)
    cen.setUint16(6, 20, true)
    cen.setUint32(16, crc, true)
    cen.setUint32(20, data.length, true)
    cen.setUint32(24, data.length, true)
    cen.setUint16(28, name.length, true)
    cen.setUint32(42, offset, true)
    central.push(new Uint8Array(cen.buffer), name)
    offset += 30 + name.length + data.length
  }
  const cenSize = central.reduce((s, b) => s + b.length, 0)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true)
  end.setUint16(8, files.length, true)
  end.setUint16(10, files.length, true)
  end.setUint32(12, cenSize, true)
  end.setUint32(16, offset, true)
  const all = [...parts, ...central, new Uint8Array(end.buffer)]
  const out = new Uint8Array(all.reduce((s, b) => s + b.length, 0))
  let p = 0
  for (const b of all) { out.set(b, p); p += b.length }
  return out
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const para = (text, { bold = false, size } = {}) =>
  `<w:p><w:r>${bold || size ? `<w:rPr>${bold ? '<w:b/>' : ''}${size ? `<w:sz w:val="${size}"/>` : ''}</w:rPr>` : ''}<w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`
const cell = (text, bold) => `<w:tc><w:tcPr><w:tcW w:w="3000" w:type="dxa"/></w:tcPr>${para(text, { bold })}</w:tc>`
const border = (side) => `<w:${side} w:val="single" w:sz="4" w:space="0" w:color="999999"/>`

// A Word document: a title, instruction paragraphs, then one table whose
// first row is the header.
export function buildDocx({ title, lines = [], header = [], rows = [] }) {
  const table =
    `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(border).join('')}</w:tblBorders></w:tblPr>` +
    `<w:tr>${header.map((h) => cell(h, true)).join('')}</w:tr>` +
    rows.map((r) => `<w:tr>${r.map((c) => cell(c, false)).join('')}</w:tr>`).join('') +
    '</w:tbl>'
  const body = para(title, { bold: true, size: 32 }) + lines.map((l) => para(l)).join('') + table + '<w:sectPr/>'
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`
  return zipStore([
    {
      name: '[Content_Types].xml',
      data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    },
    {
      name: '_rels/.rels',
      data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    },
    { name: 'word/document.xml', data: document },
  ])
}
