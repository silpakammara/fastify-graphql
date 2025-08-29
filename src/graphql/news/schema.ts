import { gql } from 'mercurius-codegen';

export const newsSchema = gql`

  type News {
    id: ID!
    title: String!
    content: String!
    summary: String
    category: [String!]
    status: String!
    featured: Boolean!
    links: [String!]
    featureImages: [Media!]
    videoUrl: String
    publishedAt: String
    createdAt: String
    updatedAt: String
    createdBy: String!
    author: UserProfile
  }

  type NewsList {
    data: [News!]!
    total: Int!
    limit: Int!
    offset: Int!
  }

  type CategoryCount {
    category: String!
    count: Int!
  }

  input NewsFilterInput {
    query: String
    category: String
    status: String
    featured: Boolean
    createdBy: String
    limit: Int = 10
    offset: Int = 0
  }

  input CreateNewsInput {
    title: String!
    content: String!
    summary: String!
    category: [String!]
    status: String
    featured: Boolean
    links: [String!]
    featureImages: [String!]
    videoUrl: String
    publishedAt: String
  }

  input UpdateNewsInput {
    title: String
    content: String
    summary: String
    category: [String!]
    status: String
    featured: Boolean
    links: [String!]
    featureImages: [String!]
    videoUrl: String
  }

  extend type Query {
    newsList(filters: NewsFilterInput): NewsList!
    news(id: ID!): News
    featuredNews(limit: Int = 5): [News!]!
    newsCategories: [CategoryCount!]!
    relatedNews(id: ID!, limit: Int = 5): [News!]!
  }

 extend type Mutation {
    createNews(input: CreateNewsInput!): News!
    updateNews(id: ID!, input: UpdateNewsInput!): News!
    deleteNews(id: ID!): DeleteResponse!
    toggleFeatured(id: ID!, featured: Boolean!): News!
    updateNewsStatus(id: ID!, status: String!): News!
  }
`;
