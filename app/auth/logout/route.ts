import { getAuthConfig } from "@/lib/auth/config";

const cookieNames = [
  "__Host-aifm_id_token",
  "__Host-aifm_access_token",
  "__Host-aifm_refresh_token",
  "aifm_pkce",
  "aifm_state",
  "__Host-aifm_last_active",
];

export async function GET() {
  const config = getAuthConfig();
  const cognitoLogoutUrl = `${config.domain}/logout?client_id=${encodeURIComponent(
    config.clientId
  )}&logout_uri=${encodeURIComponent(config.logoutUri)}`;

  // Use an HTML page that clears cookies and caches before navigating to
  // Cognito's /logout endpoint. This ensures the local session is fully
  // destroyed before Cognito redirects back, preventing auto-re-login.
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Loggar ut...</title>
</head>
<body style="font-family: system-ui; padding: 40px; text-align: center;">
  <p>Loggar ut&hellip;</p>
  <script>
    // Clear all app cookies
    ${JSON.stringify(cookieNames)}.forEach(function(name) {
      document.cookie = name + '=; Path=/; Max-Age=0; Secure; SameSite=Lax';
    });
    // Unregister service workers so cached pages don't keep the session alive
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function(regs) {
        regs.forEach(function(r) { r.unregister(); });
      });
    }
    // Navigate to Cognito logout (clears Cognito session, then redirects back)
    window.location.replace(${JSON.stringify(cognitoLogoutUrl)});
  </script>
  <noscript><meta http-equiv="refresh" content="0;url=${cognitoLogoutUrl}"></noscript>
</body>
</html>`;

  const response = new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });

  // Also delete cookies server-side (belt and suspenders)
  cookieNames.forEach((name) => {
    response.headers.append(
      "Set-Cookie",
      `${name}=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax`
    );
  });

  return response;
}

