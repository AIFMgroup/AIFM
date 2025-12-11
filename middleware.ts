import { NextResponse, type NextRequest } from "next/server";

import { verifyIdToken } from "@/lib/auth/tokens";

const PUBLIC_PATHS = [
  "/auth/login",
  "/auth/logout",
  "/auth/callback",
  "/favicon.ico",
];

const isPublicPath = (pathname: string) =>
  PUBLIC_PATHS.some((path) => pathname.startsWith(path)) ||
  pathname.startsWith("/_next") ||
  pathname.startsWith("/api/public");

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get("aifm_id_token")?.value;

  if (!token) {
    return redirectToLogin(request);
  }

  try {
    await verifyIdToken(token);
    return NextResponse.next();
  } catch (error) {
    console.error("Token verification failed in middleware", error);
    const response = redirectToLogin(request);
    response.cookies.delete("aifm_id_token");
    response.cookies.delete("aifm_access_token");
    response.cookies.delete("aifm_refresh_token");
    return response;
  }
}

const redirectToLogin = (request: NextRequest) => {
  const url = request.nextUrl.clone();
  url.pathname = "/auth/login";
  url.searchParams.set("returnTo", request.nextUrl.pathname);
  return NextResponse.redirect(url);
};

export const config = {
  matcher: ["/((?!api/health).*)"],
};

