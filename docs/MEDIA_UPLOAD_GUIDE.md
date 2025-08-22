# Media Upload Guide

This guide explains how to upload and manage media (images) in the Sarvail API.

## Overview

The API provides two main ways to handle media uploads:

1. **User Media** - Profile pictures and banners
2. **Post Media** - Images attached to posts

All media is stored in Cloudflare Images and tracked in the database using a resource-based pattern.

## User Profile Media

### Upload Profile Picture

**Endpoint:** `POST /api/users/media/profile-picture`  
**Authentication:** Required  
**Content-Type:** `multipart/form-data`

```bash
curl -X POST http://localhost:3000/api/users/media/profile-picture \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/profile-pic.jpg"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "profilePic": {
      "id": "media_id",
      "url": "https://imagedelivery.net/..."
    },
    "message": "Profile picture uploaded successfully"
  }
}
```

### Delete Profile Picture

**Endpoint:** `DELETE /api/users/media/profile-picture`  
**Authentication:** Required

```bash
curl -X DELETE http://localhost:3000/api/users/media/profile-picture \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Upload Banner

**Endpoint:** `POST /api/users/media/banner`  
**Authentication:** Required  
**Content-Type:** `multipart/form-data`

```bash
curl -X POST http://localhost:3000/api/users/media/banner \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/banner.jpg"
```

## Post Media

### Upload Images to Post

**Endpoint:** `POST /api/posts/:postId/images`  
**Authentication:** Required  
**Content-Type:** `multipart/form-data`  
**Limits:** Max 10 images, 10MB each

```bash
# Upload multiple images
curl -X POST http://localhost:3000/api/posts/POST_ID/images \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "files=@image1.jpg" \
  -F "files=@image2.jpg" \
  -F "files=@image3.jpg"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "images": [
      {
        "id": "media_id_1",
        "url": "https://imagedelivery.net/...",
        "order": 0
      },
      {
        "id": "media_id_2",
        "url": "https://imagedelivery.net/...",
        "order": 1
      }
    ],
    "message": "2 image(s) uploaded successfully"
  }
}
```

### Get Post Images

**Endpoint:** `GET /api/posts/:postId/images`  
**Authentication:** Not required (public posts)

```bash
curl http://localhost:3000/api/posts/POST_ID/images
```

### Reorder Post Images

**Endpoint:** `PUT /api/posts/:postId/images/reorder`  
**Authentication:** Required (must be post owner)

```bash
curl -X PUT http://localhost:3000/api/posts/POST_ID/images/reorder \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "imageOrders": [
      {"id": "media_id_1", "order": 0},
      {"id": "media_id_2", "order": 1}
    ]
  }'
```

### Delete Post Image

**Endpoint:** `DELETE /api/posts/:postId/images/:imageId`  
**Authentication:** Required (must be post owner)

```bash
curl -X DELETE http://localhost:3000/api/posts/POST_ID/images/IMAGE_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## General Media Endpoints

### Upload Media (Generic)

**Endpoint:** `POST /api/media/upload`  
**Authentication:** Required  
**Content-Type:** `multipart/form-data`

```bash
curl -X POST http://localhost:3000/api/media/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@image.jpg" \
  -F 'metadata={"description":"My image"}'
```

### Get User's Media Gallery

**Endpoint:** `GET /api/media/gallery`  
**Authentication:** Required  
**Query Parameters:**
- `type`: Filter by type (`profile`, `posts`, `all`)
- `limit`: Number of items (default: 20, max: 100)
- `offset`: Pagination offset

```bash
curl "http://localhost:3000/api/media/gallery?type=posts&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Implementation Notes

### File Size Limits
- Profile pictures: 5MB
- Post images: 10MB per image
- Maximum 10 images per post upload request

### Supported Formats
All image formats supported by Cloudflare Images:
- JPEG/JPG
- PNG
- GIF
- WebP
- SVG

### Automatic Cleanup
When uploading a new profile picture or banner, the old one is automatically deleted from Cloudflare to prevent orphaned media.

### Image Processing
Cloudflare Images automatically:
- Optimizes images for web delivery
- Creates responsive variants
- Provides CDN distribution
- Generates thumbnails

### Error Handling
Common errors:
- `400 Bad Request`: No file uploaded or invalid file type
- `401 Unauthorized`: Invalid or missing authentication token
- `404 Not Found`: Post or image not found
- `413 Payload Too Large`: File exceeds size limit

## Example: Complete Post Creation with Images

```javascript
// 1. Create a post
const post = await fetch('/api/posts', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    title: 'My Post',
    content: 'Check out these images!',
    type: 'image',
    visibility: 'public'
  })
});
const postData = await post.json();
const postId = postData.data.post.id;

// 2. Upload images
const formData = new FormData();
formData.append('files', imageFile1);
formData.append('files', imageFile2);

const upload = await fetch(`/api/posts/${postId}/images`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});

const uploadData = await upload.json();
console.log('Uploaded images:', uploadData.data.images);
```

## Testing

Use the provided test script:

```bash
cd scripts
npm install axios form-data
node test-media-upload.js
```

This will test all media upload endpoints including:
- Profile picture upload/delete
- Banner upload
- Post image upload/delete/reorder
- Media gallery retrieval