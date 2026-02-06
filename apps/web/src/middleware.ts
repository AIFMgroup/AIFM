import { NextResponse, type NextRequest } from "next/server";

// Public paths that don't require authentication
const PUBLIC_PATHS = [
  "/auth/login",
  "/auth/logout", 
  "/auth/callback",
  "/api/auth",
  "/sign-in",
  "/password-gate",
  "/api/password-gate",
  "/favicon.ico",
];

// Static file extensions that should be public
const STATIC_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.woff', '.woff2', '.ttf', '.eot', '.css', '.js'];

const isPublicPath = (pathname: string) =>
  PUBLIC_PATHS.some((path) => pathname.startsWith(path)) ||
  pathname.startsWith("/_next") ||
  STATIC_EXTENSIONS.some((ext) => pathname.endsWith(ext));

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Check for Cognito session token
  const token = request.cookies.get("__Host-aifm_id_token")?.value;

  if (!token) {
    // Redirect to Cognito login
    return redirectToLogin(request);
  }

  // Token exists - allow request (full verification happens in API routes)
  return NextResponse.next();
}

const redirectToLogin = (request: NextRequest) => {
  const url = request.nextUrl.clone();
  url.pathname = "/auth/login";
  url.searchParams.set("returnTo", request.nextUrl.pathname);
  return NextResponse.redirect(url);
};

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)).*)"],
};
