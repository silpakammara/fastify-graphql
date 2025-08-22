# Media Upload Implementation Summary

## What Was Implemented

### 1. User Profile Media Routes (`/api/users/media/*`)

Created `/src/routes/users-media.ts` with the following endpoints:

- **POST `/profile-picture`** - Upload user profile picture
  - Accepts multipart/form-data with single image file
  - Max file size: 5MB
  - Automatically deletes old profile picture
  - Updates user profile with new media ID

- **DELETE `/profile-picture`** - Delete user profile picture
  - Removes image from Cloudflare
  - Sets profilePic to null in user profile

- **POST `/banner`** - Upload user banner image
  - Similar to profile picture upload
  - Max file size: 5MB
  - Automatically deletes old banner

### 2. Post Media Routes (`/api/posts/*`)

Created `/src/routes/posts-media.ts` with the following endpoints:

- **POST `/:postId/images`** - Upload images to a post
  - Accepts multipart/form-data with up to 10 image files
  - Max file size: 10MB per image
  - Maintains image order
  - Updates post's mediaIds array

- **GET `/:postId/images`** - Get all images for a post
  - Returns images sorted by order
  - Public endpoint (no auth required)

- **PUT `/:postId/images/reorder`** - Reorder post images
  - Accepts array of image IDs with new order values
  - Only post owner can reorder

- **DELETE `/:postId/images/:imageId`** - Delete specific image from post
  - Only post owner can delete
  - Updates post's mediaIds array

### 3. Integration with Existing Systems

- Uses `MediaServiceNew` for resource-based media management
- Integrates with existing authentication middleware
- Follows the resource pattern: `resourceType`, `resourceId`, `tag`
- Automatic cleanup of old media when replacing

### 4. Route Registration

Updated `/src/app.ts` to register new routes:
- `/api/users/media/*` - User media endpoints
- `/api/posts/:postId/images/*` - Post media endpoints

## How It Works

### User Profile Picture Upload Flow

1. User sends POST request with image file
2. Server validates file type (must be image)
3. If user has existing profile pic, it's deleted from Cloudflare
4. New image uploaded to Cloudflare via MediaServiceNew
5. User profile updated with new media ID
6. Response includes media ID and URL

### Post Image Upload Flow

1. User creates a post first
2. User sends POST request with multiple image files
3. Server validates post ownership
4. Images uploaded to Cloudflare with order metadata
5. Post's mediaIds array updated
6. Response includes uploaded images with URLs

## Testing

Two test scripts provided:

1. **test-media-upload.js** - Full automated test suite
   - Requires Google/Apple authentication
   - Tests all media endpoints

2. **test-media-manual.js** - Manual testing script
   - Requires manual JWT token
   - Good for debugging specific endpoints

## Security

- All upload endpoints require authentication
- Post image operations verify ownership
- File type validation (images only)
- Size limits enforced
- Automatic cleanup prevents orphaned media

## Next Steps for Mobile/Web Integration

1. **Profile Picture Upload**:
   ```javascript
   const formData = new FormData();
   formData.append('file', imageFile);
   
   fetch('/api/users/media/profile-picture', {
     method: 'POST',
     headers: { 'Authorization': `Bearer ${token}` },
     body: formData
   });
   ```

2. **Post Creation with Images**:
   ```javascript
   // Step 1: Create post
   const post = await createPost(data);
   
   // Step 2: Upload images
   const formData = new FormData();
   images.forEach(img => formData.append('files', img));
   
   await fetch(`/api/posts/${post.id}/images`, {
     method: 'POST',
     headers: { 'Authorization': `Bearer ${token}` },
     body: formData
   });
   ```

## Important Notes

- Images are automatically optimized by Cloudflare
- URLs are CDN-backed for fast delivery
- No local storage - all images in Cloudflare
- Supports all common image formats
- Automatic variants for responsive images