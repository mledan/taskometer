/**
 * AuthBoot — wires Clerk into the existing app shell.
 *
 *  1. Points apiClient's token getter at Clerk's getToken so every
 *     /api/v2 fetch carries Authorization: Bearer <jwt>.
 *  2. Mirrors Clerk's signed-in state into the legacy
 *     `taskometer.auth` localStorage key. The existing header chip,
 *     AccountPanel, and welcome-popup gate all read that key — by
 *     mirroring we get a single auth UI instead of duplicate flows.
 *  3. On the first signed-in observation with a stale device id,
 *     POSTs /api/v2/claim to migrate ephemeral docs onto the Clerk
 *     userId, then clears the device id.
 *
 * Renders nothing.
 */

import { useEffect, useRef } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { configureApiClient, claimDevice } from '../services/apiClient.js';
import { getDeviceId, clearDeviceId } from '../services/identity.js';
import { readAuth, writeAuth, clearAuth } from '../taskometer/WelcomePopup.jsx';

export default function AuthBoot() {
  const { isLoaded, isSignedIn, getToken, userId } = useAuth();
  const { user } = useUser();
  const claimedRef = useRef(false);

  // Wire the token getter once Clerk is ready.
  useEffect(() => {
    if (!isLoaded) return;
    configureApiClient({
      getToken: isSignedIn ? () => getToken() : () => null,
    });
  }, [isLoaded, isSignedIn, getToken]);

  // Mirror Clerk → legacy `taskometer.auth` so the rest of the app
  // (header chip, AccountPanel, welcome-popup gate) keeps working
  // unmodified. Sign-out clears the legacy key too.
  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn && user) {
      const existing = readAuth() || {};
      const profile = {
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        username: user.username || (user.primaryEmailAddress?.emailAddress || '').split('@')[0] || '',
        email: user.primaryEmailAddress?.emailAddress || null,
        avatarUrl: user.imageUrl || null,
      };
      writeAuth({
        mode: 'clerk',
        clerkUserId: userId,
        profile,
        createdAt: existing.createdAt || new Date().toISOString(),
      });
    } else if (isLoaded && !isSignedIn) {
      // Only clear the mirror, not other taskometer-* keys. And only
      // when the existing record IS a Clerk record — local-only
      // profiles (mode: 'account') predate Clerk and we shouldn't
      // step on them.
      const existing = readAuth();
      if (existing?.mode === 'clerk') clearAuth();
    }
  }, [isLoaded, isSignedIn, userId, user]);

  // Trigger claim on first signed-in observation with a stale device id.
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId || claimedRef.current) return;
    const deviceId = getDeviceId();
    if (!deviceId) return;

    claimedRef.current = true;
    (async () => {
      try {
        const result = await claimDevice(deviceId);
        if (result?.totalDocs > 0) {
          // eslint-disable-next-line no-console
          console.info('[claim] migrated', result.totalDocs, 'docs to', userId, result.claimed);
        }
        clearDeviceId();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[claim] failed — will retry on next sign-in:', err?.message);
        claimedRef.current = false;
      }
    })();
  }, [isLoaded, isSignedIn, userId, user]);

  return null;
}
