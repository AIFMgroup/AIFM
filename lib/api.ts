import "server-only";

import { HealthResponse, UserRecord } from "./types";

type ApiRequestInit = RequestInit & {
  next?: {
    revalidate?: number;
    tags?: string[];
  };
};

const getBaseUrl = () => {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;

  if (!base) {
    throw new Error(
      "NEXT_PUBLIC_API_BASE_URL is not defined. Please add it to your environment."
    );
  }

  return base.replace(/\/$/, "");
};

export async function apiFetch<T>(
  path: string,
  init?: ApiRequestInit
): Promise<T> {
  const normalizedPath = path.replace(/^\/+/, "");
  const url = `${getBaseUrl()}/${normalizedPath}`;

  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: init?.cache ?? "no-store",
    next: init?.next ?? { revalidate: 0 },
  });

  if (!response.ok) {
    const problem = await parseBody(response);
    throw new Error(
      `API request failed (${response.status} ${response.statusText}): ${problem}`
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

const parseBody = async (response: Response) => {
  try {
    const data = await response.json();
    return JSON.stringify(data);
  } catch {
    return response.statusText;
  }
};

export const getHealth = () => apiFetch<HealthResponse>("/health");

type UsersPayload =
  | UserRecord[]
  | {
      users?: UserRecord[];
      data?: UserRecord[];
    };

const normalizeUsers = (payload: UsersPayload): UserRecord[] => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload.users)) {
    return payload.users;
  }

  if (Array.isArray(payload.data)) {
    return payload.data;
  }

  return [];
};

export const getUsers = async () => normalizeUsers(await apiFetch<UsersPayload>("/users"));

