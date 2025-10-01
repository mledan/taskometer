// Centralized configuration for environment variables
// This ensures all sensitive data is accessed from a single source

const config = {
  google: {
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    apiKey: import.meta.env.VITE_GOOGLE_API_KEY,
    discoveryDoc: 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest',
    scopes: 'https://www.googleapis.com/auth/calendar.events'
  },
  environment: import.meta.env.VITE_ENV || 'development',
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD
};

// Validate required environment variables
export function validateEnvironment() {
  const required = ['VITE_GOOGLE_CLIENT_ID', 'VITE_GOOGLE_API_KEY'];
  const missing = [];

  for (const key of required) {
    if (!import.meta.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0 && config.isProduction) {
    console.error('Missing required environment variables:', missing);
    console.warn('Please check your .env file or deployment configuration');
  }

  return missing.length === 0;
}

// Check if Google API is properly configured
export function isGoogleConfigured() {
  return !!(config.google.clientId && 
           config.google.apiKey && 
           config.google.clientId !== 'YOUR_CLIENT_ID' &&
           config.google.apiKey !== 'YOUR_API_KEY');
}

export default config;