# Taskometer Deployment Guide

## 🔐 Environment Variables Security

This application uses **dotenv-vault** for secure environment variable management. Your API keys are encrypted and never exposed in the codebase.

## Setup Instructions

### 1. Local Development

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Add your API credentials to `.env` (already configured)

3. Run the development server:
```bash
npm run dev
```

### 2. Production Deployment

#### Using Dotenv Vault (Recommended)

The application is configured to use dotenv-vault for secure deployments:

1. **Build the encrypted vault:**
```bash
npx dotenv-vault build
```

2. **Get your decryption key:**
```bash
npx dotenv-vault keys production
```
This will output: `DOTENV_KEY=dotenv://:key_xxxx@dotenv.local/vault/.env.vault?environment=production`

3. **Deploy to your platform:**

##### Vercel
```bash
vercel --prod --env DOTENV_KEY="dotenv://:key_xxxx@dotenv.local/vault/.env.vault?environment=production"
```

##### Netlify
Add to netlify.toml:
```toml
[build.environment]
  DOTENV_KEY = "dotenv://:key_xxxx@dotenv.local/vault/.env.vault?environment=production"
```

##### GitHub Pages with Actions
Add to GitHub Secrets:
- Name: `DOTENV_KEY`
- Value: `dotenv://:key_xxxx@dotenv.local/vault/.env.vault?environment=production`

##### Railway/Render/Fly.io
Set environment variable in dashboard:
```
DOTENV_KEY=dotenv://:key_xxxx@dotenv.local/vault/.env.vault?environment=production
```

### 3. Manual Deployment (Alternative)

If not using dotenv-vault, set these environment variables in your hosting platform:

```
VITE_GOOGLE_CLIENT_ID=your_client_id
VITE_GOOGLE_API_KEY=your_api_key
```

## 🔒 Security Best Practices

1. **NEVER commit `.env` files** - They're gitignored for a reason
2. **Use `.env.vault`** - This file is encrypted and safe to commit
3. **Rotate keys regularly** - Update in dotenv-vault dashboard
4. **Different keys per environment** - Use separate keys for dev/staging/production

## Google Calendar API Setup

### Prerequisites

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable the Google Calendar API
4. Create OAuth 2.0 credentials

### Configuration

1. **Authorized JavaScript origins:**
   - `http://localhost:3000` (development)
   - `https://your-domain.com` (production)

2. **Authorized redirect URIs:**
   - `http://localhost:3000`
   - `https://your-domain.com`

3. **OAuth consent screen:**
   - Add your app information
   - Add scope: `https://www.googleapis.com/auth/calendar.events`

## Updating Secrets

### Using Dotenv Vault

1. **Login to vault:**
```bash
npx dotenv-vault login
```

2. **Pull latest:**
```bash
npx dotenv-vault pull
```

3. **Edit `.env`** with new values

4. **Push changes:**
```bash
npx dotenv-vault push
npx dotenv-vault build
```

5. **Deploy with new DOTENV_KEY**

### Manual Update

Update environment variables directly in your hosting platform's dashboard.

## Troubleshooting

### Issue: Google Calendar not connecting

**Solution:**
1. Verify API credentials are correct
2. Check OAuth consent screen is configured
3. Ensure correct origins/redirects are whitelisted
4. Check browser console for errors

### Issue: Environment variables not loading

**Solution:**
1. Verify `.env` file exists locally
2. Check `DOTENV_KEY` is set in production
3. Run `npx dotenv-vault build` after changes
4. Restart development server after `.env` changes

### Issue: CORS errors with Google API

**Solution:**
1. Add your domain to authorized JavaScript origins
2. Clear browser cache
3. Check API key restrictions in Google Console

## Support

For issues with:
- **Dotenv Vault**: [dotenv.org/docs](https://www.dotenv.org/docs)
- **Google Calendar API**: [developers.google.com/calendar](https://developers.google.com/calendar)
- **Vite Environment Variables**: [vitejs.dev/guide/env-and-mode](https://vitejs.dev/guide/env-and-mode)

## Security Reporting

If you discover a security vulnerability, please email security@your-domain.com instead of using the issue tracker.

---

Remember: **Your API keys are sensitive. Treat them like passwords!**