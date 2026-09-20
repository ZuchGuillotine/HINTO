---
name: HNNT Design System
version: 0.1
status: draft
primary_platforms:
  - iOS SwiftUI
  - Web JavaScript
audience: women 16-28
brand: hnnt.
---

# DESIGN.md

This file is the design reference for AI agents and humans building HNNT/HINTO user-facing UI.
Read it before creating or modifying screens, components, copy, icons, or marketing/content pages.

## Product Position

HNNT is a relationship decision product for young women who want private clarity about romantic options, situationships, friend feedback, and coaching.

Primary audience:

- women 16-28
- socially active, mobile-first, and likely to share through TikTok, Snapchat, Instagram, iMessage, and close-friend group chats
- wants the product to feel private, fun, emotionally sharp, and safe
- does not want enterprise, clinical, dashboard, team, or developer language

Core brand line:

```text
Rank what you can't say out loud.
```

The brand should feel like a private group chat became a polished app: bold, glossy, intimate, playful, and slightly dramatic, while still being trustworthy around privacy and safety.

## Visual Theme

The current public brand direction is the live `hnnt.app` landing page and the black-background pink `hnnt.` reference image.

Use:

- black and near-black backgrounds
- glossy hot pink brand moments
- deep red accents for intensity and emotional stakes
- white text for contrast
- restrained cards and panels
- sharp enough structure for product usability

Avoid:

- beige, cream, tan, or lifestyle-blog palettes
- generic purple SaaS gradients
- corporate blue dashboards
- clinical wellness styling
- pastel dating-app softness as the dominant look
- visible engineering copy such as "API surface", "canonical slice", "restart", "contract", "owner view", or "roadmap"

## Color Tokens

Use these tokens as the canonical palette unless a platform-specific system requires adaptation.

```yaml
colors:
  background:
    black: "#020104"
    blackRaised: "#09060D"
    panel: "#0D0A12"
    panelRaised: "#17111F"
  text:
    primary: "#FFF8FB"
    secondary: "#B8ACB9"
    muted: "#817785"
    inverse: "#0A070D"
  brand:
    hotPink: "#FF4F9D"
    glossPink: "#FF7ABD"
    deepPink: "#D62276"
    highlightPink: "#FFD4E8"
  accent:
    deepRed: "#6D071A"
    red: "#A10F2B"
    gold: "#FFC35A"
    teal: "#49D3C2"
  semantic:
    success: "#49D3C2"
    warning: "#FFC35A"
    danger: "#FF6D79"
  border:
    subtleOnDark: "rgba(255, 255, 255, 0.12)"
    strongOnDark: "rgba(255, 255, 255, 0.22)"
  shadow:
    darkPanel: "0 18px 44px rgba(0, 0, 0, 0.35)"
    pinkGlow: "0 10px 28px rgba(255, 79, 157, 0.28)"
```

Color usage:

- Backgrounds should be black or near-black.
- Hot pink is the brand action color, not a full-page wash.
- Deep red is for emotional accent, destructive states, or editorial emphasis.
- White is the primary text color on dark surfaces.
- Use teal and gold sparingly for status, success, highlights, or charts.
- Never build a page dominated by one hue family other than black/white with pink accents.

## Typography

Brand wordmark:

- text: `hnnt.`
- style: lower-case, rounded, glossy, inflated
- preferred CSS stack: `"Arial Rounded MT Bold", "Avenir Next", system-ui, sans-serif`
- use layered shadows/highlights to imply gloss, but keep it readable

Headlines:

- public marketing H1s should be bold, compact, and emotional
- app headings should be direct and smaller than marketing heroes
- use either a heavy rounded sans or a bold editorial serif when it matches the current web shell
- no negative letter spacing
- do not scale font size directly with viewport width except through bounded `clamp()`

Body:

- preferred stack: `"Avenir Next", "Segoe UI", system-ui, sans-serif`
- keep body copy short
- write in plain language
- avoid therapy jargon and startup jargon

Copy examples:

- "Rank what you can't say out loud."
- "Build your list."
- "Rank with friends."
- "Ask hnnt."
- "Create your HNNT account."
- "When friends ask for votes or share updates, they will appear here."

## Spacing And Layout

Use an 8px base scale.

```yaml
spacing:
  1: 4px
  2: 8px
  3: 12px
  4: 16px
  5: 20px
  6: 24px
  8: 32px
  10: 40px
  12: 48px
  16: 64px
```

Layout rules:

- Mobile-first; desktop should feel like an expanded app, not a separate enterprise product.
- Public landing pages may use one strong first-viewport brand moment.
- Auth screens should be focused, not marketing-heavy.
- App pages should prioritize quick action: My List, Rank, hnnt, Profile, Settings.
- Avoid cards inside cards.
- Avoid decorative orbs, bokeh blobs, generic gradients, and fake device mockups unless they communicate actual product state.
- Use stable dimensions for nav, controls, list rows, and app panels so content changes do not shift the UI.

