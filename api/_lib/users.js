// Resolve one email to a registered user (exact match, then a lowercase retry).
export async function findUserByEmail(db, email) {
  const e = email.trim()
  let snap = await db.collection('users').where('email', '==', e).limit(1).get()
  if (snap.empty && e !== e.toLowerCase()) {
    snap = await db.collection('users').where('email', '==', e.toLowerCase()).limit(1).get()
  }
  return snap.empty ? null : snap.docs[0]
}
