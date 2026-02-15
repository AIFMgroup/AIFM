import { cookies } from "next/headers";

import { verifyIdToken } from "./tokens";

export type Session = {
  email?: string;
  name?: string;
  groups?: string[];
};

export const getSession = async (): Promise<Session | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get("__Host-aifm_id_token")?.value;

  if (!token) {
    return null;
  }

  try {
    const payload = await verifyIdToken(token);
    return {
      email: (payload.email as string) ?? undefined,
      name: (payload.name as string) ?? (payload["custom:name"] as string),
      groups: (payload["cognito:groups"] as string[]) ?? [],
    };
  } catch (error) {
    console.error("Failed to verify session token", error);
    return null;
  }
};

/** Returns a stable user id from the current session (Cognito). Use for integration token stores. */
export async function getUserIdFromSession(): Promise<string | null> {
  const session = await getSession();
  if (!session?.email) return null;
  return session.email;
}