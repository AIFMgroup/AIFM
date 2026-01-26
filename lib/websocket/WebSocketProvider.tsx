'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';

// ============ Types ============
export type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface WebSocketMessage {
  type: 'notification' | 'document_update' | 'approval_request' | 'sync_status' | 'chat_message' | 'system';
  payload: any;
  timestamp: string;
  id: string;
}

interface WebSocketContextValue {
  status: WebSocketStatus;
  lastMessage: WebSocketMessage | null;
  sendMessage: (message: any) => void;
  subscribe: (type: string, callback: (payload: any) => void) => () => void;
  reconnect: () => void;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

// ============ Hook ============
export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within WebSocketProvider');
  }
  return context;
}

// Specific hooks for common use cases
export function useRealtimeNotifications(onNotification: (notification: any) => void) {
  const { subscribe } = useWebSocket();
  
  useEffect(() => {
    const unsubscribe = subscribe('notification', onNotification);
    return unsubscribe;
  }, [subscribe, onNotification]);
}

export function useDocumentUpdates(onUpdate: (update: any) => void) {
  const { subscribe } = useWebSocket();
  
  useEffect(() => {
    const unsubscribe = subscribe('document_update', onUpdate);
    return unsubscribe;
  }, [subscribe, onUpdate]);
}

export function useApprovalRequests(onRequest: (request: any) => void) {
  const { subscribe } = useWebSocket();
  
  useEffect(() => {
    const unsubscribe = subscribe('approval_request', onRequest);
    return unsubscribe;
  }, [subscribe, onRequest]);
}

// ============ Provider ============
interface WebSocketProviderProps {
  children: React.ReactNode;
  url?: string;
}

export function WebSocketProvider({ children, url }: WebSocketProviderProps) {
  const [status, setStatus] = useState<WebSocketStatus>('disconnected');
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const subscribersRef = useRef<Map<string, Set<(payload: any) => void>>>(new Map());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY_BASE = 1000;

  const getWebSocketUrl = useCallback(() => {
    if (url) return url;
    
    // Auto-detect WebSocket URL from current location
    if (typeof window !== 'undefined') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${window.location.host}/api/ws`;
    }
    return null;
  }, [url]);

  const connect = useCallback(() => {
    const wsUrl = getWebSocketUrl();
    if (!wsUrl) return;

    // Don't connect if already connected or connecting
    if (wsRef.current?.readyState === WebSocket.OPEN || 
        wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    setStatus('connecting');

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('connected');
        reconnectAttemptsRef.current = 0;
        console.log('[WebSocket] Connected');
        
        // Send auth token if available
        const token = document.cookie
          .split('; ')
          .find(row => row.startsWith('__Host-aifm_id_token='))
          ?.split('=')[1];
        
        if (token) {
          ws.send(JSON.stringify({ type: 'auth', token }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(message);
          
          // Notify subscribers
          const subscribers = subscribersRef.current.get(message.type);
          if (subscribers) {
            subscribers.forEach(callback => callback(message.payload));
          }
          
          // Also notify 'all' subscribers
          const allSubscribers = subscribersRef.current.get('*');
          if (allSubscribers) {
            allSubscribers.forEach(callback => callback(message));
          }
        } catch (e) {
          console.error('[WebSocket] Failed to parse message:', e);
        }
      };

      ws.onclose = (event) => {
        setStatus('disconnected');
        console.log('[WebSocket] Disconnected:', event.code, event.reason);
        
        // Attempt to reconnect if not a clean close
        if (event.code !== 1000 && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          const delay = RECONNECT_DELAY_BASE * Math.pow(2, reconnectAttemptsRef.current);
          reconnectAttemptsRef.current++;
          
          console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        }
      };

      ws.onerror = (error) => {
        setStatus('error');
        console.error('[WebSocket] Error:', error);
      };
    } catch (error) {
      setStatus('error');
      console.error('[WebSocket] Failed to connect:', error);
    }
  }, [getWebSocketUrl]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnect');
      wsRef.current = null;
    }
    
    setStatus('disconnected');
  }, []);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('[WebSocket] Cannot send message: not connected');
    }
  }, []);

  const subscribe = useCallback((type: string, callback: (payload: any) => void) => {
    if (!subscribersRef.current.has(type)) {
      subscribersRef.current.set(type, new Set());
    }
    subscribersRef.current.get(type)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      subscribersRef.current.get(type)?.delete(callback);
    };
  }, []);

  const reconnect = useCallback(() => {
    disconnect();
    reconnectAttemptsRef.current = 0;
    connect();
  }, [connect, disconnect]);

  // Connect on mount
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  // Handle visibility change (reconnect when tab becomes visible)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && status === 'disconnected') {
        reconnect();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [status, reconnect]);

  const value: WebSocketContextValue = {
    status,
    lastMessage,
    sendMessage,
    subscribe,
    reconnect,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

// ============ Status Indicator Component ============
export function WebSocketStatusIndicator() {
  const { status, reconnect } = useWebSocket();
  
  const statusConfig = {
    connecting: { color: 'bg-amber-500', text: 'Ansluter...', pulse: true },
    connected: { color: 'bg-emerald-500', text: 'Ansluten', pulse: false },
    disconnected: { color: 'bg-gray-400', text: 'Frånkopplad', pulse: false },
    error: { color: 'bg-red-500', text: 'Fel', pulse: false },
  };
  
  const config = statusConfig[status];
  
  return (
    <button
      onClick={status !== 'connected' ? reconnect : undefined}
      className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 transition-colors"
      title={status !== 'connected' ? 'Klicka för att återansluta' : 'Realtidsanslutning aktiv'}
    >
      <span className={`w-2 h-2 rounded-full ${config.color} ${config.pulse ? 'animate-pulse' : ''}`} />
      <span className="hidden sm:inline">{config.text}</span>
    </button>
  );
}



