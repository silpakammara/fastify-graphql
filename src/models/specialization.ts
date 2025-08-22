import { pgTable, varchar, uuid, timestamp, index } from 'drizzle-orm/pg-core';
import { professions } from './professions';

export const specialization = pgTable('specialization', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  professionId: uuid('profession_id').references(() => professions.id),
}, (table) => {
  return {
    nameIdx: index('idx_specialization_name').on(table.name),
  };
});

export type Specialization = typeof specialization.$inferSelect;
export type NewSpecialization = typeof specialization.$inferInsert;