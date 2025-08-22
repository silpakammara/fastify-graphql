import { pgTable, varchar, uuid, timestamp, index } from 'drizzle-orm/pg-core';
import { states } from './states';

export const cities = pgTable('cities', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 50 }).notNull(),
  stateCode: varchar('state_code', { length: 3 }).notNull(),
  stateId: uuid('state_id').notNull().references(() => states.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => {
  return {
    stateIdIdx: index('idx_cities_state_id').on(table.stateId),
    nameIdx: index('idx_cities_name').on(table.name),
    stateCodeIdx: index('idx_cities_state_code').on(table.stateCode),
  };
});

export type City = typeof cities.$inferSelect;
export type NewCity = typeof cities.$inferInsert;