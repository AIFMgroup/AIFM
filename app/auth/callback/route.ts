import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getAuthConfig } from "@/lib/auth/config";
import { verifyIdToken } from "@/lib/auth/tokens";

const secure = process.env.NODE_ENV === "production";

export async function GET(request: Request) {
  const config = getAuthConfig();
  const requestCookies = await cookies();
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  const pkceCookie = requestCookies.get("aifm_pkce")?.value;
  const stateCookieRaw = requestCookies.get("aifm_state")?.value;

  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  // Build public base URL using forwarded headers (not internal container URL)
  const getPublicBaseUrl = () => {
    const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host") || "d31zvrvfawczta.cloudfront.net";
    const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
    return `${forwardedProto}://${forwardedHost}`;
  };

  if (!code || !pkceCookie || !stateCookieRaw) {
    const cookieHeader = request.headers.get("cookie");
    console.error("Auth callback missing pieces", {
      hasCode: Boolean(code),
      hasPkce: Boolean(pkceCookie),
      hasStateCookie: Boolean(stateCookieRaw),
      search: url.search,
      cookieHeader: cookieHeader ? "present" : "missing",
      rawCookies: cookieHeader,
    });
    // Return error instead of redirecting to avoid loop
    return new Response(
      `<!DOCTYPE html>
      <html>
      <head><title>Login Error</title></head>
      <body style="font-family: system-ui; padding: 40px; max-width: 600px; margin: 0 auto;">
        <h1>Authentication Error</h1>
        <p>Session cookies were not received. This can happen if:</p>
        <ul>
          <li>Cookies are blocked in your browser</li>
          <li>You waited too long to complete login (cookies expired)</li>
          <li>Privacy settings are blocking cross-site cookies</li>
        </ul>
        <p><a href="/auth/login">Try logging in again</a></p>
        <details>
          <summary>Debug info</summary>
          <pre>hasCode: ${Boolean(code)}
hasPkce: ${Boolean(pkceCookie)}
hasState: ${Boolean(stateCookieRaw)}
cookieHeader: ${cookieHeader || "none"}</pre>
        </details>
      </body>
      </html>`,
      {
        status: 400,
        headers: { "Content-Type": "text/html" },
      }
    );
  }

  const stateCookie = JSON.parse(stateCookieRaw) as {
    state: string;
    returnTo: string;
  };

  // Guard against redirects to unexpected hosts (e.g. old localhost URLs).
  const sanitizeReturnTo = (value: string | undefined) => {
    if (!value) return "/";
    try {
      // If it's an absolute URL, only allow our CloudFront host; otherwise, default to "/".
      const url = new URL(value, "https://d31zvrvfawczta.cloudfront.net");
      const allowedHost = "d31zvrvfawczta.cloudfront.net";
      if (url.hostname !== allowedHost) return "/";
      return url.pathname + (url.search || "") + (url.hash || "");
    } catch {
      // Treat malformed values as relative paths; ensure they start with "/".
      return value.startsWith("/") ? value : "/";
    }
  };

  const returnedState = url.searchParams.get("state");
  if (!returnedState || returnedState !== stateCookie.state) {
    return NextResponse.json(
      { error: "State mismatch" },
      { status: 400 }
    );
  }

  const tokenUrl = `${config.domain}/oauth2/token`;
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: config.clientId,
    code,
    redirect_uri: config.redirectUri,
    code_verifier: pkceCookie,
  });

  const tokenResponse = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!tokenResponse.ok) {
    const payload = await tokenResponse.text();
    return NextResponse.json(
      { error: "Failed to obtain tokens", payload },
      { status: 400 }
    );
  }

  const tokens = (await tokenResponse.json()) as {
    id_token: string;
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  try {
    await verifyIdToken(tokens.id_token);
  } catch (verError) {
    console.error("Token verification failed during callback", verError);
    return NextResponse.json(
      { error: "Invalid ID token" },
      { status: 400 }
    );
  }

  const safeReturnTo = sanitizeReturnTo(stateCookie.returnTo);
  const publicBaseUrl = getPublicBaseUrl();
  
  console.log("Auth callback returnTo", {
    rawReturnTo: stateCookie.returnTo,
    safeReturnTo,
    host: request.headers.get("host"),
    publicBaseUrl,
    search: url.search,
  });
  const response = NextResponse.redirect(
    new URL(safeReturnTo, publicBaseUrl).toString()
  );
  response.headers.set("Cache-Control", "no-store");

  const setCookie = (name: string, value: string, maxAge: number) => {
    response.cookies.set({
      name,
      value,
      httpOnly: true,
      secure,
      // Important: allow returning from external OAuth flows (e.g. Fortnox) without losing session cookies.
      // Strict blocks cookies on cross-site top-level redirects. Lax is the recommended default here.
      sameSite: "lax",
      path: "/",
      maxAge,
    });
  };

  // Short-lived access/ID tokens; refresh rotates less often
  const idAccessMaxAge = Math.min(tokens.expires_in, 15 * 60); // cap at 15m
  setCookie("__Host-aifm_id_token", tokens.id_token, idAccessMaxAge);
  setCookie("__Host-aifm_access_token", tokens.access_token, idAccessMaxAge);

  if (tokens.refresh_token) {
    setCookie("__Host-aifm_refresh_token", tokens.refresh_token, 60 * 60 * 24 * 7);
  }

  response.cookies.delete("aifm_pkce");
  response.cookies.delete("aifm_state");
  response.cookies.delete("__Host-aifm_last_active");

  return response;
}

