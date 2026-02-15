/**
 * Shared LSEG/Refinitiv OAuth2 authentication.
 * Used by ESG provider and Price provider.
 */

const DEFAULT_BASE_URL = 'https://api.refinitiv.com';

let cachedToken: string | null = null;
let tokenExpiry = 0;
const BUFFER_MS = 30_000;

export async function getLSEGAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry - BUFFER_MS) {
    return cachedToken;
  }
  const apiKey = process.env.LSEG_API_KEY ?? '';
  const apiSecret = process.env.LSEG_API_SECRET ?? '';
  const baseUrl = process.env.LSEG_API_URL ?? DEFAULT_BASE_URL;

  if (!apiKey || !apiSecret) {
    throw new Error('LSEG_API_KEY and LSEG_API_SECRET must be set');
  }

  const res = await fetch(`${baseUrl}/auth/oauth2/v1/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: apiKey,
      client_secret: apiSecret,
      scope: 'trapi',
    }),
  });

  if (!res.ok) {
    throw new Error(`LSEG auth failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in?: number };
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in ?? 600) * 1000;
  return cachedToken!;
}

export function getLSEGBaseUrl(): string {
  return process.env.LSEG_API_URL ?? DEFAULT_BASE_URL;
}

export function isLSEGConfigured(): boolean {
  return !!(process.env.LSEG_API_KEY && process.env.LSEG_API_SECRET);
}
