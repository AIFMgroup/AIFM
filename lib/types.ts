export type HealthResponse = {
  status: string;
  timestamp?: string;
  message?: string;
  version?: string;
  region?: string;
  uptime?: string | number;
};

export type UserRecord = {
  id: string | number;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  role?: string | null;
  status?: string | null;
  createdAt?: string | null;
  created_at?: string | null;
  updatedAt?: string | null;
  updated_at?: string | null;
};

