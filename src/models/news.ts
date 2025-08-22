import { pgTable, varchar, uuid, timestamp, text, boolean } from 'drizzle-orm/pg-core';


export const validCategories = ['school', 'alumni', 'story', 'blog'] as const;
export const validStatuses = ['published', 'draft', 'archieved'] as const;

export type Category = typeof validCategories[number];
export type Status = typeof validStatuses[number];

export const news = pgTable('news', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 1000 }).notNull(),
  content: text('content').notNull(),
  summary: text('summary').notNull(),
  category: varchar('category', { length: 100 }).$type<string[]>().array(),
  status: varchar('status', { length: 100 }).notNull(),
  featured: boolean('featured'),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  links: text('links').$type<string[]>().array(),
  featureImages: text('feature_images').$type<string[]>().array(),
  videoUrl: varchar('video_url', { length: 250 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  createdBy: uuid('created_by'),
});

export type News = typeof news.$inferSelect;
export type NewNews = typeof news.$inferInsert;