import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  NEXT_PUBLIC_API_URL: z.string().default('http://localhost:3000'),
  NEXTAUTH_SECRET: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  SENDGRID_API_KEY: z.string().optional(),
  SENDGRID_FROM_EMAIL: z.string().optional(),
});

const parsed = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  DATABASE_URL: process.env.DATABASE_URL,
  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
  SENDGRID_FROM_EMAIL: process.env.SENDGRID_FROM_EMAIL,
});

const isProd = parsed.NODE_ENV === 'production';

if (isProd) {
  const missing = ['NEXTAUTH_SECRET', 'DATABASE_URL'].filter((key) => !parsed[key as keyof typeof parsed]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables in production: ${missing.join(', ')}`);
  }
}

export const env = parsed;
export { isProd };
