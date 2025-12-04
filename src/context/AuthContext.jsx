/**
 * AuthContext
 *
 * Authentication context and provider for managing user sessions.
 * Supports Google and Apple OAuth login (when configured).
 * The app works fully offline without authentication.
 *
 * TODO: Replace placeholder implementations with actual OAuth flows
 * - Google: Use @react-oauth/google or Google Identity Services
 * - Apple: Use react-apple-login or Sign in with Apple JS
 */

import { createContext, useContext, useReducer, useCallback, useEffect } from 'react';

// Auth action types
const AUTH_ACTIONS = {
  LOGIN_START: 'LOGIN_START',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_ERROR: 'LOGIN_ERROR',
  LOGOUT: 'LOGOUT',
  UPDATE_USER: 'UPDATE_USER',
  SET_SYNC_STATUS: 'SET_SYNC_STATUS',
  CLEAR_ERROR: 'CLEAR_ERROR'
};

// Initial state
const initialState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  provider: null, // 'google' | 'apple' | null
  syncStatus: {
    google: { enabled: false, lastSync: null, status: 'idle' },
    apple: { enabled: false, lastSync: null, status: 'idle' }
  }
};

// Auth reducer
function authReducer(state, action) {
  switch (action.type) {
    case AUTH_ACTIONS.LOGIN_START:
      return {
        ...state,
        isLoading: true,
        error: null
      };

    case AUTH_ACTIONS.LOGIN_SUCCESS:
      return {
        ...state,
        user: action.payload.user,
        isAuthenticated: true,
        isLoading: false,
        provider: action.payload.provider,
        error: null
      };

    case AUTH_ACTIONS.LOGIN_ERROR:
      return {
        ...state,
        isLoading: false,
        error: action.payload
      };

    case AUTH_ACTIONS.LOGOUT:
      return {
        ...initialState
      };

    case AUTH_ACTIONS.UPDATE_USER:
      return {
        ...state,
        user: { ...state.user, ...action.payload }
      };

    case AUTH_ACTIONS.SET_SYNC_STATUS:
      return {
        ...state,
        syncStatus: {
          ...state.syncStatus,
          [action.payload.provider]: {
            ...state.syncStatus[action.payload.provider],
            ...action.payload.status
          }
        }
      };

    case AUTH_ACTIONS.CLEAR_ERROR:
      return {
        ...state,
        error: null
      };

    default:
      return state;
  }
}

// Create context
const AuthContext = createContext(null);

// Storage key for persisting auth state
const AUTH_STORAGE_KEY = 'taskometer_auth';

/**
 * AuthProvider Component
 */
