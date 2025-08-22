import { pgTable, varchar, uuid, timestamp, text, index } from 'drizzle-orm/pg-core';
import { user } from './user';
import { postUpdates } from './post_updates';

export const comments = pgTable('comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  content: text('content').notNull(),
  postUpdatesId: uuid('post_updates_id').references(() => postUpdates.id),
  userProfileId: uuid('user_profile_id').references(() => user.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    postUpdatesIdIdx: index('idx_comments_post_updates_id').on(table.postUpdatesId),
    userProfileIdIdx: index('idx_comments_user_profile_id').on(table.userProfileId),
  };
});

export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;