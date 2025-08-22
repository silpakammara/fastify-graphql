import { eq, like, sql, and } from 'drizzle-orm';
import { professions, type Profession, type NewProfession } from '../models/professions';
import { specialization, type Specialization, type NewSpecialization } from '../models/specialization';
import { user } from '../models/user';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

export class ProfessionalService {
  constructor(private db: NodePgDatabase<any>) {}

  // Professions
  async getAllProfessions(): Promise<{ data: Profession[], total: number }> {
    const result = await this.db
      .select()
      .from(professions)
      .orderBy(professions.name);
    
    return {
      data: result,
      total: result.length,
    }
  }

  async getProfessionById(id: string): Promise<Profession | null> {
    const [profession] = await this.db
      .select()
      .from(professions)
      .where(eq(professions.id, id))
      .limit(1);
    
    return profession || null;
  }

  async createProfession(data: NewProfession): Promise<Profession> {
    const [newProfession] = await this.db
      .insert(professions)
      .values(data)
      .returning();
    
    return newProfession!;
  }

  async searchProfessions(query: string): Promise<Profession[]> {
    const result = await this.db
      .select()
      .from(professions)
      .where(like(professions.name, `%${query}%`))
      .orderBy(professions.name);
    
    return result;
  }

  async getProfessionsWithUserCount(): Promise<Array<{
    profession: Profession;
    userCount: number;
  }>> {
    const results = await this.db
      .select({
        profession: professions,
        userCount: sql<number>`COUNT(DISTINCT ${user.id})::int`,
      })
      .from(professions)
      .leftJoin(user, eq(professions.id, user.professionId))
      .groupBy(professions.id)
      .orderBy(sql`COUNT(${user.id}) DESC`);

    return results;
  }

  // Specializations
  async getAllSpecializations(): Promise<Specialization[]> {
    const result = await this.db
      .select()
      .from(specialization)
      .orderBy(specialization.name);
    
    return result;
  }

  async getSpecializationsByProfession(professionId: string): Promise<Specialization[]> {
    const result = await this.db
      .select()
      .from(specialization)
      .where(eq(specialization.professionId, professionId))
      .orderBy(specialization.name);
    
    return result;
  }

  async getSpecializationById(id: string): Promise<Specialization | null> {
    const [spec] = await this.db
      .select()
      .from(specialization)
      .where(eq(specialization.id, id))
      .limit(1);
    
    return spec || null;
  }

  async createSpecialization(data: NewSpecialization): Promise<Specialization> {
    const [newSpec] = await this.db
      .insert(specialization)
      .values(data)
      .returning();
    
    return newSpec!;
  }

  async searchSpecializations(query: string, professionId?: string): Promise<Specialization[]> {
    const conditions = [like(specialization.name, `%${query}%`)];
    
    if (professionId) {
      conditions.push(eq(specialization.professionId, professionId));
    }

    const result = await this.db
      .select()
      .from(specialization)
      .where(and(...conditions))
      .orderBy(specialization.name);
    
    return result;
  }

  async getSpecializationsWithUserCount(professionId?: string): Promise<Array<{
    specialization: Specialization;
    profession: Profession | null;
    userCount: number;
  }>> {
    const conditions = [];
    
    if (professionId) {
      conditions.push(eq(specialization.professionId, professionId));
    }

    const results = await this.db
      .select({
        specialization: specialization,
        profession: professions,
        userCount: sql<number>`COUNT(DISTINCT ${user.id})::int`,
      })
      .from(specialization)
      .leftJoin(professions, eq(specialization.professionId, professions.id))
      .leftJoin(user, eq(specialization.id, user.specializationId))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(specialization.id, professions.id)
      .orderBy(sql`COUNT(${user.id}) DESC`);

    return results;
  }

  // User-created professions and specializations
  async getUserProfessions(userId: string): Promise<Profession[]> {
    const result = await this.db
      .select()
      .from(professions)
      .where(eq(professions.userId, userId))
      .orderBy(professions.createdAt);
    
    return result;
  }

  // Bulk operations for initial data load
  async bulkCreateProfessions(data: NewProfession[]): Promise<Profession[]> {
    const result = await this.db
      .insert(professions)
      .values(data)
      .returning();
    
    return result;
  }

  async bulkCreateSpecializations(data: NewSpecialization[]): Promise<Specialization[]> {
    const result = await this.db
      .insert(specialization)
      .values(data)
      .returning();
    
    return result;
  }
}