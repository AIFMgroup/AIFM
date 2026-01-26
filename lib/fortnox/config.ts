/**
 * Fortnox API Configuration
 * 
 * För att få API-nycklar:
 * 1. Gå till https://developer.fortnox.se
 * 2. Skapa en app
 * 3. Lägg till redirect URI: https://your-domain.com/api/fortnox/callback
 */

export const FORTNOX_CONFIG = {
  // OAuth endpoints
  authorizationEndpoint: 'https://apps.fortnox.se/oauth-v1/auth',
  tokenEndpoint: 'https://apps.fortnox.se/oauth-v1/token',
  
  // API base URL
  apiBaseUrl: 'https://api.fortnox.se/3',
  
  // OAuth credentials (from environment)
  clientId: process.env.FORTNOX_CLIENT_ID || '',
  clientSecret: process.env.FORTNOX_CLIENT_SECRET || '',
  
  // Redirect URI (dynamically set based on environment)
  getRedirectUri: (host: string) => {
    const protocol = host.includes('localhost') ? 'http' : 'https';
    return `${protocol}://${host}/api/fortnox/callback`;
  },
  
  // Scopes we need
  scopes: [
    'bookkeeping',      // Bokföring - skapa verifikationer
    'invoice',          // Fakturor - läsa/skriva
    'supplier',         // Leverantörer - läsa/skriva
    'article',          // Artiklar - läsa
    'costcenter',       // Kostnadsställen - läsa
    'project',          // Projekt - läsa
    'companyinformation', // Bolagsinfo - läsa
  ],
};

export const FORTNOX_ENDPOINTS = {
  // Bokföring
  vouchers: '/vouchers',
  voucherSeries: '/voucherseries',
  accounts: '/accounts',
  
  // Fakturor & Leverantörer
  supplierInvoices: '/supplierinvoices',
  suppliers: '/suppliers',
  articles: '/articles',
  
  // Metadata
  companyInfo: '/companyinformation',
  costCenters: '/costcenters',
  projects: '/projects',
  
  // Finansiellt
  financialYears: '/financialyears',
};




