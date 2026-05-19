# Friends, Discovery, And Rank Feed Invites

*Created: 2026-05-18*

## Terminology

- **Rank Feed** is the product feed where users post relationship/ranking prompts and receive votes.
- **Friends** are explicit in-app relationships between profiles.
- Existing code may still use `friendsFeed` names for older feed routes. Do not extend that naming for new product work unless a larger rename is planned.

## Product Goals

1. Make every voting session and Rank Feed post easy to send through Messages, Snapchat, Instagram DMs, TikTok DMs, and group chats.
2. Let non-users open the shared vote on mobile web, vote with low friction, then see the App Store CTA and account path.
3. Build a first-party friend graph for feed access, friend requests, suggestions, blocking, and later notifications.
4. Use contacts only with explicit consent and selected-contact flows. Avoid importing or displaying noisy contact-book entries.

## Mobile-First Invite Flow

Use one primary universal link:

```text
https://hnnt.app/vote/:inviteCode?i=:inviteToken
```

Expected behavior:

- If HINTO is installed, the link opens the app through universal links.
- If not installed, the link opens mobile web.
- Mobile web shows the vote first, then a focused App Store/account CTA after vote submission or when the visitor tries to friend the inviter.
- The API can also return `appStoreUrl` for copy variants, but the vote URL should remain the main preview link.

For iOS sharing, prefer a scripted text blob plus the vote link. Share sheets cannot reliably force a two-card message, so the product should control the landing page and universal link behavior instead.

## Share Copy Rotation

The API returns multiple prewritten copy options per share target. Clients should rotate or let users cycle lines when inviting multiple people.

Voting examples:

- `Settle this for me: Not it or him?`
- `Honestly I can't even. Vote on this for me.`
- `Be honest. Who is Best Fit and who is Not the One?`
- `This needs group chat energy. Vote on my ranking.`
- `Quick vote. I need a second read.`

Rank Feed examples:

- `Vote on this HINTO post for me.`
- `I need a verdict on this one.`
- `Tell me straight: Best Fit or Not the One?`
- `I can't decide. Vote before this closes.`
- `Private poll. I need your honest vote.`

## Friends Page

The Friends page should contain:

- Friends list with remove, block, and report actions.
- Incoming and outgoing requests.
- Invite friends module.
- Contact fuzzy-search input above suggestions.
- Conservative suggestions list.
- Blocked users management.

The contact fuzzy-search flow should be local-first:

1. User taps `Invite friends to vote` plus icon.
2. App opens a text field that searches selected/authorized iPhone contacts locally.
3. User picks one or more contacts.
4. The app requests share-invite payloads and opens Messages/share sheet.
5. The API receives only selected contact HMACs when attribution is needed; raw phone/email values are not stored.

## Recommendation Sources

MVP order:

1. In-app username/profile search.
2. Share-link conversion from Rank Feed and voting links.
3. Selected phone contacts matched by server-side HMAC.
4. Mutual friends.
5. Provider linkage signals only when available and consented.

TikTok, Snapchat, and Meta should not be treated as reliable friend-list sources for MVP. Use them primarily for authentication/linkage and invite attribution.

## Suggestion Rules

Show 3-5 suggestions at a time. Exclude:

- blocked users
- users who blocked the viewer
- existing friends
- pending requests
- dismissed suggestions
- contacts without person-like names
- organization-only contact cards

Score:

- `+80` selected contact is an in-app discoverable user
- `+60` mutual friend signal
- `+50` joined through viewer's invite
- `+30` authenticated voter on a shared private vote
- `+20` linked provider signal with explicit discoverability

Display reasons should be human:

- `Maya is on HINTO`
- `You both know Ava`
- `Joined from your invite`

Avoid:

- `Invite GEICO from contacts`
- raw phone numbers
- unexplained algorithmic copy

## Implementation Slices

### Slice 1: Share Foundation

- Add share invite storage and discovery tables.
- Return `share` payloads from vote creation.
- Let clients display rotating invite copy.
- Use universal-link-ready vote URLs.

### Slice 2: Rank Feed Invite UI

- Add `Invite friends to vote` below Rank Feed post voting controls.
- Add local contact fuzzy-search above suggestions.
- Request share-invite payloads for selected contacts.
- Track share channel, click, vote, signup, and friend conversion.

### Slice 3: Friend Graph

- Add friends page routes and UI.
- Add requests, accept, decline, unfriend, block.
- Ensure Rank Feed visibility uses accepted friendships and block checks.

### Slice 4: Suggestions

- Add contact matching by HMAC.
- Add mutual and invite-based suggestions.
- Add dismiss/request/block actions.
- Rate-limit invite and request creation.
