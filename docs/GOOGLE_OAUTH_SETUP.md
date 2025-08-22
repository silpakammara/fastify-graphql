# Google OAuth Setup Guide

This guide explains how to set up Google OAuth for the Sarvail API.

## Prerequisites

1. Google Cloud Console account
2. A project in Google Cloud Console

## Setup Steps

### 1. Create OAuth 2.0 Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project or create a new one
3. Navigate to **APIs & Services** > **Credentials**
4. Click **Create Credentials** > **OAuth client ID**

### 2. Configure OAuth Consent Screen

If you haven't configured the OAuth consent screen:

1. Go to **APIs & Services** > **OAuth consent screen**
2. Choose **External** user type
3. Fill in the required information:
   - App name: Sarvail
   - User support email: your-email@example.com
   - Developer contact: your-email@example.com
4. Add scopes:
   - `openid`
   - `email`
   - `profile`
5. Add test users if in development

### 3. Create OAuth Client IDs

You need to create multiple client IDs for different platforms:

#### Web Application (for mobile OAuth flow)

1. Application type: **Web application**
2. Name: `Sarvail Web OAuth`
3. Authorized JavaScript origins:
   - `http://localhost:3000` (development)
   - Your production API URL
4. Authorized redirect URIs:
   - `http://localhost:3000/api/auth/google/callback` (development)
   - `https://your-api.com/api/auth/google/callback` (production)
5. Save and copy the **Client ID** and **Client Secret**

#### iOS Application

1. Application type: **iOS**
2. Name: `Sarvail iOS`
3. Bundle ID: `com.dataspeaks.sarvail`
4. Save and copy the **Client ID**

#### Android Application

1. Application type: **Android**
2. Name: `Sarvail Android`
3. Package name: `com.dataspeaks.sarvail`
4. SHA-1 certificate fingerprint: (get from your keystore)
   ```bash
   keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
   ```
5. Save and copy the **Client ID**

### 4. Update Environment Variables

Update your `.env` file with the credentials:

```env
# For the API server
GOOGLE_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-web-client-secret

# For the React Native app
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=your-ios-client-id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=your-android-client-id.apps.googleusercontent.com
```

## How It Works

### Mobile OAuth Flow

1. **User taps "Sign in with Google"** in the app
2. **App opens web browser** to `/api/auth/google/mobile?redirect=sarvail://auth`
3. **API redirects to Google** OAuth consent screen
4. **User authenticates** with Google
5. **Google redirects to API** callback with authorization code
6. **API exchanges code** for user info and creates/updates user
7. **API generates JWT tokens** (access + refresh)
8. **API redirects to app** with tokens in URL parameters
9. **App extracts tokens** and stores them securely

### Direct Token Flow (Alternative)

If you implement Google Sign-In SDK in the app:

1. **User taps "Sign in with Google"** in the app
2. **Native Google Sign-In** shows in the app
3. **App receives ID token** from Google
4. **App sends ID token** to `/api/auth/google`
5. **API validates token** and creates/updates user
6. **API returns JWT tokens** in response
7. **App stores tokens** securely

## Testing

### Test the OAuth Flow

```bash
# 1. Start your API server
npm run dev

# 2. Test the mobile OAuth flow in browser
open "http://localhost:3000/api/auth/google/mobile?redirect=http://localhost:3000/test"

# 3. Complete Google sign-in
# 4. Check the redirect URL for tokens
```

### Test with cURL

```bash
# Test with a Google ID token (from native SDK)
curl -X POST http://localhost:3000/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{
    "idToken": "YOUR_GOOGLE_ID_TOKEN"
  }'
```

## Security Considerations

1. **Never expose Client Secret** in client-side code
2. **Validate redirect URIs** to prevent open redirects
3. **Use HTTPS in production** for all OAuth flows
4. **Implement PKCE** for additional security (optional)
5. **Rotate Client Secret** periodically

## Troubleshooting

### "Invalid client" error
- Check that Client ID matches the platform
- Ensure redirect URI is exactly matching (including trailing slashes)

### "Access blocked" error
- Make sure OAuth consent screen is configured
- Add test users if app is in development mode

### Token validation fails
- Verify Client ID is correct in both API and app
- Check that the token hasn't expired
- Ensure you're using the correct audience

## Production Checklist

- [ ] Move OAuth consent screen to "In production" status
- [ ] Add production redirect URIs
- [ ] Update environment variables on production server
- [ ] Test with production URLs
- [ ] Enable API restrictions for security
- [ ] Set up monitoring for failed authentications