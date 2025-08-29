import { eq, like, sql } from 'drizzle-orm';
import { countries, type Country, type NewCountry } from '../models/countries';
import { states, type State, type NewState } from '../models/states';
import { cities, type City, type NewCity } from '../models/cities';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

export class LocationService {
  constructor(private db: NodePgDatabase<any>) {}

  // Countries
  async getAllCountries(): Promise<Country[]> {
    const result = await this.db
      .select()
      .from(countries)
      .orderBy(countries.name);
    
    return result;
  }

  async getCountryByCode(code: string): Promise<Country | null> {
    const [country] = await this.db
      .select()
      .from(countries)
      .where(sql`${countries.code} ILIKE ${code}`)
      .limit(1);
    
    return country || null;
  }

  async createCountry(data: NewCountry): Promise<Country> {
    const [newCountry] = await this.db
      .insert(countries)
      .values(data)
      .returning();
    
    return newCountry!;
  }

  // States
  async getStatesByCountry(countryCode: string): Promise<State[]> {
    // First get country
    const country = await this.getCountryByCode(countryCode);
    if (!country) {
      return [];
    }

    const result = await this.db
      .select()
      .from(states)
      .where(eq(states.countryId, country.id))
      .orderBy(states.name);
    
    return result;
  }

  async getStateByCode(stateCode: string, countryCode: string): Promise<State | null> {
    // First get country
    const country = await this.getCountryByCode(countryCode);
    if (!country) {
      return null;
    }

    const [state] = await this.db
      .select()
      .from(states)
      .where(sql`
      ${states.countryId} = ${country.id}
      AND ${states.code} ILIKE ${stateCode}
    `)
      .limit(1);
    
    return state || null;
  }

  async createState(data: NewState): Promise<State> {
    const [newState] = await this.db
      .insert(states)
      .values(data)
      .returning();
    
    return newState!;
  }

  // Cities
  async getCitiesByState(stateCode: string): Promise<City[]> {
    const result = await this.db
      .select()
      .from(cities)
      .where(sql`${cities.stateCode} ILIKE ${stateCode}`)
      .orderBy(cities.name);
    
    return result;
  }

  async getCitiesByStateId(stateId: string): Promise<City[]> {
    const result = await this.db
      .select()
      .from(cities)
      .where(eq(cities.stateId, stateId))
      .orderBy(cities.name);
    
    return result;
  }

  async createCity(data: NewCity): Promise<City> {
    const [newCity] = await this.db
      .insert(cities)
      .values(data)
      .returning();
    
    return newCity!;
  }

  async searchCities(query: string, limit: number = 10): Promise<{
    data: Array<{
      city: City;
      state: State | null;
      country: Country | null;
    }>;
  }> {
    const results = await this.db
      .select({
        city: cities,
        state: states,
        country: countries,
      })
      .from(cities)
      .leftJoin(states, eq(cities.stateId, states.id))
      .leftJoin(countries, eq(states.countryId, countries.id))
      .where(sql`${cities.name} ILIKE ${'%' + query + '%'}`)
      .limit(limit)
      .orderBy(cities.name);

    return {
      data: results.map(r => ({
        city: r.city,
        state: r.state,
        country: r.country,
      })),
    };
  }

  // Get all locations with hierarchy
  async getLocationHierarchy(): Promise<{
    countries: Array<{
      country: Country;
      statesCount: number;
      citiesCount: number;
    }>;
  }> {
    const results = await this.db
      .select({
        country: countries,
        statesCount: sql<number>`COUNT(DISTINCT ${states.id})::int`,
        citiesCount: sql<number>`COUNT(DISTINCT ${cities.id})::int`,
      })
      .from(countries)
      .leftJoin(states, eq(countries.id, states.countryId))
      .leftJoin(cities, eq(states.id, cities.stateId))
      .groupBy(countries.id)
      .orderBy(countries.name);

    return {
      countries: results,
    };
  }

  // Bulk operations for initial data load
  async bulkCreateCountries(data: NewCountry[]): Promise<Country[]> {
    const result = await this.db
      .insert(countries)
      .values(data)
      .returning();
    
    return result;
  }

  async bulkCreateStates(data: NewState[]): Promise<State[]> {
    const result = await this.db
      .insert(states)
      .values(data)
      .returning();
    
    return result;
  }

  async bulkCreateCities(data: NewCity[]): Promise<City[]> {
    const result = await this.db
      .insert(cities)
      .values(data)
      .returning();
    
    return result;
  }
}