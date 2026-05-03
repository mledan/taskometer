/**
 * AuthBoot — wires the Clerk token getter into apiClient and triggers
 * the claim flow when the user finishes sign-up.
 *
 * Lives inside <ClerkProvider> so it can use Clerk's React hooks.
 * Renders nothing — pure side effects.
 *
 * Behavior:
 *   1. On every render, point apiClient's token getter at Clerk's
 *      session.getToken so subsequent fetches send Authorization.
 *   2. The first time we observe a signed-in state with a device id
 *      still in localStorage, POST /api/v2/claim and clear the
 *      device id on success.
 */

import { useEffect, useRef } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { configureApiClient, claimDevice } from '../services/apiClient.js';
import { getDeviceId, clearDeviceId } from '../services/identity.js';

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
