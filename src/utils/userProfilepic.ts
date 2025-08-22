// src/services/profilePicService.ts
import { and, eq, inArray } from 'drizzle-orm';
import { media } from '../models/media';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

export async function getProfilePics(
  db: NodePgDatabase,
  userIds: string[]
): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();

  const profilePics = await db
    .select({
      userId: media.resourceId,
      url: media.url,
      variants: media.variants,
    })
    .from(media)
    .where(
      and(
        inArray(media.resourceId, userIds),
        eq(media.resourceType, 'user_profile'),
        eq(media.tag, 'profile_pic')
      )
    );

  const profilePicMap = new Map<string, string>();
  profilePics.forEach((pic) => {
    const imageUrl = pic.url;
    profilePicMap.set(pic.userId, imageUrl);
  });

  return profilePicMap;
}
