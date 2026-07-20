import { Hero } from '../components/sections/Hero'
import { LightfallBand } from '../components/sections/LightfallBand'
import { AnnouncementTicker } from '../components/AnnouncementTicker'
import { About } from '../components/sections/About'
import { Goals } from '../components/sections/Goals'
import { Execom } from '../components/sections/Execom'
import { UpcomingEvents } from '../components/sections/UpcomingEvents'
// Hidden for now — re-enable when alumni content is ready.
// import { Testimonials } from '../components/sections/Testimonials'
import { GalleryStrip } from '../components/sections/GalleryStrip'
import { Contact } from '../components/sections/Contact'

export default function Home() {
  return (
    <>
      <Hero />
      <LightfallBand />
      <AnnouncementTicker />
      <About />
      <Goals />
      <Execom />
      <UpcomingEvents />
      {/* <Testimonials /> */}
      <GalleryStrip />
      <Contact />
    </>
  )
}
