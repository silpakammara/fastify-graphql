import { LocationService } from '../../services/locationService';

export function locationResolvers(db: any) {
  const locationService = new LocationService(db);

  return {
    Query: {
      countries: async () => {
        return locationService.getAllCountries();
      },
      states: async (_: any, { countryCode }: { countryCode: string }) => {
        return locationService.getStatesByCountry(countryCode);
      },
      cities: async (_: any, { stateCode }: { stateCode: string }) => {
        return locationService.getCitiesByState(stateCode);
      },
      searchCities: async (_: any, { query, limit }: { query: string; limit?: number }) => {
        const result = await locationService.searchCities(query, limit || 10);
        return result.data;
      },
      locationHierarchy: async () => {
        return locationService.getLocationHierarchy();
      },
    },

    Mutation: {
      createCity: async (_: any, { name, stateCode, stateId }: any) => {
        return locationService.createCity({ name, stateCode, stateId });
      },
    },
  };
}
