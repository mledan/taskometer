/**
 * Starts a Stripe Checkout session for a paid plan. `getToken` is an
 * optional async function returning a Clerk session JWT; when present it
 * is sent as a Bearer token so the server can attach userId to Stripe
 * metadata. Falls back to a mailto when the plan isn't checkout-ready.
 */
export async function startCheckout({ plan, ready, getToken }) {
  if (!ready) {
    window.location.href = `mailto:hello@taskometer.app?subject=Notify%20me%20when%20${encodeURIComponent(plan.name)}%20launches`;
    return;
  }
  const headers = { 'Content-Type': 'application/json' };
  if (typeof getToken === 'function') {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch('/api/checkout-session', {
    method: 'POST',
    headers,
    body: JSON.stringify({ planId: plan.id }),
  });
  if (!res.ok) throw new Error(`checkout failed: ${res.status}`);
  const { url } = await res.json();
  if (url) window.location.href = url;
}
