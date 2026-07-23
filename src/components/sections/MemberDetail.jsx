import { motion } from 'framer-motion'
import { Modal } from '../ui/Modal'
import { avatarDataUri } from '../../lib/avatar'

// Expanded view for a clicked execom member: portrait on the left, name and
// role left-aligned beside it, and the bio paragraph centred underneath.
export function MemberDetail({ member, open, onClose }) {
  if (!member) return <Modal open={false} onClose={onClose} />

  return (
    <Modal open={open} onClose={onClose} size="lg" className="overflow-hidden">
      <div className="relative">
        {/* Colour wash pulled from the member's own monogram palette */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-acm-600/25 to-transparent" />

        <div className="relative p-6 sm:p-9">
          <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-center sm:text-left">
            <motion.img
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              src={member.photo || avatarDataUri(member.name)}
              alt={member.name}
              className="h-36 w-36 shrink-0 rounded-full object-cover shadow-xl ring-4 ring-white/10 sm:h-44 sm:w-44"
            />
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="min-w-0"
            >
              <h2 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
                {member.name}
              </h2>
              <p className="mt-2 inline-flex items-center gap-2 rounded-full border border-acm-500/30 bg-acm-500/10 px-3 py-1 text-sm font-medium text-acm-300">
                {member.role}
              </p>
              {member.team && (
                <p className="mt-2 text-sm text-neutral-400">{member.team}</p>
              )}
            </motion.div>
          </div>

          {member.bio && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto mt-8 max-w-xl border-t border-neutral-800 pt-7 text-center text-sm leading-relaxed text-neutral-300 sm:text-base"
            >
              {member.bio}
            </motion.p>
          )}
        </div>
      </div>
    </Modal>
  )
}
