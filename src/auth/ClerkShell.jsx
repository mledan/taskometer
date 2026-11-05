import { ClerkProvider } from '@clerk/clerk-react';
import { CLERK_PUBLISHABLE_KEY } from '../services/auth.js';
import AuthBoot from './AuthBoot.jsx';

// Lazy-loaded by App.jsx so @clerk/* only ships on routes that need auth.
export default function ClerkShell({ children }) {
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} afterSignOutUrl="/">
      <AuthBoot />
      {children}
    </ClerkProvider>
  );
}