## Radius, Borders, Elevation

Default radius:

```yaml
radius:
  small: 6px
  default: 8px
  pill: 999px
  phonePreview: 32px
```

Rules:

- Most cards, inputs, and buttons should use 8px radius.
- Reserve large rounding for brand wordmark, avatars, or phone/device previews.
- Use subtle white borders on dark panels.
- Use pink glow only on primary CTA buttons or brand moments.
- Avoid heavy glassmorphism. Dark panels should feel solid and intentional.

## Components

### Buttons

Primary:

- hot pink/gloss pink gradient
- white text
- bold label
- subtle inner highlight and pink glow
- use for account creation, save, submit, create vote, create situationship

Secondary:

- white or near-white fill on black
- dark text
- use for sign in, alternate actions, less prominent CTAs

Ghost:

- dark raised surface
- subtle white border
- use for app nav, settings rows, low-risk actions

Destructive:

- deep red or danger text
- never use hot pink for destructive action

### Inputs

- dark surface
- white text
- subtle border
- clear label above the field
- visible focus ring using hot pink or gloss pink
- password fields must preserve platform autofill behavior

### Cards And Panels

- use for discrete repeated items, modals, app panels, and content pages
- do not nest UI cards inside larger decorative cards
- list rows should be scannable and dense enough for repeated use

### Navigation

Public nav:

- brand left: `hnnt.`
- links: Blog, Guide, Sign in, Create account
- footer links: Terms, Privacy, Blog, Guide

Authenticated app nav should mirror iOS:

- My List
- Rank
- hnnt
- Profile
- Settings

Avoid adding extra top-level app tabs unless the product flow requires it. Voting should usually be launched from My List or Rank unless a dedicated flow is clearly needed.

## Product Screens

### Landing

The first viewport should signal the brand immediately:

- black background
- glossy `hnnt.`
- line: "Rank what you can't say out loud."
- primary CTA: Create account
- secondary CTA: Sign in

Do not open with technical descriptions or team/internal language.

### Signup And Signin

Signup options should include:

- email/password as the functional baseline
- TikTok
- Snapchat
- Meta
- Apple only when web credentials and redirect handling are configured

Do not show local development auth as a user-facing option. Development accounts should be created through real API auth when the database tunnel/bastion is available.

### My List

Purpose:

- create, edit, delete, reorder, and eventually archive situationships

Tone:

- private and quick
- no judgement-heavy labels
- keep categories familiar: Crush, Friend, Ex, Work, Other, etc.

### Rank

Purpose:

- show friends' feed submissions
- allow vote actions
- refresh after vote submission

State parity:

- feed data is server-owned
- after creating submissions or votes, reload the feed aggregate from the API
- do not maintain web-only feed truth

### Voting

Purpose:

- create invite sessions
- public vote submission
- owner results

State parity:

- vote submission and results are server-owned
- public voters use stable browser voter identity where required
- owner results must reload from the API after session creation or vote submission

### hnnt

Purpose:

- private reflection and practical guidance
- should feel supportive without being clinical
- should avoid manipulative or escalatory advice

Use concise prompts and clear boundaries.

### Settings And Legal

Settings should include:

- profile
- privacy controls
- blocked/reported users when implemented
- Terms of Service
- Privacy Policy
- sign out

Legal/content pages should share the black/pink brand system but prioritize readability.

## Accessibility

Required:

- maintain WCAG AA contrast for text and controls
- visible focus states on all keyboard-interactive elements
- real labels for form fields
- buttons must describe the action, not just an icon
- do not encode meaning through color alone
- touch targets should be at least 44px high on mobile
- public copy must be readable without relying on brand effects

Because the target audience includes 16-17 year olds, avoid sexualized visual treatment, coercive copy, or exploitative engagement patterns.

## Responsive Behavior

Breakpoints:

```yaml
breakpoints:
  mobile: 0-599px
  tablet: 600-899px
  desktop: 900px+
```

Rules:

- mobile is the primary experience
- desktop should preserve app tasks without becoming a dashboard
- nav can wrap, but text must not overlap or overflow controls
- forms should stay single-column on mobile
- public landing media should stack below copy on narrow screens

## Agent Instructions

When building UI:

1. Read this file before editing frontend code.
2. Use these tokens or platform equivalents.
3. Preserve iOS/web parity in flow names and route concepts.
4. Do not invent a new color palette.
5. Do not add generic SaaS sections such as "integrations", "analytics", or "team workflows".
6. Do not expose implementation language to users.
7. Keep changes scoped to the requested surface.
8. Verify in browser or simulator after significant visual changes.

When unsure, choose:

- darker
- simpler
- more private
- more mobile-first
- less corporate
- less explanatory
