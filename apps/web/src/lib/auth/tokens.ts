import { JWTPayload, createRemoteJWKSet, jwtVerify } from "jose";

import { getAuthConfig, getIssuer } from "./config";

type CachedJwks = ReturnType<typeof createRemoteJWKSet>;

let jwks: CachedJwks | null = null;

const getJwks = () => {
  if (!jwks) {
    const issuer = getIssuer();
    jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
  }
  return jwks;
};

export const verifyIdToken = async (token: string): Promise<JWTPayload> => {
  const config = getAuthConfig();
  const issuer = getIssuer();
  const jwkSet = getJwks();

  const { payload } = await jwtVerify(token, jwkSet, {
    issuer,
    audience: config.clientId,
  });

  return payload;
};
