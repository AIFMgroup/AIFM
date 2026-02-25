import { NextResponse, type NextRequest } from "next/server";

import { verifyIdToken } from "@/lib/auth/tokens";
import { getRoleFromGroups, type UserRole } from "@/lib/accounting/authz";

const edgeRateWindow = new Map<string, { start: number; count: number }>();

const PUBLIC_PATHS = [
  "/auth/login",
  "/auth/logout",
  "/auth/callback",
  "/fortnox/callback", // OAuth callback must be public (no session during redirect)
  "/favicon.ico",
  "/manifest.json",
  "/sw.js",
  "/offline",
];

// Endpoints that are allowed to be triggered without a user session (via cron secret)
const CRON_ALLOWED_PATHS = [
  "/api/integrations/jobs/worker",
  "/api/fortnox/posting-queue/worker",
  "/api/securities/expiry-check",
  "/api/securities/monthly-review",
  "/api/admin/scheduled-scrape",
  "/api/isec/sync",
  "/api/nav/worker",
];

// Static file extensions that should be public
const STATIC_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.woff', '.woff2', '.ttf', '.eot'];

const isPublicPath = (pathname: string, searchParams?: URLSearchParams) =>
  PUBLIC_PATHS.some((path) => pathname.startsWith(path)) ||
  pathname.startsWith("/shared/") ||
  pathname.startsWith("/api/shared/") ||
  /^\/api\/data-rooms\/[^/]+\/nda$/.test(pathname) ||
  pathname.startsWith("/_next") ||
  pathname.startsWith("/api/public") ||
  (pathname === "/api/isec" && (searchParams?.get("action") === "health" || searchParams?.get("action") === "diagnostics")) ||
  pathname === "/api/isec/sync" ||
  pathname === "/api/nav/worker" ||
  STATIC_EXTENSIONS.some((ext) => pathname.endsWith(ext));

/** Paths forvaltare role is allowed to access. Operation and others have no path restriction. */
const FORVALTARE_ALLOWED = [
  "/",
  "/settings",
  "/securities/new-approval",
  "/securities/approved",
  "/forvaltning/esg",
  "/forvaltning/investeringsanalys",
  "/forvaltning/investeringsscout",
  "/forvaltning/delegationsovervakning",
  "/api/securities",
  "/api/esg",
  "/api/auth",
  "/api/funds",
  "/api/admin/fund-assignments",
  "/api/auto-archive",
  "/api/notifications",
  "/api/delegation",
];

function isPathAllowedForRole(pathname: string, role: UserRole): boolean {
  if (role !== "forvaltare") return true;
  return FORVALTARE_ALLOWED.some(
    (p) => p === pathname || (p.length > 1 && pathname.startsWith(p))
  );
}

const addSecurityHeaders = (response: NextResponse) => {
  // Note: Next.js requires 'unsafe-inline' and 'unsafe-eval' for development and some production features
  // For stricter CSP, use nonce-based approach with Next.js script components
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https: wss:",
    "frame-ancestors 'none'",
    "form-action 'self' https://eu-north-12xz9dqe00.auth.eu-north-1.amazoncognito.com",
    "base-uri 'self'",
    "object-src 'none'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
  ].join("; ");

  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  response.headers.set("X-Download-Options", "noopen");
  return response;
};

function isAuthorizedCron(request: NextRequest): boolean {
  const secret = process.env.AIFM_CRON_SECRET || process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("x-aifm-cron-secret") || request.headers.get("x-cron-secret");
  return !!header && header === secret;
}

/**
 * Attempt to refresh tokens using the Cognito refresh_token grant.
 * Returns new tokens on success, null on failure.
 */
