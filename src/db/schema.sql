-- Create the database (run this as superuser)
-- CREATE DATABASE sarvail_auth;

-- Connect to the database
-- \c sarvail_auth;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    provider TEXT NOT NULL CHECK (provider IN ('google', 'apple')),
    provider_id TEXT NOT NULL,
    avatar TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS email_idx ON users(email);
CREATE INDEX IF NOT EXISTS provider_idx ON users(provider, provider_id);

-- Create unique constraint for provider + provider_id
CREATE UNIQUE INDEX IF NOT EXISTS provider_unique_idx ON users(provider, provider_id);

-- Create media table
CREATE TABLE IF NOT EXISTS media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cloudflare_id TEXT NOT NULL UNIQUE,
    filename TEXT NOT NULL,
    original_filename TEXT,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    width INTEGER,
    height INTEGER,
    uploaded_at TIMESTAMP NOT NULL DEFAULT NOW(),
    variants JSONB,
    metadata JSONB,
    url TEXT NOT NULL,
    thumbnail_url TEXT
);

-- Create indexes for media
CREATE INDEX IF NOT EXISTS media_user_id_idx ON media(user_id);
CREATE INDEX IF NOT EXISTS media_cloudflare_id_idx ON media(cloudflare_id);
CREATE INDEX IF NOT EXISTS media_uploaded_at_idx ON media(uploaded_at);