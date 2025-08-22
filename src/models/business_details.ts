import { pgTable, varchar, uuid, timestamp, boolean, text, jsonb, index, integer } from 'drizzle-orm/pg-core';
import { user } from './user';

export const businessDetails = pgTable('business_details', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyName: varchar('company_name', { length: 1200 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 100 }),
  logo: varchar('logo', { length: 50 }),
  website: varchar('website', { length: 200 }),
  foundedYear: integer('founded_year'),
  name: varchar('name', { length: 50 }).notNull(),
  role: varchar('role', { length: 50 }).notNull(),
  address: text('address'),
  email: varchar('email', { length: 100 }),
  isVerified: boolean('is_verified').notNull(),
  teamSize: varchar('team_size', { length: 50 }),
  phone: varchar('phone', { length: 15 }),
  subCategory: varchar('sub_category', { length: 20 }),
  whatsapp: varchar('whatsapp', { length: 20 }),
  location: varchar('location', { length: 50 }),
  services: text('services').$type<string[]>().array(),
  operatingHours: varchar('operating_hours', { length: 50 }),
  certifications: text('certifications').$type<string[]>().array(),
  socialLinks: jsonb('social_links'),
  banner: varchar('banner', { length: 50 }),
  tagLine: varchar('tag_line', { length: 50 }),
  userId: uuid('user_id').references(() => user.id),
  geolocation: varchar('geolocation', { length: 200 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    companyNameIdx: index('idx_business_details_company_name').on(table.companyName),
    categoryIdx: index('idx_business_details_category').on(table.category),
    userIdIdx: index('idx_business_details_user_id').on(table.userId),
    isVerifiedIdx: index('idx_business_details_is_verified').on(table.isVerified),
    emailIdx: index('idx_business_details_email').on(table.email),
    locationIdx: index('idx_business_details_location').on(table.location),
  };
});

export type BusinessDetail = typeof businessDetails.$inferSelect;
export type NewBusinessDetail = typeof businessDetails.$inferInsert;