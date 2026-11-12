import { permanentRedirect } from 'next/navigation'

// The About page duplicated the Company Profile (overview, mission, vision,
// values). Old links and search results now land on the full profile.
export default function AboutPage() {
  permanentRedirect('/company-profile')
}
