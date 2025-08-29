// src/graphql/professions/schema.ts
import { gql } from 'mercurius-codegen';

export const professionSchema = gql`
  type Professions {
    id: ID!
    name: String!
    userId: ID
    createdAt: String
    updatedAt: String
   
  }

  type ProfessionWithStats {
    profession: Professions!
    userCount: Int!
  }

  type Specializations {
    id: ID!
    name: String!
    professionId: ID
    createdAt: String
    updatedAt: String
   
  }

  type SpecializationWithStats {
    specialization: Specializations!
    profession: Professions
    userCount: Int!
  }

  extend type Query {
    professions: [Professions!]!
    professionsWithStats: [ProfessionWithStats!]!
    searchProfessions(query: String!): [Professions!]!

    specializations: [Specializations!]!
    specializationsByProfession(professionId: ID!): [Specializations!]!
    specializationsWithStats(professionId: ID): [SpecializationWithStats!]!
    searchSpecializations(query: String!, professionId: ID): [Specializations!]!
  }

  extend type Mutation {
    createProfession(name: String!): Professions!
    createSpecialization(name: String!, professionId: ID!): Specializations!
  }
`;
