import { defineApi } from '@aws-amplify/backend-api';

export const api = defineApi({
  schema: `
    # User profile and authentication
    type User @model @auth(rules: [{ allow: owner }]) {
      id: ID! @primaryKey
      username: String! @index
      avatar: String
      age: Int!
      isPro: Boolean! @default(value: false)
      inviteCode: String! @unique
      blockedUsers: [String]
      situationships: [Situationship] @hasMany
      votes: [Vote] @hasMany
      createdAt: AWSDateTime!
      updatedAt: AWSDateTime!
    }

    # Situationship (crush) entry
    type Situationship @model @auth(rules: [{ allow: owner }, { allow: private, operations: [read] }]) {
      id: ID! @primaryKey
      title: String!
      description: String
      rank: Int!
      user: User! @belongsTo
      votes: [Vote] @hasMany
      chatMessages: [ChatMessage] @hasMany
      createdAt: AWSDateTime!
      updatedAt: AWSDateTime!
    }

    # Voting system
    type Vote @model @auth(rules: [{ allow: private }]) {
      id: ID! @primaryKey
      type: VoteType!
      comment: String
      user: User! @belongsTo
      situationship: Situationship! @belongsTo
      createdAt: AWSDateTime!
    }

    enum VoteType {
      BEST
      WORST
    }

    # AI Chat system
    type ChatMessage @model @auth(rules: [{ allow: owner }]) {
      id: ID! @primaryKey
      content: String!
      role: ChatRole!
      situationship: Situationship! @belongsTo
      createdAt: AWSDateTime!
    }

    enum ChatRole {
      USER
      AI
    }

    # Subscriptions for real-time updates
    type Subscription {
      onVoteCreated(situationshipId: ID!): Vote @aws_subscribe(mutations: ["createVote"])
      onSituationshipUpdated(id: ID!): Situationship @aws_subscribe(mutations: ["updateSituationship"])
      onChatMessageCreated(situationshipId: ID!): ChatMessage @aws_subscribe(mutations: ["createChatMessage"])
    }
  `,
  /* Rate limiting for AI chat (10 messages per day per user) */
  rateLimiting: { maxRequests: 10, period: 86400 /* 24 hours in seconds */ },
  /* Custom resolvers for moderation and AI integration */
  resolvers: { /* We'll add custom resolvers for moderation, GPT-4 chat, vote aggregation, and pro feature gating */ },
}); 