import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TEXT_SECTIONS, TEXT_FIELDS, resolveText, savedText, validateText, searchFields, NONE, ACM_GLOBAL_URL, isWebUrl } from '../../src/lib/siteText.js'

test('every field has a unique key, a label and a default', () => {
  const keys = TEXT_SECTIONS.flatMap((s) => s.fields.map((f) => f.key))
  assert.equal(new Set(keys).size, keys.length)
  for (const k of keys) {
    assert.ok(TEXT_FIELDS[k].label, `${k} label`)
    assert.ok(TEXT_FIELDS[k].default, `${k} default`)
    assert.equal(validateText(k, TEXT_FIELDS[k].default), '', `${k} default must be valid`)
  }
})

test('defaults, overrides and blank overrides', () => {
  assert.equal(resolveText({}, 'cta.join'), 'Join ACM TKMCE Student Chapter')
  assert.equal(resolveText({ texts: { 'cta.join': 'Become a member' } }, 'cta.join'), 'Become a member')
  assert.equal(resolveText({ texts: { 'cta.join': '   ' } }, 'cta.join'), 'Join ACM TKMCE Student Chapter')
  assert.equal(resolveText({}, 'no.such.key'), '')
})

test('older top-level fields keep working', () => {
  assert.equal(resolveText({ aboutTitle: 'Our story' }, 'aboutTitle'), 'Our story')
  assert.equal(savedText({ texts: { aboutTitle: 'ignored' } }, 'aboutTitle'), '')
})

test('placeholders are filled', () => {
  assert.match(resolveText({}, 'about.description', { year: 2019 }), /Since 2019,/)
  assert.equal(resolveText({ texts: { 'about.description': 'Est. {year} · {unknown}' } }, 'about.description', { year: 2019 }), 'Est. 2019 · {unknown}')
})

test('optional links can be switched off; required ones cannot', () => {
  assert.equal(resolveText({ texts: { 'social.instagram': NONE } }, 'social.instagram'), '')
  assert.equal(resolveText({}, 'social.instagram'), 'https://www.instagram.com/acm_tkmce')
  assert.equal(resolveText({ texts: { 'global.url': NONE } }, 'global.url'), NONE) // not optional: shown as typed, then rejected by validation
  assert.notEqual(validateText('global.url', NONE), '')
})

test('links must be http(s) and emails must look like emails', () => {
  assert.equal(resolveText({}, 'global.url'), ACM_GLOBAL_URL)
  assert.ok(isWebUrl(ACM_GLOBAL_URL))
  assert.notEqual(validateText('global.url', 'javascript:alert(1)'), '')
  assert.notEqual(validateText('global.url', 'services.acm.org/join'), '')
  assert.equal(validateText('global.url', 'https://www.acm.org/membership'), '')
  assert.notEqual(validateText('contact.email', 'not an email'), '')
  assert.equal(validateText('contact.email', 'hello@tkmce.ac.in'), '')
})

test('search finds fields by label, default text or section', () => {
  assert.ok(searchFields('global').some((f) => f.key === 'global.url'))
  assert.ok(searchFields('Think. Build').some((f) => f.key === 'about.band'))
  assert.equal(searchFields('   '), null)
})
