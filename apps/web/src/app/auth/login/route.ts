import { getAuthConfig } from "@/lib/auth/config";
import {
  generateCodeChallenge,
  generateCodeVerifier,
  generateState,
} from "@/lib/auth/pkce";

export async function GET(req: Request) {
  const config = getAuthConfig();
  const url = new URL(req.url);
  const returnTo = url.searchParams.get("returnTo") ?? "/";

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = generateState();

  const loginUrl = new URL(`${config.domain}/oauth2/authorize`);
  loginUrl.searchParams.set("client_id", config.clientId);
  loginUrl.searchParams.set("response_type", "code");
  loginUrl.searchParams.set("scope", "openid email profile");
  loginUrl.searchParams.set("redirect_uri", config.redirectUri);
  loginUrl.searchParams.set("state", state);
  loginUrl.searchParams.set("code_challenge_method", "S256");
  loginUrl.searchParams.set("code_challenge", codeChallenge);

  // Return an HTML page that sets cookies and then redirects.
  // This ensures cookies are stored before navigating away.
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Redirecting to login...</title>
  <meta http-equiv="refresh" content="0;url=${loginUrl.toString()}">
</head>
<body style="font-family: system-ui; padding: 40px; text-align: center;">
  <p>Redirecting to login...</p>
  <script>
    // Fallback redirect
    setTimeout(function() {
      window.location.href = "${loginUrl.toString()}";
    }, 100);
  </script>
</body>
</html>`;

  const response = new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html",
      "Cache-Control": "no-store",
    },
  });

  // Set cookies properly using append to handle multiple Set-Cookie headers
  response.headers.append(
    "Set-Cookie",
    `aifm_pkce=${codeVerifier}; Path=/; Max-Age=900; Secure; HttpOnly; SameSite=Lax`
  );
  response.headers.append(
    "Set-Cookie",
    `aifm_state=${encodeURIComponent(JSON.stringify({ state, returnTo }))}; Path=/; Max-Age=900; Secure; HttpOnly; SameSite=Lax`
  );

  return response;
}
