# News and Related Tables Migration Plan

## 📰 News Table
**Appwrite Collection**: `news` (679e5004002db2082685)
**Total Documents**: 30

### Structure:
- title (string, max 1000)
- content (string, max 5000) - Contains HTML/WordPress blocks
- summary (string, max 200)
- category (array of strings)
- status (string) - e.g., "published"
- featured (boolean)
- published_at (datetime)
- links (array of strings)
- feature_images (array of strings) - URLs to images
- video_url (string, max 250)
- favourites (relationship)

### Migration Requirements:
1. Migrate all 30 news items
2. Download and upload feature_images to Cloudflare Images
3. Clean/process WordPress HTML content
4. Preserve categories and links arrays

## 💙 Favourites Table
**Appwrite Collection**: `favourites` (67d9614c0021c4f4c7ed)
**Total Documents**: 4

### Structure:
- user_id (string) - References user
- news_id (string) - References news item
- business_id (string) - References business
- liked_user_id (string) - References another user
- post_id (string) - References post
- Relationships to: news, user_profile, business, post_updates

### Migration Requirements:
1. Map user_id to PostgreSQL user.id
2. Map news_id to migrated news.id
3. Map business_id to migrated business_details.id
4. Map post_id to migrated post_updates.id
5. Handle liked_user_id references

## 💬 Comments Table
**Appwrite Collection**: `comments` (67e3b96f002afb035b92)
**Total Documents**: 14

### Structure:
- content (string, max 1500)
- postUpdates (relationship) - References post
- userProfile (relationship) - References user
- commentReplies (relationship) - References replies

### Migration Requirements:
1. Map to PostgreSQL comments table
2. Link to migrated users and posts
3. Preserve content and timestamps

## 💬 Comment Replies Table
**Appwrite Collection**: `comment_replies` (67e3dde200199fa38d2d)
**Total Documents**: 0 (empty)

### Structure:
- content (string, max 1500)
- comments (relationship) - References parent comment
- userProfile (relationship) - References user
- postUpdates (relationship) - References post

## 👍 Liked Favourites Table
**Appwrite Collection**: `liked_favourites` (67e53c21003156207bbb)
**Total Documents**: 270

### Structure:
- user_id (string) - User who liked
- liked_type_id (string) - ID of liked item
- liked_type (string) - Type: "news", "profile", etc.

### Migration Requirements:
1. This appears to be a likes tracking table
2. Map user_id to PostgreSQL users
3. Map liked_type_id based on liked_type
4. Consider creating a separate likes table or merging with favourites

## 🔔 Activity Collections Table
**Appwrite Collection**: `activity_collections` (679e635a003941ad44a9)
**Total Documents**: 0 (empty)

### Structure:
- No attributes defined (appears unused)

## Migration Order:
1. **News** - Independent table, migrate first
2. **Favourites** - Depends on news, users, businesses, posts
3. **Comments** - Depends on users and posts
4. **Comment Replies** - Depends on comments and users
5. **Liked Favourites** - Can be migrated after users and content

## Database Connection Issue:
The PostgreSQL connection is timing out. Need to:
1. Check if the database server is accessible
2. Verify connection string credentials
3. Check network/firewall settings
4. Consider using a connection pool with retry logic

## Next Steps:
1. Fix database connection issue
2. Run news migration script
3. Create and run favourites migration script
4. Create and run comments migration script
5. Create and run liked_favourites migration script
6. Verify all relationships are properly maintained