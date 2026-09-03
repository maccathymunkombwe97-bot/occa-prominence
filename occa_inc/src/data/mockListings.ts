import { Listing } from '../types.js';

const now = Date.now();
const img = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=85`;

/** Customer-facing OCCA catalogue used when the backend has no catalogue yet. */
export const INITIAL_LISTINGS: Listing[] = [
  {
    id: 'occa-websites', title: 'Premium Business Websites', companyName: 'OCCA', companySector: 'Technology', category: 'services',
    description: 'Fast, modern, mobile-first websites designed to turn visitors into customers. Includes responsive design, deployment and ongoing improvements.',
    compensation: 'From K2,500', type: 'Website Development', town: 'Lusaka', country: 'Zambia',
    images: [img('photo-1497366754035-f200968a6e72')], posterName: 'OCCA', posterVerified: true,
    contactMethods: ['dm'], createdAt: new Date(now - 86400000).toISOString(),
  },
  {
    id: 'occa-webapps', title: 'Custom Web Applications', companyName: 'OCCA', companySector: 'Technology', category: 'services',
    description: 'Customer portals, dashboards, booking systems, internal tools and full web applications built around your exact workflow.',
    compensation: 'Custom quote', type: 'Web App Development', town: 'Lusaka', country: 'Zambia',
    images: [img('photo-1556761175-b413da4baf72')], posterName: 'OCCA', posterVerified: true,
    contactMethods: ['dm'], createdAt: new Date(now - 172800000).toISOString(),
  },
  {
    id: 'occa-debug', title: 'Website Fix & Optimization', companyName: 'OCCA', companySector: 'Technology', category: 'services',
    description: 'We diagnose bugs, improve performance, fix broken features, optimize mobile experiences and clean up existing websites.',
    compensation: 'From K500', type: 'Website Support', town: 'Lusaka', country: 'Zambia',
    images: [img('photo-1516321318423-f06f85e504b3')], posterName: 'OCCA', posterVerified: true,
    contactMethods: ['dm'], createdAt: new Date(now - 259200000).toISOString(),
  },
  {
    id: 'occa-invoices', title: 'Digital Invoice & Receipt System', companyName: 'OCCA', companySector: 'Technology', category: 'products',
    description: 'A simple digital system for creating professional invoices and receipts, keeping records organized and making customer billing easier.',
    compensation: 'From K350', type: 'Business Software', town: 'Lusaka', country: 'Zambia',
    images: [img('photo-1554224155-6726b3ff858f')], posterName: 'OCCA', posterVerified: true,
    contactMethods: ['dm'], createdAt: new Date(now - 345600000).toISOString(),
  },
  {
    id: 'occa-business-manager', title: 'Business Performance Manager', companyName: 'OCCA', companySector: 'Technology', category: 'products',
    description: 'Track budgets, expenses, performance and business activity in one clean digital workspace built for growing businesses.',
    compensation: 'Custom quote', type: 'Business Software', town: 'Lusaka', country: 'Zambia',
    images: [img('photo-1556761175-5973dc0f32e7')], posterName: 'OCCA', posterVerified: true,
    contactMethods: ['dm'], createdAt: new Date(now - 432000000).toISOString(),
  },
  {
    id: 'occa-brand-pack', title: 'Business Brand Starter Pack', companyName: 'OCCA', companySector: 'Technology', category: 'products',
    description: 'Professional digital brand assets including flyers, business cards and other customer-ready materials for your business.',
    compensation: 'From K300', type: 'Branding', town: 'Lusaka', country: 'Zambia',
    images: [img('photo-1523726491678-bf852e717f6a')], posterName: 'OCCA', posterVerified: true,
    contactMethods: ['dm'], createdAt: new Date(now - 518400000).toISOString(),
  },
];
