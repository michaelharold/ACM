import { Hero } from '../components/sections/Hero'
import { AnnouncementTicker } from '../components/AnnouncementTicker'
import { About } from '../components/sections/About'
import { Goals } from '../components/sections/Goals'
import { Execom } from '../components/sections/Execom'
import { UpcomingEvents } from '../components/sections/UpcomingEvents'
import { Testimonials } from '../components/sections/Testimonials'
import { GalleryStrip } from '../components/sections/GalleryStrip'
import { Contact } from '../components/sections/Contact'

export default function Home() {
  return (
    <>
      <Hero />
      <AnnouncementTicker />
      <About />
      <Goals />
      <Execom />
      <UpcomingEvents />
      <Testimonials />
      <GalleryStrip />
      <Contact />
    </>
  )
}
