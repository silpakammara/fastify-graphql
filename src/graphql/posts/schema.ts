import { gql } from "mercurius-codegen";

export const postSchema = gql`

type Business {
  id: ID
  name: String
  userId: ID
  logo: String
}

type Image {
   imgid: ID! 
   postId: ID!
   imageUrl: String!
}

 type Post{
   id: ID!
    content: String
    status: String
    featured: Boolean
    featuredImage: String
    videoUrl: String
    images: [Image!]
    backgroundTheme: String
    feeling: String
    location: String
    publishedAt: String
    postByUserId: ID
    postByBusinessId: ID
    userDetails: User
    businessDetails: Business
    likesCount: Int
    commentsCount: Int   
    createdAt:String
 }
 
 type PostList {
    success: Boolean!
    data: [Post!]!
    total: Int!
    limit: Int!
    offset: Int!
  }

  type PostResponse {
    success: Boolean!
    data: Post
  }

  type DeleteResponse {
    success: Boolean!
    message: String!
  }

  input PostsFilters {
    userId: ID
    businessId: ID
    status: String
    featured: Boolean
    location: String
    onlyMine: Boolean
    limit: Int
    offset: Int
  }

  input CreatePostInput {
    content: String!
    status: String
    featured: Boolean
    featuredImage: String
    videoUrl: String
    images: [String!]
    backgroundTheme: String
    feeling: String
    location: String
    publishedAt: String
    createdAt: String

  }

   input UpdatePostInput {
    content: String
    status: String
    featured: Boolean
    featuredImage: String
    videoUrl: String
    images: [String!]
    backgroundTheme: String
    feeling: String
    location: String
  }

   extend type Query {
    posts(filters: PostsFilters): PostList!
    post(id: ID!): PostResponse!
    postsByUser(userId: ID!, limit: Int, offset: Int): PostList!
    postsByBusiness(businessId: ID!, limit: Int, offset: Int): PostList!
  }
   extend type Mutation{
    createPost(data: CreatePostInput!): PostResponse!
    updatePost(id: ID!, data: UpdatePostInput!): PostResponse!
    deletePost(id: ID!): DeleteResponse!
    }
`;