async function refreshTokens(refreshToken: string): Promise<{
  id_token: string;
  access_token: string;
  expires_in: number;
} | null> {
  try {
    const clientId = process.env.COGNITO_CLIENT_ID;
    const domain = process.env.COGNITO_DOMAIN?.replace(/\/$/, "");
    if (!clientId || !domain) return null;

    const params = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      refresh_token: refreshToken,
    });

    const response = await fetch(`${domain}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!response.ok) {
      console.error("Token refresh failed:", response.status, await response.text().catch(() => ""));
      return null;
    }

    const data = await response.json();
    return {
      id_token: data.id_token,
      access_token: data.access_token,
      expires_in: data.expires_in || 3600,
    };
  } catch (error) {
    console.error("Token refresh error:", error);
    return null;
  }
}

const secure = process.env.NODE_ENV === "production";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Lightweight in-memory rate limit for API routes (Edge-compatible, no DynamoDB).
  // Individual API routes apply their own DynamoDB-backed limits in Node runtime.
  if (pathname.startsWith("/api/") && !pathname.startsWith("/api/public") && !CRON_ALLOWED_PATHS.includes(pathname)) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
    const now = Date.now();
    const window = edgeRateWindow.get(ip);
    if (window && now - window.start < 60_000) {
      window.count++;
      if (window.count > 200) {
        const resp = NextResponse.json(
          { error: "Too Many Requests", message: "Du har gjort för många förfrågningar." },
          { status: 429, headers: { "Retry-After": "60" } },
        );
        return addSecurityHeaders(resp);
      }
    } else {
      edgeRateWindow.set(ip, { start: now, count: 1 });
    }
  }

  if (isPublicPath(pathname, request.nextUrl.searchParams)) {
    return addSecurityHeaders(NextResponse.next());
  }

  const token = request.cookies.get("__Host-aifm_id_token")?.value;
  const refreshTokenCookie = request.cookies.get("__Host-aifm_refresh_token")?.value;
  const lastActive = request.cookies.get("__Host-aifm_last_active")?.value;
  const now = Date.now();
  const MAX_IDLE_MS = 4 * 60 * 60 * 1000; // 4 hours – users often read/write for long periods

  // No ID token at all
  if (!token) {
    // Allow cron-triggered ops endpoints without session cookies
    if (CRON_ALLOWED_PATHS.includes(pathname) && isAuthorizedCron(request)) {
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-aifm-role", "admin");
      return addSecurityHeaders(NextResponse.next({ request: { headers: requestHeaders } }));
    }

    // Try to refresh using refresh_token before redirecting to login
    if (refreshTokenCookie) {
      const newTokens = await refreshTokens(refreshTokenCookie);
      if (newTokens) {
        return await handleValidToken(request, newTokens.id_token, now, MAX_IDLE_MS, lastActive, {
          idToken: newTokens.id_token,
          accessToken: newTokens.access_token,
          expiresIn: newTokens.expires_in,
        });
      }
    }

    return redirectToLogin(request);
  }

  try {
    const payload = await verifyIdToken(token);

    // Derive role from verified token (Cognito groups)
    const derivedRole = getRoleFromGroups((payload as any)?.["cognito:groups"]);
    const requestHeaders = new Headers(request.headers);
    // IMPORTANT: overwrite any client-supplied role header
    requestHeaders.set("x-aifm-role", derivedRole);

    // Idle timeout check
    if (lastActive) {
      const ts = Number(lastActive);
      if (Number.isFinite(ts) && now - ts > MAX_IDLE_MS) {
        const resp = redirectToLogin(request);
        resp.cookies.delete("__Host-aifm_id_token");
        resp.cookies.delete("__Host-aifm_access_token");
        resp.cookies.delete("__Host-aifm_refresh_token");
        resp.cookies.delete("__Host-aifm_last_active");
        return addSecurityHeaders(resp);
      }
    }

    // Proactive refresh: if token expires within 5 minutes, refresh it now
    const exp = payload.exp;
    const fiveMinFromNow = Math.floor(now / 1000) + 5 * 60;
    if (exp && exp < fiveMinFromNow && refreshTokenCookie) {
      const newTokens = await refreshTokens(refreshTokenCookie);
      if (newTokens) {
        return await handleValidToken(request, newTokens.id_token, now, MAX_IDLE_MS, lastActive, {
          idToken: newTokens.id_token,
          accessToken: newTokens.access_token,
          expiresIn: newTokens.expires_in,
        });
      }
    }

    // Role-based path restrictions (forvaltare has limited routes)
    if (!isPathAllowedForRole(pathname, derivedRole)) {
      if (pathname.startsWith("/api/")) {
        return addSecurityHeaders(
          NextResponse.json({ error: "Forbidden", message: "Access denied for this role." }, { status: 403 })
        );
      }
      const url = request.nextUrl.clone();
      url.pathname = derivedRole === "forvaltare" ? "/securities/new-approval" : "/overview";
      return addSecurityHeaders(NextResponse.redirect(url));
    }

    const resp = addSecurityHeaders(NextResponse.next({ request: { headers: requestHeaders } }));
    resp.cookies.set({
      name: "__Host-aifm_last_active",
      value: now.toString(),
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: MAX_IDLE_MS / 1000,
    });
    return resp;
  } catch (error) {
    // Token verification failed – try to refresh before giving up
    if (refreshTokenCookie) {
      const newTokens = await refreshTokens(refreshTokenCookie);
      if (newTokens) {
        return await handleValidToken(request, newTokens.id_token, now, MAX_IDLE_MS, lastActive, {
          idToken: newTokens.id_token,
          accessToken: newTokens.access_token,
          expiresIn: newTokens.expires_in,
        });
      }
    }

    console.error("Token verification failed in middleware (refresh also failed)", error);
    const response = redirectToLogin(request);
    response.cookies.delete("__Host-aifm_id_token");
    response.cookies.delete("__Host-aifm_access_token");
    response.cookies.delete("__Host-aifm_refresh_token");
    response.cookies.delete("__Host-aifm_last_active");
    return addSecurityHeaders(response);
  }
}

/**
 * Handle a valid (or freshly refreshed) token: verify it, set role header, update cookies.
 */
async function handleValidToken(
  request: NextRequest,
  idToken: string,
  now: number,
  maxIdleMs: number,
  lastActive: string | undefined,
  newCookies?: { idToken: string; accessToken: string; expiresIn: number },
) {
  const payload = await verifyIdToken(idToken);
  const derivedRole = getRoleFromGroups((payload as any)?.["cognito:groups"]);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-aifm-role", derivedRole);

  // Idle timeout check
  if (lastActive) {
    const ts = Number(lastActive);
    if (Number.isFinite(ts) && now - ts > maxIdleMs) {
      const resp = redirectToLogin(request);
      resp.cookies.delete("__Host-aifm_id_token");
      resp.cookies.delete("__Host-aifm_access_token");
      resp.cookies.delete("__Host-aifm_refresh_token");
      resp.cookies.delete("__Host-aifm_last_active");
      return addSecurityHeaders(resp);
    }
  }

  const { pathname } = request.nextUrl;
  if (!isPathAllowedForRole(pathname, derivedRole)) {
    if (pathname.startsWith("/api/")) {
      return addSecurityHeaders(
        NextResponse.json({ error: "Forbidden", message: "Access denied for this role." }, { status: 403 })
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = derivedRole === "forvaltare" ? "/securities/new-approval" : "/overview";
    return addSecurityHeaders(NextResponse.redirect(url));
  }

  const resp = addSecurityHeaders(NextResponse.next({ request: { headers: requestHeaders } }));

  // Set refreshed token cookies
  if (newCookies) {
    resp.cookies.set({
      name: "__Host-aifm_id_token",
      value: newCookies.idToken,
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: newCookies.expiresIn,
    });
    resp.cookies.set({
      name: "__Host-aifm_access_token",
      value: newCookies.accessToken,
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: newCookies.expiresIn,
    });
  }

  resp.cookies.set({
    name: "__Host-aifm_last_active",
    value: now.toString(),
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: maxIdleMs / 1000,
  });

  return resp;
}

const redirectToLogin = (request: NextRequest) => {
  const { pathname } = request.nextUrl;
  
  // For API routes, return 401 JSON instead of redirecting
  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Authentication required' },
      { status: 401 }
    );
  }
  
  // For page routes, redirect to login
  const url = request.nextUrl.clone();
  url.pathname = "/auth/login";
  url.searchParams.set("returnTo", request.nextUrl.pathname);
  return NextResponse.redirect(url);
};

export const config = {
  matcher: ["/((?!api/accounting/ops/health).*)"],
};
