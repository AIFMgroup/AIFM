'use client';

import { FullscreenChatPage } from '@/components/chat/FullscreenChatPage';

/**
 * Main chat page – uses shared FullscreenChatPage component.
 * AIFM Agent (app/(dashboard)/aifm-agent/page.tsx) and Compliance Chat
 * (app/compliance/chat/page.tsx) can reuse FullscreenChatPage with
 * configurable features (e.g. showTemplates, showShare, apiEndpoint).
 */
export default function ChatPage() {
  return <FullscreenChatPage />;
}
