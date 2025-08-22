import { pgTable, text, timestamp, uuid, index, integer, jsonb, pgEnum } from 'drizzle-orm/pg-core';

// Define enums
export const mediaResourceTypeEnum = pgEnum('media_resource_type', [
  'user_profile',
  'news',
  'business',
  'post',
  'comment'
]);

export const mediaTagEnum = pgEnum('media_tag', [
  'profile_pic',
  'banner',
  'logo',
  'featured_image',
  'gallery',
  'attachment'
]);

export const media = pgTable('media', {
  id: uuid('id').primaryKey().defaultRandom(),
  cloudflareId: text('cloudflare_id').notNull().unique(),
  filename: text('filename').notNull(),
  originalFilename: text('original_filename'),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(), // in bytes
  width: integer('width'),
  height: integer('height'),
  uploadedAt: timestamp('uploaded_at').notNull().defaultNow(),
  variants: jsonb('variants').$type<Record<string, string>>(), // variant name -> URL
  metadata: jsonb('metadata').$type<Record<string, any>>(),
  url: text('url').notNull(),
  thumbnailUrl: text('thumbnail_url'),
  
  // New resource-based columns
  resourceType: mediaResourceTypeEnum('resource_type').notNull(),
  resourceId: uuid('resource_id').notNull(),
  tag: mediaTagEnum('tag').notNull(),
  position: integer('position').default(0).notNull(),
  
  // Legacy columns (to be removed after migration)
  authUserId: uuid('auth_user_id'),
}, (table) => {
  return {
    cloudflareIdIdx: index('media_cloudflare_id_idx').on(table.cloudflareId),
    uploadedAtIdx: index('media_uploaded_at_idx').on(table.uploadedAt),
    resourceIdx: index('idx_media_resource').on(table.resourceType, table.resourceId),
    resourceTagIdx: index('idx_media_resource_tag').on(table.resourceType, table.resourceId, table.tag),
  };
});

export type Media = typeof media.$inferSelect;
export type NewMedia = typeof media.$inferInsert;

// Type definitions for better type safety
export type MediaResourceType = 'user_profile' | 'news' | 'business' | 'post' | 'comment';
export type MediaTag = 'profile_pic' | 'banner' | 'logo' | 'featured_image' | 'gallery' | 'attachment';