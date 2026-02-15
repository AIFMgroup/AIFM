'use client';

import { ReactNode } from 'react';

/**
 * Single message bubble in chat. Used by FullscreenChatPage;
 * the full message UI (markdown, citations, actions) lives in
 * FullscreenChatPage and can be moved here incrementally.
 */
export function MessageBubble({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