export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Load persisted auth state on mount
  useEffect(() => {
    const savedAuth = localStorage.getItem(AUTH_STORAGE_KEY);
    if (savedAuth) {
      try {
        const parsed = JSON.parse(savedAuth);
        // Validate token is still valid
        if (parsed.user && parsed.tokenExpiry && new Date(parsed.tokenExpiry) > new Date()) {
          dispatch({
            type: AUTH_ACTIONS.LOGIN_SUCCESS,
            payload: {
              user: parsed.user,
              provider: parsed.provider
            }
          });
        } else {
          // Token expired, clear storage
          localStorage.removeItem(AUTH_STORAGE_KEY);
        }
      } catch (e) {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    }
  }, []);

  // Persist auth state changes
  useEffect(() => {
    if (state.isAuthenticated && state.user) {
      const toSave = {
        user: state.user,
        provider: state.provider,
        tokenExpiry: state.user.tokenExpiry
      };
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(toSave));
    }
  }, [state.isAuthenticated, state.user, state.provider]);

  /**
   * Login with Google
   *
   * TODO: Implement actual Google OAuth flow
   * 1. Initialize Google Identity Services
   * 2. Trigger sign-in popup/redirect
   * 3. Exchange authorization code for tokens
   * 4. Fetch user profile
   * 5. Store tokens securely
   */
  const loginWithGoogle = useCallback(async () => {
    dispatch({ type: AUTH_ACTIONS.LOGIN_START });

    try {
      // TODO: Replace with actual Google OAuth implementation
      // Example with Google Identity Services:
      // const client = google.accounts.oauth2.initTokenClient({
      //   client_id: process.env.VITE_GOOGLE_CLIENT_ID,
      //   scope: 'https://www.googleapis.com/auth/calendar',
      //   callback: handleGoogleCallback
      // });
      // client.requestAccessToken();

      // Placeholder: Simulate login failure until configured
      throw new Error(
        'Google login not configured. ' +
        'Please set VITE_GOOGLE_CLIENT_ID in your environment variables.'
      );

    } catch (error) {
      dispatch({
        type: AUTH_ACTIONS.LOGIN_ERROR,
        payload: error.message
      });
      throw error;
    }
  }, []);

  /**
   * Login with Apple
   *
   * TODO: Implement actual Apple Sign-In flow
   * 1. Initialize Apple JS SDK
   * 2. Trigger sign-in popup
   * 3. Validate identity token
   * 4. Exchange for session
   */
  const loginWithApple = useCallback(async () => {
    dispatch({ type: AUTH_ACTIONS.LOGIN_START });

    try {
      // TODO: Replace with actual Apple Sign-In implementation
      // Example with Apple JS SDK:
      // const response = await AppleID.auth.signIn();
      // const { authorization, user } = response;

      // Placeholder: Simulate login failure until configured
      throw new Error(
        'Apple login not configured. ' +
        'Please set VITE_APPLE_CLIENT_ID in your environment variables.'
      );

    } catch (error) {
      dispatch({
        type: AUTH_ACTIONS.LOGIN_ERROR,
        payload: error.message
      });
      throw error;
    }
  }, []);

  /**
   * Logout
   */
  const logout = useCallback(async () => {
    // Clear any provider-specific tokens
    // TODO: Revoke Google/Apple tokens if needed

    localStorage.removeItem(AUTH_STORAGE_KEY);
    dispatch({ type: AUTH_ACTIONS.LOGOUT });
  }, []);

  /**
   * Check if calendar sync is available for a provider
   */
  const canSync = useCallback((provider) => {
    if (!state.isAuthenticated) return false;
    if (provider === 'google') return state.provider === 'google';
    if (provider === 'apple') return state.provider === 'apple';
    return false;
  }, [state.isAuthenticated, state.provider]);

  /**
   * Update sync status
   */
  const updateSyncStatus = useCallback((provider, status) => {
    dispatch({
      type: AUTH_ACTIONS.SET_SYNC_STATUS,
      payload: { provider, status }
    });
  }, []);

  /**
   * Get access token for API calls
   *
   * TODO: Implement token refresh logic
   */
  const getAccessToken = useCallback(async () => {
    if (!state.isAuthenticated || !state.user?.accessToken) {
      return null;
    }

    // TODO: Check if token is expired and refresh if needed
    // const isExpired = new Date(state.user.tokenExpiry) < new Date();
    // if (isExpired) {
    //   await refreshToken();
    // }

    return state.user.accessToken;
  }, [state.isAuthenticated, state.user]);

  /**
   * Clear auth error
   */
  const clearError = useCallback(() => {
    dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });
  }, []);

  const value = {
    // State
    user: state.user,
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    error: state.error,
    provider: state.provider,
    syncStatus: state.syncStatus,

    // Actions
    loginWithGoogle,
    loginWithApple,
    logout,
    canSync,
    updateSyncStatus,
    getAccessToken,
    clearError
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access auth context
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * Hook to check if user is authenticated
 */
export function useIsAuthenticated() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated;
}

/**
 * Hook to get current user
 */
export function useUser() {
  const { user } = useAuth();
  return user;
}

/**
 * Hook to check if sync is available
 */
export function useCanSync(provider) {
  const { canSync } = useAuth();
  return canSync(provider);
}

export default AuthContext;
