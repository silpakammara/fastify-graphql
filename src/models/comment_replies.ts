import { pgTable, varchar, uuid, timestamp, text, index } from 'drizzle-orm/pg-core';
import { user } from './user';
import { comments } from './comments';

export const commentReplies = pgTable('comment_replies', {
  id: uuid('id').primaryKey().defaultRandom(),
  content: text('content').notNull(),
  commentsId: uuid('comments_id').references(() => comments.id),
  userProfileId: uuid('user_profile_id').references(() => user.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    commentsIdIdx: index('idx_comment_replies_comments_id').on(table.commentsId),
    userProfileIdIdx: index('idx_comment_replies_user_profile_id').on(table.userProfileId),
  };
});

export type CommentReply = typeof commentReplies.$inferSelect;
export type NewCommentReply = typeof commentReplies.$inferInsert;