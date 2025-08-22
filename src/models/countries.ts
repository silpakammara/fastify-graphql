import { pgTable, varchar, uuid, timestamp, index } from 'drizzle-orm/pg-core';

export const countries = pgTable('countries', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 50 }).notNull(),
  code: varchar('code', { length: 3 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => {
  return {
    nameIdx: index('idx_countries_name').on(table.name),
    codeIdx: index('idx_countries_code').on(table.code),
  };
});

export type Country = typeof countries.$inferSelect;
export type NewCountry = typeof countries.$inferInsert;