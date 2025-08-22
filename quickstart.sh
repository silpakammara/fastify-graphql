#!/bin/bash

echo "🚀 Sarvail API Quick Start"
echo "========================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo "✅ .env file created"
    echo ""
fi

# Check required environment variables
source .env

echo "Checking environment variables..."
echo ""

if [[ "$DATABASE_URL" == "postgresql://postgres:postgres@localhost:5432/sarvail_auth" ]]; then
    echo "⚠️  DATABASE_URL is using default value"
    echo "   Please update it with your PostgreSQL credentials"
    echo ""
fi

if [[ "$JWT_SECRET" == "CHANGE_THIS_TO_A_SECURE_RANDOM_STRING_AT_LEAST_32_CHARS" ]]; then
    echo "⚠️  JWT_SECRET needs to be updated!"
    echo "   Generate one with: openssl rand -base64 32"
    echo ""
fi

if [[ "$GOOGLE_CLIENT_ID" == "YOUR_ACTUAL_GOOGLE_CLIENT_ID.apps.googleusercontent.com" ]]; then
    echo "⚠️  GOOGLE_CLIENT_ID needs to be updated!"
    echo "   Get it from: https://console.cloud.google.com/apis/credentials"
    echo ""
fi

if [[ "$APPLE_CLIENT_ID" == "com.yourcompany.yourapp" ]]; then
    echo "⚠️  APPLE_CLIENT_ID needs to be updated!"
    echo "   Use your app's bundle identifier"
    echo ""
fi

echo "📋 Next Steps:"
echo "1. Update the environment variables in .env file"
echo "2. Create PostgreSQL database: createdb sarvail_auth"
echo "3. Run migrations: npm run db:push"
echo "4. Start server: npm run dev"
echo ""
echo "📖 Full setup instructions: setup.md"