import { pgTable, text, timestamp, uuid, index, boolean } from 'drizzle-orm/pg-core';

export const authUsers = pgTable('auth_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  provider: text('provider', { enum: ['google', 'apple'] }).notNull(),
  providerId: text('provider_id').notNull(),
  avatar: text('avatar'),
  isActive: boolean('is_active').notNull().default(true),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => {
  return {
    emailIdx: index('auth_users_email_idx').on(table.email),
    providerIdx: index('auth_users_provider_idx').on(table.provider, table.providerId),
    isActiveIdx: index('auth_users_is_active_idx').on(table.isActive),
  };
});

export type AuthUser = typeof authUsers.$inferSelect;
export type NewAuthUser = typeof authUsers.$inferInsert;