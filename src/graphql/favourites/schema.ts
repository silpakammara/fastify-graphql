import { gql } from 'mercurius-codegen';

export const favouriteSchema = gql`
  type Favourite {
    id: ID!
    likedType: String!
    likedTypeId: ID!
    createdAt: String!
    updatedAt: String
    user: User
  }

  type FavouriteStats {
    total: Int!
    byType: [FavouriteTypeCount!]!
  }

  type FavouriteTypeCount {
    type: String!
    count: Int!
  }

  type FavouriteResult {
    data: [Favourite!]!
    total: Int!
    limit: Int!
    offset: Int!
  }

  type FavouriteUsersResult {
    data: [Favourite!]!
    total: Int!
    limit: Int!
    offset: Int!
  }

  type ToggleFavouriteResult {
    success: Boolean!
    liked: Boolean!
  }

  type FavouriteCheckResult {
    success: Boolean!
    liked: Boolean!
  }

  type FavouriteCountResult {
    success: Boolean!
    count: Int!
  }

  type RemoveFavouriteResult {
    success: Boolean!
    message: String
  }

  extend type Query {
    myFavourites(type: String, limit: Int, offset: Int): FavouriteResult!
    favouriteStats: FavouriteStats!
    checkFavourite(type: String!, id: ID!): FavouriteCheckResult!
    favouriteCount(type: String!, id: ID!): FavouriteCountResult!
    usersWhoLiked(contentId: ID!, type: String!, limit: Int, offset: Int): FavouriteUsersResult!
  }

  extend type Mutation {
    toggleFavourite(type: String!, id: ID!): ToggleFavouriteResult!
    removeFavourite(type: String!, id: ID!): RemoveFavouriteResult!
  }
`;
