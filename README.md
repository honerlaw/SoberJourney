# SoberJourney

A sobriety companion app that helps you track your recovery journey, journal your thoughts, and stay accountable with check-ins and push notification reminders.

**Live at [soberjourney.app](https://soberjourney.app)**

## Features

- **Journey Tracking** — Create and manage sobriety journeys with day-count tracking
- **Check-ins** — Regular check-ins tied to your journeys to stay accountable
- **Journaling** — Write journal entries linked to check-ins or standalone
- **AI Sponsor** — Chat with an AI companion powered by Gemini when you need support
- **Push Notifications** — Scheduled reminders to keep you on track
- **Multi-conversation** — Maintain separate AI conversations for different topics
- **Privacy First** — Server-side encryption for sensitive data; full account and data deletion

## Tech Stack

- **App** — React Native (Expo SDK 54), Expo Router, Tamagui, TypeScript
- **Server** — Express, tRPC, Prisma, PostgreSQL, TypeScript
- **Auth** — Clerk (with Apple Sign-In)
- **AI** — Google Gemini
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