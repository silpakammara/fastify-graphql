# Test JWT Tokens (Non-Expiring)

These tokens are for testing purposes only and do not expire. DO NOT use in production!

## User 1
- **User ID**: `c88e459e-b7cb-4388-affd-c9fcc8db042f`
- **Token**: 
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjODhlNDU5ZS1iN2NiLTQzODgtYWZmZC1jOWZjYzhkYjA0MmYiLCJpYXQiOjE3NTM3Mjk4MTB9.ULB_C9KDvRxiy4dXGdub3JwWWLRmk0rPZ6B3BzshMqo
```

## User 2
- **User ID**: `7ea40cd8-fe4d-4a44-af0c-764bf929f7d9`
- **Token**: 
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI3ZWE0MGNkOC1mZTRkLTRhNDQtYWYwYy03NjRiZjkyOWY3ZDkiLCJpYXQiOjE3NTM3Mjk4MTB9.bjdnVATerRazz_oIqUESjaqlU7TmKeG2IN9Zl4EE61o
```

## User 3
- **User ID**: `5b2fb646-de35-418e-8e40-0dbb642cd806`
- **Token**: 
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI1YjJmYjY0Ni1kZTM1LTQxOGUtOGU0MC0wZGJiNjQyY2Q4MDYiLCJpYXQiOjE3NTM3Mjk4MTB9.Wsa-3vfy5dPitH4DTYNuaDcry2ZCbYRZRottRQKCPaA
```

## Usage Examples

### Postman
1. Go to Authorization tab
2. Select "Bearer Token" from the Type dropdown
3. Paste the token (without quotes)

### cURL
```bash
curl -H "Authorization: Bearer <TOKEN>" http://localhost:3000/api/users/profile
```

### JavaScript/Axios
```javascript
const response = await axios.get('http://localhost:3000/api/users/profile', {
  headers: {
    'Authorization': 'Bearer <TOKEN>'
  }
});
```

## Available Endpoints

### User Endpoints
- `GET /api/users/profile` - Get current user profile
- `PUT /api/users/profile` - Update user profile
- `GET /api/users` - List all users
- `GET /api/users/:userId` - Get specific user

### Post Endpoints
- `GET /api/posts` - List posts
- `POST /api/posts` - Create post
- `GET /api/posts/:postId` - Get specific post
- `PUT /api/posts/:postId` - Update post
- `DELETE /api/posts/:postId` - Delete post

### Business Endpoints
- `GET /api/businesses` - List businesses
- `POST /api/businesses` - Create business
- `GET /api/businesses/:businessId` - Get specific business
- `PUT /api/businesses/:businessId` - Update business
- `DELETE /api/businesses/:businessId` - Delete business

### News Endpoints (Public - No Auth Required)
- `GET /api/news` - List news
- `GET /api/news/featured` - Get featured news
- `GET /api/news/:newsId` - Get specific news
- `GET /api/news/categories` - Get news categories