import { permanentRedirect } from 'next/navigation'

// The Company Profile page repeated what the rest of the website already says
// (hero, industries, services, process, inventory system, contact). Its unique
// content now lives where visitors expect it:
//   About Us  → story, registration, mission, vision, values, credentials
//   Products  → full catalog incl. extended categories and office furniture
// For a presentation to send or show clients, use Settings → Company Profile Deck.
export default function CompanyProfilePage() {
  permanentRedirect('/about')
}
