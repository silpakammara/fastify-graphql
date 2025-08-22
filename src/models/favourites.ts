import { pgTable, varchar, uuid, timestamp } from 'drizzle-orm/pg-core';

export const favourites = pgTable('favourites', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  likedTypeId: uuid('liked_type_id').notNull(),
  likedType: varchar('liked_type', { length: 20 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export type Favourite = typeof favourites.$inferSelect;
export type NewFavourite = typeof favourites.$inferInsert;