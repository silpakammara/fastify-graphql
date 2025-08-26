import { gql } from "mercurius-codegen";


export const businessSchema = gql`
  type Businessess {
    id: ID!
    companyName: String!
    description: String
    category: String
    subCategory: String
    website: String
    foundedYear: Int
    name: String
    logo:Media
    role: String
    banner:Media
    address: String
    email: String
    isVerified: Boolean
    teamSize: String
    phone: String
    whatsapp: String
    location: String
    services: [String!]
    operatingHours: String
    certifications: [String!]
    socialLinks: [String!]
    tagLine: String
    geolocation: String
    userId: String!
    owner:UserProfile
    createdAt: String
    updatedAt: String
  }

  type BusinessList {
    data: [Businessess!]!
    total: Int!
    limit: Int!
    offset: Int!
  }

  input BusinessFilter {
    query: String
    category: String
    subCategory: String
    location: String
    isVerified: Boolean
    userId: String
    limit: Int = 10
    offset: Int = 0
  }

  input BusinessInput {
    companyName: String!
    description: String
    category: String
    website: String
    foundedYear: Int
    name: String!
    role: String!
    address: String
    email: String
    teamSize: String
    phone: String
    subCategory: String
    whatsapp: String
    location: String
    services: [String!]
    operatingHours: String
    certifications: [String!]
    socialLinks: [String!]
    tagLine: String
    geolocation: String
  }

  input BusinessUpdateInput {
    companyName: String
    description: String
    category: String
    website: String
    foundedYear: Int
    name: String
    role: String
    address: String
    email: String
    teamSize: String
    phone: String
    subCategory: String
    whatsapp: String
    location: String
    services: [String!]
    operatingHours: String
    certifications: [String!]
    socialLinks: [String!]
    tagLine: String
    geolocation: String
  }

  extend type Query {
    businesses(filters: BusinessFilter): BusinessList!
    business(id: ID!): Businessess!
}

  extend type Mutation {
    createBusiness(input: BusinessInput!): Businessess!
    updateBusiness(id: ID!, input: BusinessUpdateInput!): Businessess!
    deleteBusiness(id: ID!): DeleteResponse
  }
`;
