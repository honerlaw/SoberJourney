# SoberJourney

A sobriety companion app that helps you track your recovery journey, journal your thoughts, and stay accountable with check-ins and push notification reminders.

**Live at [soberjourney.app](https://soberjourney.app)**

## Features

- **Journey Tracking** — Create and manage sobriety journeys with day-count tracking
- **Check-ins** — Regular check-ins tied to your journeys to stay accountable
- **Journaling** — Write journal entries linked to check-ins or standalone
- **AI Sponsor** — Chat with an AI companion (via OpenRouter) when you need support
- **Push Notifications** — Scheduled reminders to keep you on track
- **Multi-conversation** — Maintain separate AI conversations for different topics
- **Privacy First** — Server-side encryption for sensitive data; full account and data deletion

## Tech Stack

- **App** — React Native (Expo SDK 54), Expo Router, Tamagui, TypeScript
- **Server** — Express, tRPC, Prisma, PostgreSQL, TypeScript
- **Auth** — Clerk (with Apple Sign-In)
- **AI** — OpenRouter (default model `google/gemini-3.8-flash`)
- **Notifications** — Expo Push Notifications
- **Monorepo** — npm workspaces

## Project Structure

```
packages/
  app/       # React Native / Expo client (iOS, Android, Web)
  server/    # Express + tRPC API server
```

## Development

Requires Node >= 24.

```bash
npm install

# Start the server
cd packages/server
npm run start:local

# Start the app
cd packages/app
npm run start
```

### Server environment (AI)

The Sponsor chat calls an LLM through [OpenRouter](https://openrouter.ai):

- `OPENROUTER_API_KEY` — OpenRouter API key. Optional at boot: without it the server starts, but every Sponsor reply fails (a warning is logged at startup). Set a credit/spend limit on the key; it is the hard cost ceiling.
- `OPENROUTER_MODEL` — optional model slug; defaults to `google/gemini-3.8-flash`.
- `OPENROUTER_FALLBACK_MODELS` — optional comma-separated slugs OpenRouter tries when the primary model errors; defaults to `~google/gemini-flash-latest`. Set it to an empty value to disable fallbacks.
