import { pgTable, varchar, uuid, timestamp, index } from 'drizzle-orm/pg-core';

export const professions = pgTable('professions', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  userId: uuid('user_id'), // This seems to be for user-created professions
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => {
  return {
    userIdIdx: index('idx_professions_user_profile').on(table.userId),
    nameIdx: index('idx_professions_name').on(table.name),
  };
});

export type Profession = typeof professions.$inferSelect;
export type NewProfession = typeof professions.$inferInsert;