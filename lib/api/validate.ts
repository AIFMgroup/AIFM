/**
 * Shared request body validation using Zod for API routes.
 * Use parseOr400(schema, body) to validate and return 400 on failure.
 */

import { z, type ZodSchema } from 'zod';
import { NextResponse } from 'next/server';

export function parseOr400<T>(schema: ZodSchema<T>, data: unknown): { ok: true; data: T } | { ok: false; response: NextResponse } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  const first = result.error.flatten();
  const message = typeof first.formErrors?.[0] === 'string' ? first.formErrors[0] : result.error.message;
  return {
    ok: false,
    response: NextResponse.json(
      { error: 'Validation failed', message: message || 'Invalid request body', details: first.fieldErrors },
      { status: 400 }
    ),
  };
}

// Reusable fragments
export const slackSendMessageSchema = z.object({
  action: z.literal('send-message'),
  channel: z.string().min(1, 'channel required'),
  text: z.string().min(1, 'text required'),
  threadTs: z.string().optional(),
});
export const slackSendDmSchema = z.object({
  action: z.literal('send-dm'),
  userId: z.string().min(1, 'userId required'),
  text: z.string().min(1, 'text required'),
});
export const slackGetHistorySchema = z.object({
  action: z.literal('get-history'),
  channel: z.string().min(1, 'channel required'),
  limit: z.number().int().min(1).max(200).optional(),
});
export const slackPostBodySchema = z.discriminatedUnion('action', [
  slackSendMessageSchema,
  slackSendDmSchema,
  slackGetHistorySchema,
]);

export const dropboxPostBodySchema = z.object({
  action: z.enum(['sync', 'update-folders']),
  folders: z.array(z.string()).optional(),
});

export const ms365CreateEventSchema = z.object({
  action: z.literal('create-event'),
  subject: z.string(),
  start: z.string(),
  end: z.string(),
  attendees: z.array(z.string()).optional(),
  location: z.string().optional(),
  body: z.string().optional(),
  isOnlineMeeting: z.boolean().optional(),
});
export const ms365SendEmailSchema = z.object({
  action: z.literal('send-email'),
  to: z.union([z.string().email(), z.array(z.string())]),
  subject: z.string(),
  body: z.string(),
  cc: z.array(z.string()).optional(),
  importance: z.enum(['low', 'normal', 'high']).optional(),
});
export const ms365SearchEmailsSchema = z.object({
  action: z.literal('search-emails'),
  query: z.string(),
  limit: z.number().int().min(1).max(100).optional(),
});
export const ms365CheckAvailabilitySchema = z.object({
  action: z.literal('check-availability'),
  emails: z.array(z.string()),
  startDate: z.string(),
  endDate: z.string(),
});
export const ms365PostBodySchema = z.discriminatedUnion('action', [
  ms365CreateEventSchema,
  ms365SendEmailSchema,
  ms365SearchEmailsSchema,
  ms365CheckAvailabilitySchema,
]);
