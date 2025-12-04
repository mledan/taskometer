/**
 * PWAStatus Component
 *
 * Shows PWA status indicators including:
 * - Offline status banner
 * - Install prompt
 * - Update available notification
 */

import { useState, useEffect } from 'react';
import { usePWA } from '../hooks/usePWA';
import styles from './PWAStatus.module.css';

function PWAStatus() {
  const {
    isOnline,
    isInstallable,
    isInstalled,
    hasUpdate,
    installApp,
    applyUpdate
  } = usePWA();

  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const [installDismissed, setInstallDismissed] = useState(false);

  // Show install banner after a delay (don't annoy users immediately)
  useEffect(() => {
    if (isInstallable && !isInstalled && !installDismissed) {
      const timer = setTimeout(() => {
        setShowInstallBanner(true);
      }, 30000); // Show after 30 seconds
      return () => clearTimeout(timer);
    }
  }, [isInstallable, isInstalled, installDismissed]);

  // Show update banner when available
  useEffect(() => {
    if (hasUpdate) {
      setShowUpdateBanner(true);
    }
  }, [hasUpdate]);

  // Handle install click
  async function handleInstall() {
    const installed = await installApp();
    if (installed) {
      setShowInstallBanner(false);
    }
  }

  // Handle install dismiss
  function handleInstallDismiss() {
    setShowInstallBanner(false);
    setInstallDismissed(true);
    // Remember dismissal for this session
    sessionStorage.setItem('pwa-install-dismissed', 'true');
  }

  // Handle update click
  function handleUpdate() {
    applyUpdate();
    setShowUpdateBanner(false);
  }

  return (
    <>
      {/* Offline Banner */}
      {!isOnline && (
        <div className={styles.offlineBanner}>
          <span className={styles.offlineIcon}>📴</span>
          <span>You're offline. Changes will sync when you reconnect.</span>
        </div>
      )}

      {/* Install Banner */}
      {showInstallBanner && (
        <div className={styles.installBanner}>
          <div className={styles.bannerContent}>
            <span className={styles.bannerIcon}>📱</span>
            <div className={styles.bannerText}>
              <strong>Install Taskometer</strong>
              <span>Add to your home screen for quick access</span>
            </div>
          </div>
          <div className={styles.bannerActions}>
            <button
              className={styles.dismissButton}
              onClick={handleInstallDismiss}
            >
              Not now
            </button>
            <button
              className={styles.installButton}
              onClick={handleInstall}
            >
              Install
            </button>
          </div>
        </div>
      )}

      {/* Update Banner */}
      {showUpdateBanner && (
        <div className={styles.updateBanner}>
          <div className={styles.bannerContent}>
            <span className={styles.bannerIcon}>🔄</span>
            <div className={styles.bannerText}>
              <strong>Update Available</strong>
              <span>A new version of Taskometer is ready</span>
            </div>
          </div>
          <div className={styles.bannerActions}>
            <button
              className={styles.dismissButton}
              onClick={() => setShowUpdateBanner(false)}
            >
              Later
            </button>
            <button
              className={styles.updateButton}
              onClick={handleUpdate}
            >
              Update Now
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default PWAStatus;
