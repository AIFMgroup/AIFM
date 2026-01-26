import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  NEXT_PUBLIC_API_URL: z.string().default('http://localhost:3000'),
  NEXT_PUBLIC_APP_URL: z.string().optional(),
  NEXTAUTH_SECRET: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  SENDGRID_API_KEY: z.string().optional(),
  SENDGRID_FROM_EMAIL: z.string().optional(),
  // AWS Configuration
  AWS_REGION: z.string().default('eu-north-1'),
  FORTNOX_ENCRYPTION_KEY: z.string().optional(),
  AIFM_CRON_SECRET: z.string().optional(),
  FORTNOX_DRY_RUN: z.string().default('false'),
});

const parsed = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  DATABASE_URL: process.env.DATABASE_URL,
  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
  SENDGRID_FROM_EMAIL: process.env.SENDGRID_FROM_EMAIL,
  AWS_REGION: process.env.AWS_REGION,
  FORTNOX_ENCRYPTION_KEY: process.env.FORTNOX_ENCRYPTION_KEY,
  AIFM_CRON_SECRET: process.env.AIFM_CRON_SECRET,
  FORTNOX_DRY_RUN: process.env.FORTNOX_DRY_RUN,
});

const isProd = parsed.NODE_ENV === 'production';

if (isProd) {
  const critical = [
    'NEXTAUTH_SECRET', 
    'FORTNOX_ENCRYPTION_KEY', 
    'AIFM_CRON_SECRET',
    'NEXT_PUBLIC_APP_URL'
  ].filter(
    (key) => !parsed[key as keyof typeof parsed]
  );
  
  if (critical.length > 0) {
    const errorMsg = `CRITICAL: Missing required environment variables in production: ${critical.join(', ')}`;
    console.error(errorMsg);
    // In some environments we might want to throw here to prevent deployment
    // throw new Error(errorMsg);
  }
}

export const env = parsed;
export { isProd };
