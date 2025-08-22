import { pgTable, varchar, uuid, timestamp, index } from 'drizzle-orm/pg-core';
import { countries } from './countries';

export const states = pgTable('states', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 50 }).notNull(),
  code: varchar('code', { length: 3 }).notNull(),
  countryId: uuid('country_id').notNull().references(() => countries.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => {
  return {
    countryIdIdx: index('idx_states_country_id').on(table.countryId),
    codeIdx: index('idx_states_code').on(table.code),
    nameIdx: index('idx_states_name').on(table.name),
  };
});

export type State = typeof states.$inferSelect;
export type NewState = typeof states.$inferInsert;