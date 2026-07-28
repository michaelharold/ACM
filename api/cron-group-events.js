// GET /api/cron-group-events — invoked by Vercel Cron (see vercel.json).
//
// Sweeps every Random Grouping event whose grouping hasn't run yet and, for
// each one whose "group at" time (or Registration closes, as a fallback) has
// passed, forms teams from its solo registrants. One recurring job handles
// any number of events — no per-event scheduling needed.
//
// Free-tier note: Vercel Cron on the Hobby plan only runs once a day, and
// Vercel may invoke it at any point within the scheduled hour. So grouping
// can land up to ~24h after the configured time — the admin's "Run grouping
// now" button (api/admin-team.js, action 'runGroupingNow') is the escape
// hatch for anyone who doesn't want to wait for the next sweep.
import { adminDb } from './_lib/firebaseAdmin.js'
import { runGroupingForEvent } from './_lib/grouping.js'
import { parseSiteDateTime } from './_lib/siteTime.js'
import { send } from './_lib/http.js'

export default async function handler(req, res) {
  const auth = req.headers.authorization || ''
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) return send(res, 401, { error: 'Unauthorized' })

  try {
    const db = adminDb()
    const snap = await db.collection('events').where('randomGrouping', '==', true).get()
    const now = Date.now()
    const results = []

    for (const doc of snap.docs) {
      const ev = doc.data()
      if (!ev.isGroup || ev.groupingRanAt) continue
      const effective = ev.groupingAt || ev.regCloses
      if (!effective) continue
      const dueAt = parseSiteDateTime(effective)?.getTime()
      if (!dueAt || Number.isNaN(dueAt) || now < dueAt) continue

      try {
        const result = await runGroupingForEvent(db, doc.id)
        results.push({ eventId: doc.id, name: ev.name, ...result })
      } catch (err) {
        results.push({ eventId: doc.id, name: ev.name, error: err.message })
      }
    }

    return send(res, 200, { checked: snap.size, ran: results })
  } catch (err) {
    return send(res, 500, { error: err.message || 'Server error' })
  }
}
