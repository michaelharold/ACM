import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeMemberId, isUsableMemberId, parseRosterRows, textToRows, rosterVerdict, maskEmail } from '../../src/lib/memberRoster.js'
import { buildDocx, readDocx, zipStore } from '../../src/lib/docx.js'
import { deflateRawSync } from 'node:zlib'

test('membership IDs compare without case, spaces or stray punctuation', () => {
  assert.equal(normalizeMemberId(' acm 12/34 '), 'ACM1234')
  assert.equal(normalizeMemberId('1234567'), '1234567')
  assert.equal(isUsableMemberId('  '), false)
  assert.equal(isUsableMemberId('--'), false)
  assert.equal(isUsableMemberId('A-1'), true)
})

test('a header row picks the columns, in any order', () => {
  const { entries, skipped } = parseRosterRows([
    ['Name', 'Email address', 'Membership ID'],
    ['Asha K', 'Asha.K@TKMCE.ac.in', '1234567'],
    ['Ravi', 'ravi@gmail.com', ' 76543 21 '],
  ])
  assert.deepEqual(entries, [
    { rosterId: '1234567', membershipId: '1234567', email: 'asha.k@tkmce.ac.in', name: 'Asha K' },
    { rosterId: '7654321', membershipId: '7654321', email: 'ravi@gmail.com', name: 'Ravi' },
  ])
  assert.equal(skipped.length, 0)
})

test('without a header, the email and the ID are recognised by shape', () => {
  const { entries } = parseRosterRows(textToRows('Asha K, asha@tkmce.ac.in, 1234567\n\n7654321;ravi@gmail.com'))
  assert.deepEqual(entries.map((e) => [e.membershipId, e.email, e.name]), [
    ['1234567', 'asha@tkmce.ac.in', 'Asha K'],
    ['7654321', 'ravi@gmail.com', ''],
  ])
})

test('bad rows are reported, sample rows and prose are ignored, duplicates keep the last', () => {
  const { entries, skipped } = parseRosterRows([
    ['Membership ID', 'Email', 'Name'],
    ['1111111', 'sample@example.com', 'Sample (delete me)'],
    ['2222222', 'not-an-email', 'X'],
    ['', 'nobody@tkmce.ac.in', 'Y'],
    ['3333333', 'old@tkmce.ac.in', 'Z'],
    ['3333333', 'new@tkmce.ac.in', 'Z'],
  ])
  assert.deepEqual(entries.map((e) => e.email), ['new@tkmce.ac.in'])
  assert.deepEqual(skipped.map((s) => s.reason), ['No valid email address', 'No usable membership ID'])
  assert.equal(parseRosterRows([['Put one member on each row of the table below.']]).entries.length, 0)
})

test('roster verdicts', () => {
  const entry = { membershipId: '1234567', email: 'asha@tkmce.ac.in' }
  assert.equal(rosterVerdict(entry, 'ASHA@tkmce.ac.in'), 'match')
  assert.equal(rosterVerdict(entry, 'other@gmail.com'), 'email-mismatch')
  assert.equal(rosterVerdict(null, 'asha@tkmce.ac.in'), 'not-found')
  assert.equal(maskEmail('someone@tkmce.ac.in'), 'so•••@tkmce.ac.in')
})

test('the generated template round-trips through the .docx reader', async () => {
  const bytes = buildDocx({
    title: 'Roster',
    lines: ['Instructions & notes <here>'],
    header: ['Membership ID', 'Email', 'Name'],
    rows: [['1234567', 'asha@tkmce.ac.in', 'Asha & Co']],
  })
  const { tableRows, paragraphs } = await readDocx(bytes.buffer)
  assert.deepEqual(tableRows, [['Membership ID', 'Email', 'Name'], ['1234567', 'asha@tkmce.ac.in', 'Asha & Co']])
  assert.deepEqual(paragraphs, ['Roster', 'Instructions & notes <here>'])
  assert.equal(parseRosterRows(tableRows).entries.length, 1)
})

test('reads a deflate-compressed document.xml, as Word writes it', async () => {
  const xml = '<w:document xmlns:w="x"><w:body><w:tbl><w:tr><w:tc><w:p><w:r><w:t>98</w:t></w:r><w:r><w:t xml:space="preserve">76</w:t></w:r></w:p></w:tc><w:tc><w:p><w:hyperlink><w:r><w:t>a@b.co</w:t></w:r></w:hyperlink></w:p></w:tc></w:tr></w:tbl></w:body></w:document>'
  // Build a one-entry ZIP by hand with method 8 (deflate).
  const stored = zipStore([{ name: 'word/document.xml', data: xml }])
  const data = deflateRawSync(Buffer.from(xml))
  const view = new DataView(stored.buffer)
  const nameLen = 'word/document.xml'.length
  const local = stored.slice(0, 30 + nameLen)
  const lv = new DataView(local.buffer)
  lv.setUint16(8, 8, true)
  lv.setUint32(18, data.length, true)
  const cenStart = 30 + nameLen + xml.length
  const central = stored.slice(cenStart, cenStart + 46 + nameLen)
  const cv = new DataView(central.buffer)
  cv.setUint16(10, 8, true)
  cv.setUint32(20, data.length, true)
  const end = stored.slice(stored.length - 22)
  const ev = new DataView(end.buffer)
  ev.setUint32(16, local.length + data.length, true)
  const zip = new Uint8Array([...local, ...data, ...central, ...end])
  assert.equal(view.getUint32(0, true), 0x04034b50)
  const { tableRows } = await readDocx(zip.buffer)
  assert.deepEqual(tableRows, [['9876', 'a@b.co']])
})

test('a non-docx file is refused with a readable message', async () => {
  await assert.rejects(readDocx(new TextEncoder().encode('hello').buffer), /isn’t a Word document/)
})
