import { Link } from 'react-router-dom'
import { ArrowLeft, Compass } from 'lucide-react'
import { Button } from '../components/ui/Button'

export default function NotFound() {
  return (
    <section className="section-shell flex min-h-[70vh] flex-col items-center justify-center py-32 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
        <Compass className="h-6 w-6 text-acm-500" />
      </span>
      <h1 className="mt-6 text-3xl font-bold tracking-tight">404 — Not Found</h1>
      <p className="mt-3 max-w-md text-neutral-500 dark:text-neutral-400">
        That page doesn’t exist. Let’s get you back to the ACM TKMCE home.
      </p>
      <Button as={Link} to="/" variant="outline" className="mt-8">
        <ArrowLeft className="h-4 w-4" /> Back home
      </Button>
    </section>
  )
}
