import { Contact as ContactSection } from '../components/sections/Contact'

// Dedicated route for contact. The section component carries its own heading
// and backdrop, so the page only owns clearance under the fixed navbar.
export default function Contact() {
  return (
    <div className="pt-16">
      <ContactSection />
    </div>
  )
}
