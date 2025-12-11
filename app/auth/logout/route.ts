import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getAuthConfig } from "@/lib/auth/config";

const cookieNames = [
  "aifm_id_token",
  "aifm_access_token",
  "aifm_refresh_token",
  "aifm_pkce",
  "aifm_state",
];

export async function GET() {
  const config = getAuthConfig();
  const response = NextResponse.redirect(
    `${config.domain}/logout?client_id=${encodeURIComponent(
      config.clientId
    )}&logout_uri=${encodeURIComponent(config.logoutUri)}`
  );

  cookieNames.forEach((name) => {
    response.cookies.delete(name);
  });

  return response;
}

