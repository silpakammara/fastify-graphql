# Fastify Auth API Documentation

## Overview

This API provides secure authentication for Expo React Native applications using Google and Apple login. All authenticated endpoints require a JWT token in the Authorization header.

## Base URL

- Development: `http://localhost:3000/api`
- Production: `https://api.yourdomain.com/api`

## Authentication

Most endpoints require authentication using a JWT token. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Response Format

All responses follow a consistent format:

```json
{
  "success": true,
  "data": { ... }
}
```

Error responses:

```json
{
  "success": false,
  "error": "Error message"
}
```

## Endpoints

### Authentication

#### POST `/api/auth/google`

Authenticate with Google ID token.

**Request Body:**
```json
{
  "idToken": "google-id-token-from-expo"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "jwt-access-token",
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "avatar": "https://profile-pic-url.com"
    }
  }
}
```

**Error Codes:**
- `400`: Invalid or expired ID token
- `500`: Server error

#### POST `/api/auth/apple`

Authenticate with Apple ID token.

**Request Body:**
```json
{
  "idToken": "apple-id-token-from-expo",
  "authorizationCode": "optional-authorization-code"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "jwt-access-token",
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "avatar": null
    }
  }
}
```

**Error Codes:**
- `400`: Invalid or expired ID token
- `500`: Server error

#### GET `/api/me`

Get current user profile.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "avatar": "https://profile-pic-url.com",
      "provider": "google",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

**Error Codes:**
- `401`: Unauthorized (invalid or missing token)

#### POST `/api/logout`

Logout current user. This endpoint exists for client-side token cleanup. The JWT will remain valid until it expires.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  }
}
```

### Health Check

#### GET `/`

API root endpoint.

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Fastify Auth API",
    "version": "1.0.0",
    "docs": "/docs"
  }
}
```

#### GET `/health`

Health check endpoint.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

## Rate Limiting

All endpoints are rate limited to 100 requests per minute per IP address.

## CORS

CORS is configured based on the `CORS_ORIGIN` environment variable. In development, it defaults to `*` (allow all origins).

## JWT Token Details

- Tokens expire after 7 days by default (configurable via `JWT_EXPIRES_IN`)
- Tokens contain user ID and email in the payload
- Tokens are signed using HS256 algorithm

## Error Handling

All errors return appropriate HTTP status codes:

- `200`: Success
- `400`: Bad Request (validation errors, invalid tokens)
- `401`: Unauthorized (missing or invalid JWT)
- `429`: Too Many Requests (rate limit exceeded)
- `500`: Internal Server Error

## Media Management

### POST `/api/media/upload`

Upload an image file to Cloudflare Images.

**Headers:**
```
Authorization: Bearer <jwt-token>
Content-Type: multipart/form-data
```

**Request Body:**
- `file`: Image file (max 10MB)
- `metadata`: Optional JSON metadata

**Response:**
```json
{
  "success": true,
  "data": {
    "media": {
      "id": "uuid",
      "url": "https://imagedelivery.net/...",
      "thumbnailUrl": "https://imagedelivery.net/.../thumbnail",
      "filename": "image.jpg",
      "mimeType": "image/jpeg",
      "size": 123456,
      "uploadedAt": "2024-01-01T00:00:00.000Z",
      "variants": {
        "public": "https://...",
        "thumbnail": "https://..."
      }
    }
  }
}
```

### POST `/api/media/upload-url`

Upload an image from a URL.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "url": "https://example.com/image.jpg",
  "metadata": {
    "description": "optional metadata"
  }
}
```

### GET `/api/media/:id`

Get media details by ID.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "media": {
      "id": "uuid",
      "url": "https://imagedelivery.net/...",
      "thumbnailUrl": "https://...",
      "filename": "image.jpg",
      "mimeType": "image/jpeg",
      "size": 123456,
      "uploadedAt": "2024-01-01T00:00:00.000Z",
      "variants": {},
      "metadata": {}
    }
  }
}
```

### GET `/api/media`

List user's media with pagination.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "totalPages": 5,
      "total": 100,
      "limit": 20
    }
  }
}
```

### DELETE `/api/media/:id`

Delete a media file.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Media deleted successfully"
  }
}
```

### PUT `/api/media/:id/metadata`

Update media metadata.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "metadata": {
    "description": "Updated description",
    "tags": ["tag1", "tag2"]
  }
}
```

## Swagger Documentation

Interactive API documentation is available at `/docs` when running the server.