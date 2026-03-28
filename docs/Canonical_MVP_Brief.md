# HINTO Canonical MVP Brief

*Created: 2026-03-27*

## Purpose

This document is the canonical MVP product brief for the HINTO restart.

It replaces the old Seattle-only, Expo-first, and AWS-first planning assumptions.

## Product Definition

HINTO is a relationship decision product for women who want clarity about their romantic options.

The MVP combines:

- a private ranked list of current romantic options or relationship states
- structured friend voting and comments
- an AI relationship coach
- privacy and moderation controls

## Target User

Primary target:

- women roughly 16 to 35
- not married
- socially active
- likely to discover or discuss the product through Instagram, Snapchat, TikTok, or close-friend group chats

The product should optimize for:

- emotional clarity
- low-friction participation
- private sharing
- quick mobile-first interaction

## Core User Loop

1. A user creates an account.
2. She sets up a profile and creates a ranked list of situationships.
3. She opens a voting session and shares it with friends.
4. Friends vote and optionally leave comments.
5. She reviews results and asks the AI coach for guidance.
6. She returns as her list changes or as new feedback arrives.

## Platforms

MVP platforms:

- native iOS app in SwiftUI
- web app in JavaScript

Both clients must consume the same shared backend contracts.

Android is not part of the initial MVP.

## Canonical Backend Direction

The MVP backend should be:

- Supabase Postgres for primary data storage
- Supabase Auth as the canonical auth/session system where provider support exists
- Supabase Storage for media and share assets
- a TypeScript API service as the application boundary for both iOS and web

The old Amplify, Cognito, AppSync, and Expo-first architecture is legacy and should not be extended.

## MVP Scope

The MVP must include:

- account creation and sign-in
- profile creation and update
- create, edit, reorder, and archive situationships
- voting session creation
- invite/share flow for voting
- vote submission with optional comments
- owner-facing results view
- AI coach chat
- block and report flows
- basic moderation and usage limits

## Auth Scope

The MVP auth approach is:

- Supabase Auth as the canonical user/session layer
- Sign in with Apple
- Meta/Facebook login for the Instagram-discovery use case
- email magic link or comparable passwordless fallback

Additional social login in scope:

- Snapchat
- TikTok

Clarifications:

- MVP does not require Instagram data import.
- MVP does not require Instagram as a standalone identity provider.
- The actual requirement is easy login for users who may know HINTO from Instagram.
- Meta/Facebook-backed login is acceptable for that requirement.

## Product Boundaries

The MVP should not depend on:

- AWS Amplify
- Cognito-specific flows
- AppSync/GraphQL as the primary contract layer
- Expo as the long-term client runtime
- direct client-to-database business logic as the default pattern

The MVP also does not need:

- Android
- a public social feed
- broad contact-import complexity if it slows delivery
- subscriptions and monetization before the core loop is credible
- heavy real-time infrastructure beyond what materially improves the vote/results experience

## Experience Priorities

The product should feel:

- private before public
- fast before clever
- supportive without being overly clinical
- socially engaging without requiring a public identity

The AI coach should reinforce:

- emotional safety
- practical guidance
- clear boundaries
- non-harmful, non-escalatory advice

## First Credible Slice

The first proof that the restart architecture works is:

1. user authenticates
2. profile is created or loaded
3. user can create, edit, and reorder situationships
4. the same API contract can be consumed by web and iOS

Once that is stable, voting and AI should be layered on top.

## Canonical Repo Shape

```text
/apps
  /ios
  /web
/services
  /api
/packages
  /domain
  /contracts
  /prompts
/docs
/legacy
```

## Decision Rule

When a future document conflicts with this brief, the restart plan, or the canonical architecture, the newer restart documents win.
