import { gql } from 'mercurius-codegen';

export const commentSchema = gql`
type UserProfile {
  id: ID!
  firstName: String
  lastName: String
  profilePic: String
  profession: String
}

  type Comment {
    id: ID!
    content: String!
    postUpdatesId: ID!
    userProfileId: ID!
    createdAt: String
    updatedAt: String
    repliesCount: Int
    author: UserProfile!
  }

    type CommentReply {
    id: ID!
    content: String!
    commentsId: ID!  # This is the important field that was missing
    userProfileId: ID!
    createdAt: String!
    updatedAt: String
    author: UserProfile  # Changed from userProfile to author to match your service response
  }

 type CommentReplyPage {
    data: [CommentReply!]!
    total: Int
    limit: Int
    offset: Int
  }

  type CommentPage {
    data: [Comment!]!
    total: Int
    limit: Int
    offset: Int
  }
  
  extend type Query {
    commentsByPost(postId: ID!, limit: Int = 10, offset: Int = 0): CommentPage!
    repliesByComment(commentId: ID!, limit: Int = 10, offset: Int = 0): CommentReplyPage!
  }

  extend type Mutation {
    addComment(postId: ID!, content: String!): Comment!
    updateComment(commentId: ID!, content: String!): Comment!
    deleteComment(commentId: ID!): DeleteResponse!
    addReply(commentId: ID!, content: String!): Comment!
    deleteReply(replyId: ID!): DeleteResponse!
  }
`;
