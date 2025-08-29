import { gql } from 'mercurius-codegen'; 

export const locationSchema = gql`
  type Country {
    id: ID!
    name: String!
    code: String!
    createdAt: String
    updatedAt: String
  }

  type State {
    id: ID!
    name: String!
    code: String!
    countryId: ID!
    createdAt: String
    updatedAt: String
  }

  type City {
    id: ID!
    name: String!
    createdAt: String
    updatedAt: String
  }

  type SearchCityResult {
    city: City!
    state: State
    country: Country
  }

  type CountryHierarchy {
    country: Country!
    statesCount: Int!
    citiesCount: Int!
  }

  type LocationHierarchy {
    countries: [CountryHierarchy!]!
  }


 extend type Query {
    countries: [Country!]!
    states(countryCode: String!): [State!]!
    cities(stateCode: String!): [City!]!
    searchCities(query: String!, limit: Int): [SearchCityResult!]!
    locationHierarchy: LocationHierarchy!
  }


extend type Mutation {
    createCity(name: String!, stateCode: String!, stateId: ID!): City!
  }
`;
