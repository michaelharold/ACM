import { Execom as ExecomSection } from '../components/sections/Execom'

// Dedicated route for the committee. The section component carries its own
// heading and backdrop, so the page only owns clearance under the fixed navbar.
export default function Execom() {
  return (
    <div className="pt-16">
      <ExecomSection />
    </div>
  )
}
