import { cookies } from "next/headers";
import { NextResponse } from "next/server";

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
  const response = NextResponse.redirect(
    `${config.domain}/logout?client_id=${encodeURIComponent(
      config.clientId
    )}&logout_uri=${encodeURIComponent(config.logoutUri)}`
  );
  response.headers.set("Cache-Control", "no-store");

  cookieNames.forEach((name) => {
    response.cookies.delete(name);
  });

  return response;
}
