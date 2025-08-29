import { gql } from 'mercurius-codegen';

export const searchSchema = gql`
  type UserSearch {
    id: ID!
    firstName: String!
    lastName: String!
    profilePic: String
    currentCity: String!
    organization: String
    profession: String
    specialization: String
    graduationYear: Int
    bloodGroup: String
  }

  type BusinessSearch {
    id: ID!
    companyName: String!
    category: String
    location: String
    logo: String
  }

  type PostSearch {
    id: ID!
    content: String!
    featuredImage: String
    postByUser: UserSearch
    publishedAt: String
  }

  type NewsSearch {
    id: ID!
    title: String!
    summary: String
    publishedAt: String
    featured: Boolean
    category: String
  }

  type GlobalSearchResults {
    users: [UserSearch!]
    businesses: [BusinessSearch!]
    posts: [PostSearch!]
    news: [NewsSearch!]
  }

  type GlobalSearchTotals {
    users: Int!
    businesses: Int!
    posts: Int!
    news: Int!
  }

  type GlobalSearchResponse {
    success: Boolean!
    results: GlobalSearchResults
    totals: GlobalSearchTotals!
  }

  extend type Query {
    globalSearch(query: String!, types: [String!], limit: Int): GlobalSearchResponse
    searchUsers(query: String!, limit: Int): [UserSearch!]
    searchBusinesses(query: String!, limit: Int): [BusinessSearch!]
    searchPosts(query: String!, limit: Int): [PostSearch!]
    searchNews(query: String!, limit: Int): [NewsSearch!]
  }
`;
