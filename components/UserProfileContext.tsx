'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type UserProfileDto = {
  sub: string;
  email?: string;
  displayName?: string;
  title?: string;
  avatarKey?: string;
  avatarUpdatedAt?: string;
  updatedAt?: string;
};

type UserProfileContextValue = {
  profile: UserProfileDto | null;
  loading: boolean;
  refresh: () => Promise<void>;
  avatarSrc: string | null;
};

const UserProfileContext = createContext<UserProfileContextValue | null>(null);

export function UserProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfileDto | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/profile', { cache: 'no-store' });
      if (!res.ok) {
        setProfile(null);
        return;
      }
      const data = (await res.json()) as UserProfileDto;
      setProfile(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const avatarSrc = useMemo(() => {
    if (!profile?.avatarKey) return null;
    const v = encodeURIComponent(profile.avatarUpdatedAt || profile.updatedAt || '');
    return `/api/profile/avatar${v ? `?v=${v}` : ''}`;
  }, [profile?.avatarKey, profile?.avatarUpdatedAt, profile?.updatedAt]);

  const value = useMemo(
    () => ({ profile, loading, refresh, avatarSrc }),
    [profile, loading, refresh, avatarSrc]
  );

  return <UserProfileContext.Provider value={value}>{children}</UserProfileContext.Provider>;
}

export function useUserProfile() {
  const ctx = useContext(UserProfileContext);
  // Return a safe default instead of throwing during SSR
  if (!ctx) {
    return {
      profile: null,
      loading: true,
      refresh: async () => {},
      avatarSrc: null,
    };
  }
  return ctx;
}


