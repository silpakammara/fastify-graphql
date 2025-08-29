import { SearchServiceEnhanced } from '../../services/searchServiceEnhanced';

export function searchResolvers(db: any) {
  const searchService = new SearchServiceEnhanced(db);

  return {
    Query: {
      globalSearch: async (_: any, { query, types, limit }: any, ctx: any) => {
        const searchResults = await searchService.globalSearch(query, { types, limit });
        return {
          success: true,
           results: {
            users: searchResults.results.users || [],
            businesses: searchResults.results.businesses || [],
            posts: searchResults.results.posts || [],
            news: searchResults.results.news || [],
          },
          totals: {
            users: searchResults.totals.users,
            businesses: searchResults.totals.businesses,
            posts: searchResults.totals.posts,
            news: searchResults.totals.news,
          },
        };
      },

      searchUsers: async (_: any, { query, limit }: any, ctx: any) => {
        const result = await searchService.searchUsers(query, limit);
        return result.users;
      },

      searchBusinesses: async (_: any, { query, limit }: any, ctx: any) => {
        const result = await searchService.searchBusinesses(query, limit);
        return result.businesses;
      },

      searchPosts: async (_: any, { query, limit }: any, ctx: any) => {
        const result = await searchService.searchPosts(query, limit);
        return result.posts;
      },

      searchNews: async (_: any, { query, limit }: any, ctx: any) => {
        const result = await searchService.searchNews(query, limit);
        return result.articles;
      },
    },
  };
}
