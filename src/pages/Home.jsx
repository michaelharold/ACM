import { Hero } from '../components/sections/Hero'
import { AnnouncementTicker } from '../components/AnnouncementTicker'
import { About } from '../components/sections/About'
import { Goals } from '../components/sections/Goals'
import { GalleryStrip } from '../components/sections/GalleryStrip'
import { ExploreMore } from '../components/sections/ExploreMore'

// About, Goals and Gallery stay on this scroll page. Events, Execom and Contact
// each own a dedicated route — ExploreMore is the way across to them.
export default function Home() {
  return (
    <>
      <Hero />
      <AnnouncementTicker />
      <About />
      <Goals />
      <GalleryStrip />
      <ExploreMore />
    </>
  )
}
