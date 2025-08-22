# Media Management with Cloudflare Images

## Overview

This API uses Cloudflare Images for media storage and management. All uploaded images are automatically tagged with metadata for easy organization and cleanup.

## Metadata Strategy

Every image uploaded to Cloudflare includes the following metadata:

### Automatic Metadata (Always Added)
- `app`: Always set to "sarvail" for easy filtering
- `uploadedAt`: ISO timestamp of when the image was uploaded
- `userId`: The ID of the user who uploaded the image
- `environment`: Current environment (development/production)
- `originalFilename`: Original name of the uploaded file
- `mimeType`: MIME type of the file
- `sizeBytes`: File size in bytes (for direct uploads)

### Custom Metadata
You can add any additional metadata when uploading:
```json
{
  "description": "User profile photo",
  "category": "profile",
  "tags": ["avatar", "user-content"]
}
```

## Cleanup Strategies

### 1. Find Sarvail Images
All images are tagged with `app: sarvail`, making it easy to identify which images belong to your application:

```bash
# List all Sarvail images
curl -X POST http://localhost:3000/api/admin/media/list-by-metadata \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "filters": {
      "app": "sarvail"
    }
  }'
```

### 2. Clean Up by Environment
Separate development and production images:

```bash
# List all development images
curl -X POST http://localhost:3000/api/admin/media/list-by-metadata \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "filters": {
      "app": "sarvail",
      "environment": "development"
    }
  }'
```

### 3. Clean Up Old Images
Remove images older than X days:

```bash
# Dry run - see what would be deleted
curl -X POST http://localhost:3000/api/admin/media/cleanup/old \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "olderThanDays": 30,
    "dryRun": true
  }'

# Actually delete old images
curl -X POST http://localhost:3000/api/admin/media/cleanup/old \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "olderThanDays": 30,
    "dryRun": false
  }'
```

### 4. Clean Up Orphaned Images
Find and remove images that exist in Cloudflare but not in your database:

```bash
# Dry run first
curl -X POST http://localhost:3000/api/admin/media/cleanup/orphaned \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dryRun": true
  }'
```

### 5. User-Specific Cleanup
Find all images uploaded by a specific user:

```bash
curl -X POST http://localhost:3000/api/admin/media/list-by-metadata \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "filters": {
      "app": "sarvail",
      "userId": "user-uuid-here"
    }
  }'
```

## Admin Endpoints

### GET `/api/admin/media/stats`
Get usage statistics including:
- Total images
- Images by environment
- Images by user
- Images by month

### POST `/api/admin/media/cleanup/orphaned`
Clean up images that exist in Cloudflare but not in database.

Parameters:
- `dryRun`: boolean (default: true) - If true, only shows what would be deleted

### POST `/api/admin/media/cleanup/old`
Clean up images older than specified days.

Parameters:
- `olderThanDays`: number - Age threshold in days
- `dryRun`: boolean (default: true) - If true, only shows what would be deleted

### POST `/api/admin/media/list-by-metadata`
List images filtered by metadata.

Parameters:
- `filters`: object
  - `app`: string - Application name
  - `environment`: string - Environment (development/production)
  - `userId`: string - User ID
  - `uploadedBefore`: string - ISO date
  - `uploadedAfter`: string - ISO date

## Best Practices

1. **Always Tag Images**: All uploads are automatically tagged with app name and metadata
2. **Regular Cleanup**: Schedule periodic cleanup of old development images
3. **Monitor Usage**: Use stats endpoint to track media usage by user and environment
4. **Test with Dry Run**: Always use `dryRun: true` first to see what would be deleted
5. **User Deletion**: When deleting a user, also clean up their media

## Example Upload with Custom Metadata

```bash
curl -X POST http://localhost:3000/api/media/upload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@profile.jpg" \
  -F 'metadata={
    "category": "profile",
    "purpose": "avatar",
    "version": "v2"
  }'
```

This will create an image with both automatic and custom metadata, making it easy to find and manage later.