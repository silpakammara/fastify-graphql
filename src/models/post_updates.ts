import { pgTable, varchar, uuid, timestamp, text, boolean } from 'drizzle-orm/pg-core';
import { businessDetails } from './business_details';
import { user } from './user';

export const postUpdates = pgTable('post_updates', {
  id: uuid('id').primaryKey().defaultRandom(),
  content: text('content').notNull(),
  status: varchar('status', { length: 50 }),
  publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
  featured: boolean('featured').default(false),
  postByBusinessId: uuid('post_by_business_id').references(() => businessDetails.id),
  postByUserId: uuid('post_by_user_id').references(() => user.id),
  featuredImage: varchar('featured_image', { length: 50 }),
  videoUrl: varchar('video_url', { length: 200 }),
  images: text('images').$type<string[]>().array(),
  backgroundTheme: varchar('background_theme', { length: 100 }),
  feeling: varchar('feeling', { length: 20 }),
  location: varchar('location', { length: 100 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export type PostUpdate = typeof postUpdates.$inferSelect;
export type NewPostUpdate = typeof postUpdates.$inferInsert;