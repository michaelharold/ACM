import { Link } from 'react-router-dom'
import { ArrowLeft, Hammer } from 'lucide-react'
import { Button } from '../components/ui/Button'

// Temporary placeholder for routes built in later sessions.
export function Stub({ title, session, children }) {
  return (
    <section className="section-shell flex min-h-[70vh] flex-col items-center justify-center py-32 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
        <Hammer className="h-6 w-6 text-acm-500" />
      </span>
      <h1 className="mt-6 text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-3 max-w-md text-neutral-500 dark:text-neutral-400">
        {children || `This page is being built in Session ${session}.`}
      </p>
      <Button as={Link} to="/" variant="outline" className="mt-8">
        <ArrowLeft className="h-4 w-4" /> Back home
      </Button>
    </section>
  )
}
