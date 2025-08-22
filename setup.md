# Setup Instructions

## 1. Database Setup

First, create a PostgreSQL database:

```sql
CREATE DATABASE sarvail_auth;
```

## 2. Environment Variables

Update the `.env` file with your actual values:

```env
# Database Configuration (REQUIRED)
DATABASE_URL=postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/sarvail_auth

# JWT Configuration (REQUIRED)
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters-long

# Google OAuth (REQUIRED - Get from Google Cloud Console)
GOOGLE_CLIENT_ID=your-actual-google-client-id.apps.googleusercontent.com

# Apple OAuth (REQUIRED - Get from Apple Developer)
APPLE_CLIENT_ID=com.yourcompany.yourapp
```

### Getting Google Client ID:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add your Expo app's redirect URI

### Getting Apple Client ID:
1. Go to [Apple Developer](https://developer.apple.com/)
2. Create an App ID
3. Enable Sign in with Apple
4. Use your app's bundle ID as the client ID

## 3. Database Migration

Run the database migration to create tables:

```bash
npm run db:push
```

## 4. Start the Server

```bash
npm run dev
```

The server will start on http://localhost:3000

## 5. Test the API

Check if the server is running:
```bash
curl http://localhost:3000/health
```

View API documentation:
- Open http://localhost:3000/docs in your browser

## Troubleshooting

If you get a database connection error:
- Make sure PostgreSQL is running
- Check your DATABASE_URL is correct
- Ensure the database exists

If you get JWT errors:
- Make sure JWT_SECRET is at least 32 characters
- Use a strong, random secret for production