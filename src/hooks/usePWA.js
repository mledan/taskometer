/**
 * usePWA Hook
 *
 * Manages PWA features including:
 * - Service worker registration
 * - Install prompt handling
 * - Online/offline detection
 * - Update notifications
 */

import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for PWA functionality
 */
export function usePWA() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [hasUpdate, setHasUpdate] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [registration, setRegistration] = useState(null);

  // Register service worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      registerServiceWorker();
    }

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }
  }, []);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Install prompt handling
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Register service worker
  async function registerServiceWorker() {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      setRegistration(reg);

      // Check for updates
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setHasUpdate(true);
            }
          });
        }
      });

      // Check for updates periodically
      setInterval(() => {
        reg.update();
      }, 60 * 60 * 1000); // Every hour

      console.log('[PWA] Service worker registered');
    } catch (error) {
      console.error('[PWA] Service worker registration failed:', error);
    }
  }

  // Trigger install prompt
  const installApp = useCallback(async () => {
    if (!deferredPrompt) {
      console.log('[PWA] No install prompt available');
      return false;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('[PWA] App installed');
      setIsInstalled(true);
    }

    setDeferredPrompt(null);
    setIsInstallable(false);
    return outcome === 'accepted';
  }, [deferredPrompt]);

  // Apply update
  const applyUpdate = useCallback(() => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    }
  }, [registration]);

  // Clear cache
  const clearCache = useCallback(async () => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' });
    }
    // Also clear local caches
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(key => caches.delete(key)));
    }
  }, []);

  return {
    isOnline,
    isInstallable,
    isInstalled,
    hasUpdate,
    installApp,
    applyUpdate,
    clearCache
  };
}

export default usePWA;
