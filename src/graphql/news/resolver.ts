import { truncate } from 'fs';
import { NewsServiceSimple } from '../../services/newsServiceSimple';

export function newsResolvers(db: any) {
  const newsService = new NewsServiceSimple(db);

  return {
    Query: {
      newsList: async (_: any, { filters }: any, ctx:any) => {
        return newsService.list(filters || {});
      },
      news: async (_: any, { id }: any,ctx:any) => {
        return newsService.findById(id);
      },
      featuredNews: async (_: any, { limit }: any, ctx:any) => {
        return newsService.getFeaturedNews(limit);
      },
      newsCategories: async (_:any,{}:any,ctx:any ) => {
        return newsService.getCategories();
      },
      relatedNews: async (_: any, { id, limit }: any,ctx:any) => {
        return newsService.getRelatedNews(id, limit);
      },
    },
    Mutation: {
      createNews: async (_: any, { input }: any, ctx: any) => {
        const authUserId = ctx.user?.userId; 
        console.log("news createdby", authUserId)
        return newsService.create({
          ...input,
          createdBy: authUserId,
        });
      },
      updateNews: async (_: any, { id, input }: any, ctx: any) => {
        const article = await newsService.findById(id);
        if (!article) throw new Error('News article not found');
        if (article.createdBy !== ctx.user?.userId) throw new Error('Unauthorized to update the news');

        return newsService.update(id, input);
      },
      deleteNews: async (_: any, { id }: any, ctx: any) => {
        const article = await newsService.findById(id);
        if (!article) throw new Error('News article not found');
        if (article.createdBy !== ctx.user?.userId) throw new Error('Unauthorized to delete this article');
        await newsService.delete(id);
        return { success: true, message: "news deleted successfully" };
      },
      updateNewsStatus: async (_: any, { id, status }: any, ctx: any) => {
        const article = await newsService.findById(id);
        if (!article) throw new Error('News article not found');
        if (article.createdBy !== ctx.user?.userId) throw new Error('Unauthorized to update the status');
        return newsService.updateStatus(id, status);
      },
    },
  };
}
