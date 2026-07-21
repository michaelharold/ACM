import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { SectionHeading } from '../SectionHeading'
import { EventCard } from '../events/EventCard'
import { Button } from '../ui/Button'
import { Reveal } from '../ui/Reveal'
import SplitText from '../reactbits/SplitText'
import { useData } from '../../context/DataContext'

// Home-page preview of what's next — the three most relevant events,
// with the full catalogue one click away.
export function UpcomingEvents() {
  const { events } = useData()
  const navigate = useNavigate()

  const featured = useMemo(() => {
    const rank = { open: 0, 'coming-soon': 1, closed: 2 }
    return [...events]
      .sort((a, b) => (rank[a.status] ?? 3) - (rank[b.status] ?? 3) || new Date(a.date) - new Date(b.date))
      .slice(0, 3)
  }, [events])

  return (
    <section id="upcoming" className="scroll-mt-24 py-24 sm:py-28">
      <div className="section-shell">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading
            align="left"
            eyebrow="What's next"
            title="Upcoming events"
            description="The next things worth clearing your calendar for."
          />
          <Button as={Link} to="/events" variant="outline" className="shrink-0">
            View all events <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        {featured.length ? (
          <Reveal className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" amount={0.15}>
            {featured.map((event) => (
              <EventCard key={event.id} event={event} onOpen={(e) => navigate(`/events/${e.id}`)} />
            ))}
          </Reveal>
        ) : (
          <div className="mt-12 flex flex-col items-center rounded-2xl border border-dashed border-neutral-300 py-16 text-center dark:border-neutral-700">
            <SplitText
              text="Coming Soon....."
              tag="h3"
              className="text-3xl font-extrabold tracking-tight sm:text-4xl"
              delay={70}
              duration={0.8}
              ease="power3.out"
              splitType="chars"
              from={{ opacity: 0, y: 40 }}
              to={{ opacity: 1, y: 0 }}
              threshold={0.1}
              rootMargin="-40px"
              textAlign="center"
            />
            <p className="mt-3 max-w-sm text-sm text-neutral-500 dark:text-neutral-400">
              Nothing on the calendar right now — the next line-up is being planned.
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
