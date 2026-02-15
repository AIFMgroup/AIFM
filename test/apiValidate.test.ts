/**
 * Unit tests for API request validation (Zod schemas)
 */

import { describe, expect, test } from 'vitest';
import { parseOr400, slackPostBodySchema, dropboxPostBodySchema } from '../lib/api/validate';

describe('parseOr400', () => {
  test('returns ok and data when schema parses', () => {
    const result = parseOr400(slackPostBodySchema, { action: 'send-message', channel: 'C1', text: 'hello' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.action).toBe('send-message');
      expect(result.data.channel).toBe('C1');
      expect(result.data.text).toBe('hello');
    }
  });

  test('returns 400 response when required field missing', () => {
    const result = parseOr400(slackPostBodySchema, { action: 'send-message', channel: 'C1' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
    }
  });
});

describe('dropboxPostBodySchema', () => {
  test('accepts sync action', () => {
    const result = parseOr400(dropboxPostBodySchema, { action: 'sync' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.action).toBe('sync');
  });

  test('accepts update-folders with folders array', () => {
    const result = parseOr400(dropboxPostBodySchema, { action: 'update-folders', folders: ['/a', '/b'] });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.folders).toEqual(['/a', '/b']);
  });
});
