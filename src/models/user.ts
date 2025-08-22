import { pgTable, varchar, uuid, timestamp, integer, numeric, boolean, text, jsonb } from 'drizzle-orm/pg-core';
import { specialization } from './specialization';
import { professions } from './professions';

export const user = pgTable('user', {
  id: uuid('id').primaryKey().defaultRandom(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  graduationYear: integer('graduation_year').notNull(),
  currentCity: varchar('current_city', { length: 100 }).notNull(),
  latitude: numeric('latitude', { precision: 10, scale: 8 }),
  longitude: numeric('longitude', { precision: 11, scale: 8 }),
  profilePic: varchar('profile_pic', { length: 50 }),
  organization: varchar('organization', { length: 200 }),
  bloodGroup: varchar('blood_group', { length: 3 }),
  phone: varchar('phone', { length: 50 }).notNull(),
  currentState: varchar('current_state', { length: 50 }).notNull(),
  currentCountry: varchar('current_country', { length: 20 }).notNull(),
  banner: varchar('banner', { length: 50 }),
  location: varchar('location', { length: 50 }),
  visibilityPreference: boolean('visibility_preference').notNull(),
  about: text('about'),
  socialLinks: jsonb('social_links'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  specializationId: uuid('specilizationid').references(() => specialization.id),
  professionId: uuid('professionid').references(() => professions.id),
  userAuthId: uuid('user_auth_id'),
});

export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;