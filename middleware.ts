import { NextResponse, type NextRequest } from "next/server";

import { verifyIdToken } from "@/lib/auth/tokens";
import { getRoleFromGroups } from "@/lib/accounting/authz";

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
];

// Static file extensions that should be public
const STATIC_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.woff', '.woff2', '.ttf', '.eot'];

const isPublicPath = (pathname: string) =>
  PUBLIC_PATHS.some((path) => pathname.startsWith(path)) ||
  pathname.startsWith("/shared/") ||
  pathname.startsWith("/api/shared/") ||
  // Public NDA endpoint for shared-link guest flow (create_template remains auth-guarded inside the route)
  /^\/api\/data-rooms\/[^/]+\/nda$/.test(pathname) ||
  pathname.startsWith("/_next") ||
  pathname.startsWith("/api/public") ||
  STATIC_EXTENSIONS.some((ext) => pathname.endsWith(ext));

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
  const secret = process.env.AIFM_CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("x-aifm-cron-secret");
  return !!header && header === secret;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return addSecurityHeaders(NextResponse.next());
  }

  const token = request.cookies.get("__Host-aifm_id_token")?.value;
  const lastActive = request.cookies.get("__Host-aifm_last_active")?.value;
  const now = Date.now();
  const MAX_IDLE_MS = 15 * 60 * 1000; // 15 min

  if (!token) {
    // Allow cron-triggered ops endpoints without session cookies
    if (CRON_ALLOWED_PATHS.includes(pathname) && isAuthorizedCron(request)) {
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-aifm-role", "admin");
      return addSecurityHeaders(NextResponse.next({ request: { headers: requestHeaders } }));
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
    console.error("Token verification failed in middleware", error);
    const response = redirectToLogin(request);
    response.cookies.delete("__Host-aifm_id_token");
    response.cookies.delete("__Host-aifm_access_token");
    response.cookies.delete("__Host-aifm_refresh_token");
    response.cookies.delete("__Host-aifm_last_active");
    return addSecurityHeaders(response);
  }
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

