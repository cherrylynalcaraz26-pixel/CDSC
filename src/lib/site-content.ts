// Central content for the public CDSC Industrial Supply marketing site.
// Keeping copy here (rather than inline in page components) so product
// categories, industries, services, and company details can be updated
// in one place without touching page layout code.

export const company = {
  name: 'CDSC Industrial Supply',
  legalName: 'CDSC Industrial Supply Corporation',
  tagline: 'Supplying Solutions, Building Partnerships',
  businessType: 'Trading Corporation',
  industry: 'Industrial Supply & Distribution',
  vatRegistered: true,
  addressLine1: '113 San Isidro Sur',
  addressLine2: 'Sto. Tomas, Batangas, Philippines 4234',
  addressFull: '113 San Isidro Sur, Sto. Tomas, Batangas, Philippines 4234',
  phone: '0952 445 3776',
  phoneHref: 'tel:+639524453776',
  email: 'cdsc.gmot@gmail.com',
  emailHref: 'mailto:cdsc.gmot@gmail.com',
}

// Sourced from the internal Company & Business Profile record (system_settings)
// so the public site and internal system stay in sync — not invented copy.
export const mission =
  'To provide industries and businesses with quality industrial supplies and exceptional service, delivered on time, every time, empowering our clients to achieve operational excellence and sustainable growth.'

export const vision =
  'To become a trusted industrial supply and procurement partner for businesses across Batangas and the Philippines.'

export const companyOverview = [
  'CDSC Industrial Supply Corporation is a Philippine based B2B industrial supply and procurement company, specializing in the supply and distribution of industrial materials, safety equipment, hardware, and general construction supplies. We provide products and sourcing support to businesses, industrial facilities, contractors, and organizations.',
  'Strategically located in Sto. Tomas, Batangas, we serve manufacturers, contractors, and businesses across Region IV-A (CALABARZON) and beyond. We source quality products from trusted local and international suppliers, and help customers simplify purchasing through practical sourcing solutions, responsive communication, and dependable fulfillment support.',
]

// Registrations on file with the company — shown as-is, no unverified claims added.
export const credentials = [
  { label: 'PhilGEPS Registered', description: 'Registered with the Philippine Government Electronic Procurement System.' },
  { label: 'DTI Registered Business', description: 'Registered business name with the Department of Trade and Industry.' },
]

export const nav = [
  { label: 'Home', href: '/' },
  { label: 'About Us', href: '/about' },
  { label: 'Products', href: '/products' },
  { label: 'Industries We Serve', href: '/industries' },
  { label: 'Services', href: '/services' },
  { label: 'Company Profile', href: '/company-profile' },
  { label: 'Contact', href: '/contact' },
]

export type ProductCategory = {
  name: string
  description: string
  items: string[]
}

export const productCategories: ProductCategory[] = [
  {
    name: 'Industrial Supplies',
    description: 'Everyday supplies that keep operations, maintenance, and production running.',
    items: ['Maintenance supplies', 'Consumables', 'Tools', 'Hardware', 'Industrial materials'],
  },
  {
    name: 'Electrical Supplies',
    description: 'Components and accessories for facility, panel, and equipment electrical work.',
    items: ['Electrical components', 'Cables and wires', 'Electrical accessories', 'Control components'],
  },
  {
    name: 'Safety Supplies',
    description: 'Personal protection and workplace safety products for industrial and site use.',
    items: ['Personal protective equipment', 'Safety equipment', 'Workplace safety products'],
  },
  {
    name: 'Mechanical Supplies',
    description: 'Mechanical parts and consumables for equipment upkeep and repair.',
    items: ['Mechanical components', 'Bearings', 'Belts', 'Fasteners', 'Maintenance parts'],
  },
  {
    name: 'Office and Facility Supplies',
    description: 'Day-to-day supplies for offices, warehouses, and facility upkeep.',
    items: ['Office essentials', 'Janitorial supplies', 'Facility maintenance products'],
  },
]

export type WhyCard = { title: string; description: string }

