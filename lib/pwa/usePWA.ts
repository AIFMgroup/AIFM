'use client';

import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PWAState {
  isInstalled: boolean;
  isInstallable: boolean;
  isOnline: boolean;
  isUpdateAvailable: boolean;
  registration: ServiceWorkerRegistration | null;
}

export function usePWA() {
  const [state, setState] = useState<PWAState>({
    isInstalled: false,
    isInstallable: false,
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isUpdateAvailable: false,
    registration: null,
  });
  
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  // Register Service Worker
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });

        setState(prev => ({ ...prev, registration }));

        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setState(prev => ({ ...prev, isUpdateAvailable: true }));
              }
            });
          }
        });

        // Check if already installed (standalone mode)
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches
          || (window.navigator as any).standalone
          || document.referrer.includes('android-app://');
        
        setState(prev => ({ ...prev, isInstalled: isStandalone }));

        console.log('[PWA] Service Worker registered');
      } catch (error) {
        console.error('[PWA] Service Worker registration failed:', error);
      }
    };

    registerSW();
  }, []);

  // Handle beforeinstallprompt event
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setState(prev => ({ ...prev, isInstallable: true }));
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Handle app installed event
  useEffect(() => {
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setState(prev => ({ ...prev, isInstalled: true, isInstallable: false }));
      console.log('[PWA] App installed');
    };

    window.addEventListener('appinstalled', handleAppInstalled);
    
    return () => {
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => setState(prev => ({ ...prev, isOnline: true }));
    const handleOffline = () => setState(prev => ({ ...prev, isOnline: false }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Install the app
  const install = useCallback(async () => {
    if (!deferredPrompt) return false;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setState(prev => ({ ...prev, isInstallable: false }));
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[PWA] Install failed:', error);
      return false;
    }
  }, [deferredPrompt]);

  // Update the service worker
  const update = useCallback(async () => {
    if (!state.registration) return;

    try {
      await state.registration.update();
      
      // If there's a waiting worker, skip waiting and reload
      if (state.registration.waiting) {
        state.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        window.location.reload();
      }
    } catch (error) {
      console.error('[PWA] Update failed:', error);
    }
  }, [state.registration]);

  // Request notification permission
  const requestNotificationPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      console.warn('[PWA] Notifications not supported');
      return 'unsupported';
    }

    const permission = await Notification.requestPermission();
    return permission;
  }, []);

  // Subscribe to push notifications
  const subscribeToPush = useCallback(async (vapidPublicKey: string) => {
    if (!state.registration) return null;

    try {
      const keyArray = urlBase64ToUint8Array(vapidPublicKey);
      const subscription = await state.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyArray.buffer as ArrayBuffer,
      });
      
      return subscription;
    } catch (error) {
      console.error('[PWA] Push subscription failed:', error);
      return null;
    }
  }, [state.registration]);

  return {
    ...state,
    install,
    update,
    requestNotificationPermission,
    subscribeToPush,
  };
}

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
