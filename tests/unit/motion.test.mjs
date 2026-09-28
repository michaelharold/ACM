import { test } from 'node:test'
import assert from 'node:assert/strict'
import { project, rubberband, nearest } from '../../src/lib/motion.js'

test('momentum projection matches Apple\'s deceleration formula', () => {
  assert.equal(project(0), 0)
  // 1000 px/s at 0.998 → 1 × 0.998 / 0.002 = 499 px
  assert.ok(Math.abs(project(1000) - 499) < 1e-9)
  assert.ok(project(1000, 0.99) < project(1000)) // snappier rate stops sooner
  assert.ok(project(-800) < 0)
})

test('rubber-banding resists more the further you pull', () => {
  const a = rubberband(50, 400)
  const b = rubberband(200, 400)
  assert.ok(a > 0 && a < 50)
  assert.ok(b > a && b < 200)
  assert.ok(b / 200 < a / 50) // proportionally less follow-through
  assert.equal(rubberband(-50, 400), -rubberband(50, 400))
  assert.equal(rubberband(50, 0), 0)
})

test('nearest snap point', () => {
  assert.equal(nearest([0, 300, 600], 420), 300)
  assert.equal(nearest([0, 300, 600], 460), 600)
  assert.equal(nearest([], 10), 0)
})
