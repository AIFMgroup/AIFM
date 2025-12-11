import crypto from "node:crypto";

const base64UrlEncode = (buffer: Buffer) =>
  buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

export const generateCodeVerifier = () =>
  base64UrlEncode(crypto.randomBytes(32));

export const generateCodeChallenge = (verifier: string) =>
  base64UrlEncode(crypto.createHash("sha256").update(verifier).digest());

export const generateState = () =>
  base64UrlEncode(crypto.randomBytes(16));