export const whyCds: WhyCard[] = [
  {
    title: 'Reliable Supply',
    description: 'We focus on dependable sourcing and consistent service for business requirements.',
  },
  {
    title: 'Responsive Support',
    description: 'Clear communication from inquiry to quotation and fulfillment.',
  },
  {
    title: 'Flexible Sourcing',
    description: 'We help locate products according to specifications, quantity, and application.',
  },
  {
    title: 'Competitive Procurement',
    description: 'We work to provide practical options that balance price, quality, and availability.',
  },
  {
    title: 'Business Focused',
    description: 'Our approach is built around recurring business requirements rather than one time transactions.',
  },
  {
    title: 'Long Term Partnerships',
    description: 'We aim to become a dependable supplier that businesses can work with repeatedly.',
  },
  {
    title: 'Built-In Inventory System',
    description: 'Our internal inventory and order tracking system supports accurate stock visibility and dependable fulfillment from quotation to delivery.',
  },
]

export type Industry = { name: string; description: string }

export const industries: Industry[] = [
  {
    name: 'Manufacturing',
    description: 'Sourcing support for production consumables, maintenance parts, and recurring plant requirements.',
  },
  {
    name: 'Construction',
    description: 'Practical supply and sourcing for site materials, hardware, and project-based requirements.',
  },
  {
    name: 'Engineering',
    description: 'Assistance locating specific components and materials for project and installation work.',
  },
  {
    name: 'Automotive',
    description: 'Supply support for parts, tools, and consumables used in servicing and operations.',
  },
  {
    name: 'Facilities Management',
    description: 'Consistent supply of maintenance, electrical, and facility upkeep products.',
  },
  {
    name: 'Maintenance Operations',
    description: 'Dependable access to mechanical and maintenance items to reduce downtime.',
  },
  {
    name: 'Warehousing and Logistics',
    description: 'Sourcing for equipment, tools, and consumables that support daily warehouse operations.',
  },
  {
    name: 'Commercial Businesses',
    description: 'Supply and procurement support for offices, facilities, and recurring business needs.',
  },
  {
    name: 'Government and Institutions',
    description: 'Professional quotation handling and sourcing support for institutional requirements.',
  },
]

export type Service = { title: string; description: string }

export const services: Service[] = [
  {
    title: 'Industrial Supply',
    description: 'Supply of industrial, maintenance, electrical, mechanical, safety, and business related products.',
  },
  {
    title: 'Product Sourcing',
    description: 'Assistance in locating specific products and materials based on customer requirements.',
  },
  {
    title: 'Procurement Support',
    description: 'Quotation preparation, supplier coordination, product comparison, and purchasing assistance.',
  },
  {
    title: 'Bulk and Business Orders',
    description: 'Support for recurring and volume based business requirements.',
  },
  {
    title: 'Delivery Coordination',
    description: 'Coordination of order fulfillment and delivery according to agreed requirements.',
  },
  {
    title: 'Special Requirements',
    description: 'Assistance with products that may not be part of our regular supply categories.',
  },
]

export type ProcessStep = { step: string; title: string; description: string }

export const procurementProcess: ProcessStep[] = [
  {
    step: '01',
    title: 'Send Your Requirement',
    description: 'Tell us what you need, including specifications, quantity, brand preference, or application.',
  },
  {
    step: '02',
    title: 'We Source',
    description: 'Our team reviews the requirement and identifies suitable supply options.',
  },
  {
    step: '03',
    title: 'Receive Your Quotation',
    description: 'We provide available options and pricing for your consideration.',
  },
  {
    step: '04',
    title: 'Order and Fulfillment',
    description: 'Once approved, we coordinate the order and delivery process.',
  },
]

export const howWeWork = ['Requirement', 'Sourcing', 'Quotation', 'Approval', 'Fulfillment', 'Delivery']

export type CoreValue = { title: string; description: string }

export const coreValues: CoreValue[] = [
  { title: 'Reliability', description: 'We do what we commit to.' },
  { title: 'Responsiveness', description: 'We value clear and timely communication.' },
  { title: 'Integrity', description: 'We conduct business honestly and responsibly.' },
  { title: 'Practicality', description: 'We focus on solutions that work in the real world.' },
  { title: 'Partnership', description: 'We build relationships that create value beyond a single transaction.' },
]
