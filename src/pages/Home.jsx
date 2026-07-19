import { Hero } from '../components/sections/Hero'
import { About } from '../components/sections/About'
import { Goals } from '../components/sections/Goals'
import { Execom } from '../components/sections/Execom'
import { Testimonials } from '../components/sections/Testimonials'
import { Contact } from '../components/sections/Contact'

export default function Home() {
  return (
    <>
      <Hero />
      <About />
      <Goals />
      <Execom />
      <Testimonials />
      <Contact />
    </>
  )
}
