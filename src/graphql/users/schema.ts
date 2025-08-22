import { gql } from 'mercurius-codegen';

export const userSchema = gql`
  type Media {
    id: ID
    url: String
  }

  type Profession {
    id: ID!
    name: String!
  }

  type Specialization {
    id: ID!
    name: String!
  }

  type AuthUser {
    id: ID!
    email: String!
    name: String
    provider: String
  }

  type User {
    id: ID!
    firstName: String
    lastName: String
    graduationYear: Int
    currentCity: String
    currentState: String
    currentCountry: String
    organization: String
    bloodGroup: String
    about: String
    profilePic: Media
    banner: Media
    profession: Profession
    specialization: Specialization
    authUser: AuthUser
    createdAt: String
    updatedAt: String
  }

  type UserList {
    data: [User!]!
    total: Int!
    limit: Int!
    offset: Int!
  }

  input UserFilter {
    query: String
    bloodGroup: String
    professionIds: [ID!]
    specializationIds: [ID!]
    yearRange: YearRange
    limit: Int
    offset: Int
  }

  input YearRange {
    min: Int!
    max: Int!
  }

  input CreateUserInput {
    firstName: String!
    lastName: String!
    email: String!
    userAuthId: String!
  }

  input UpdateUserInput {
    firstName: String
    lastName: String
    organization: String
    currentCity: String
    bloodGroup: String
  }

  type Query {
    user(id: ID!): User
    users(filters: UserFilter): UserList
  }

  type Mutation {
    createUser(data: CreateUserInput!): User!
    updateUser(id: ID!, data: UpdateUserInput!): User
    deleteUser(id: ID!): Boolean!
  }
`;
