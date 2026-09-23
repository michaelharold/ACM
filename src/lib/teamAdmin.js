// Team-registration reconciliation and admin management. Both hit server
// endpoints (Admin SDK) because they touch registration docs the caller
// doesn't own — a member's own client can't grant itself team membership, and
// only an admin may edit or delete someone else's team.
import { idToken, post } from './api'
import { isApiAvailable } from './payments'

// Called after every sign-in. If this account's email was entered as an
// unregistered teammate on some team (before they had a website account),
// this links it — the team's registration then shows up on their own
// dashboard and blocks a duplicate signup for the same event. Silently a
// no-op when there's nothing to link, so it's safe to call unconditionally.
export async function linkTeamRegistrations() {
  if (!isApiAvailable) return // no server on this host — nothing to link against
  const token = await idToken()
  return post('/api/link-registrations', {}, token)
}

// Admin-only: remove a member, add one, or delete an entire team.
export async function adminTeamAction(payload) {
  if (!isApiAvailable) throw new Error('Team tools need the website’s server (/api), which isn’t deployed on this site yet.')
  const token = await idToken()
  return post('/api/admin-team', payload, token)
}
