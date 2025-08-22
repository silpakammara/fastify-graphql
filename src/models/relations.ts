import { relations } from 'drizzle-orm';
import { postUpdates } from './post_updates';
import { user } from './user';
import { businessDetails } from './business_details';
import { professions } from './professions';
import { favourites } from './favourites';
import { comments } from './comments';
import { media } from './media';

// Post relations
export const postUpdatesRelations = relations(postUpdates, ({ one, many }) => ({
  postByUser: one(user, {
    fields: [postUpdates.postByUserId],
    references: [user.id],
  }),
  postByBusiness: one(businessDetails, {
    fields: [postUpdates.postByBusinessId],
    references: [businessDetails.id],
  }),
  comments: many(comments),
}));

// User relations
export const userRelations = relations(user, ({ one, many }) => ({
  profession: one(professions, {
    fields: [user.professionId],
    references: [professions.id],
  }),
  posts: many(postUpdates),
  comments: many(comments),
  businesses: many(businessDetails),
}));

// Business relations
export const businessDetailsRelations = relations(businessDetails, ({ one, many }) => ({
  owner: one(user, {
    fields: [businessDetails.userId],
    references: [user.id],
  }),
  posts: many(postUpdates),
}));

// Profession relations
export const professionsRelations = relations(professions, ({ many }) => ({
  users: many(user),
}));

// Comment relations
export const commentsRelations = relations(comments, ({ one }) => ({
  post: one(postUpdates, {
    fields: [comments.postUpdatesId],
    references: [postUpdates.id],
  }),
  user: one(user, {
    fields: [comments.userProfileId],
    references: [user.id],
  }),
}));

// Favourite relations
export const favouritesRelations = relations(favourites, ({ one }) => ({
  user: one(user, {
    fields: [favourites.userId],
    references: [user.id],
  }),
}));