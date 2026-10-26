# TaskOrbit

A full-stack workflow automation platform for designing, running, and monitoring event-driven automations through a visual node editor.

**Repository owner and maintainer:** [Mayank Lohani](https://github.com/brinesolution)

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-4169E1?logo=postgresql&logoColor=white)
![Inngest](https://img.shields.io/badge/Inngest-Workflow%20Engine-5A45FF)
![React Flow](https://img.shields.io/badge/React%20Flow-Visual%20Editor-FF0072)

## Overview

TaskOrbit combines a drag-and-drop workflow editor with an event-driven execution engine. Users can create workflows, connect triggers to actions, store service credentials, execute automations, and inspect execution history from one dashboard.

TaskOrbit is a workflow automation application built with Next.js, tRPC, Prisma, PostgreSQL, Inngest, and React Flow.

## Core Features

- Secure email/password and OAuth authentication
- Visual drag-and-drop workflow builder
- Directed workflow connections with React Flow
- Manual, Google Forms, and Stripe triggers
- HTTP request actions
- Gemini-powered workflow actions
- Discord and WhatsApp actions
- Credential management for external services
- Event-driven execution with Inngest
- Topological workflow execution
- Execution history and status tracking
- Realtime execution updates
- Error monitoring support through Sentry
- Polar-based billing integration

## Architecture

```text
Browser / Next.js UI
        |
        v
      tRPC
        |
        v
Application Services -----> PostgreSQL / Prisma
        |
        v
      Inngest
        |
        v
Workflow Executor
   |      |      |
 HTTP   Gemini  Messaging
```

A workflow is stored as nodes and connections. When a trigger starts an execution, the workflow engine resolves dependency order, passes context between nodes, and dispatches the configured actions through the executor registry.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 16, React 19, TypeScript |
| UI | Tailwind CSS, shadcn/ui, Lucide React |
| Workflow editor | React Flow / `@xyflow/react` |
| API | tRPC, TanStack Query |
| Database | PostgreSQL, Prisma ORM, Neon adapter |
| Authentication | Better Auth |
| Background execution | Inngest |
| State | Jotai |
| Billing | Polar |
| Monitoring | Sentry |
| Validation | Zod |

## Project Structure

```text
Taskorbit/
├── app/                  # Next.js routes, layouts, APIs and webhooks
├── components/           # Shared UI and workflow components
├── config/               # Node and application configuration
├── features/             # Feature modules and server routers
├── hooks/                # Shared React hooks
├── inngest/              # Background jobs, channels and workflow functions
├── lib/                  # Auth, database and shared services
├── prisma/               # Prisma schema and migrations
├── public/               # Static assets and integration logos
├── trpc/                 # tRPC client/server setup
├── .env.example          # Environment variable template
└── package.json
```

## Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/brinesolution/Taskorbit.git
cd Taskorbit
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the tracked template and fill in the services you want to use:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

At minimum, configure `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, and `NEXT_PUBLIC_APP_URL` for accounts. Configure `CREDENTIALS_ENCRYPTION_KEY` to store encrypted service credentials; generate a base64-encoded 32-byte key with `openssl rand -base64 32`. OAuth, billing, hosted Inngest, and Sentry values are optional unless you use those features.

External action credentials such as Gemini, Discord, and WhatsApp credentials are managed through TaskOrbit's credential interface rather than committed to the repository.

### 4. Generate Prisma client

```bash
npx prisma generate
```

### 5. Apply database migrations

```bash
npx prisma migrate deploy
```

For local schema development, use:

```bash
npx prisma migrate dev
```

### 6. Start TaskOrbit

```bash
npm run dev
```

The application runs at `http://localhost:3000` by default.

### 7. Start the Inngest development server

In a second terminal:

```bash
npx inngest-cli@latest dev
```

## Get Started

Open TaskOrbit at `/`. The public landing page links to **Sign in** and
**Create account**. After signing in, TaskOrbit opens your **Workflows** list.
New accounts can start with a workflow template from the empty state or create
an empty workflow. Templates are copied into your account only when you choose
**Use template**; they contain no personal service credentials.

To build and run a workflow:

1. Create a workflow or choose a template.
2. Add a trigger and the actions you need in the visual editor.
3. Configure service credentials under **Credentials** when an action requires them.
4. Save and execute the workflow.
5. Open **Executions** to inspect status and output.

A concise workflow sequence is:

```text
Create Workflow -> Add Trigger -> Add Action -> Connect Nodes -> Execute -> Inspect Result
```

## Production Checklist

Before deploying a public instance:

- Use a production PostgreSQL database.
- Set a strong `BETTER_AUTH_SECRET`.
- Set `CREDENTIALS_ENCRYPTION_KEY` to a base64-encoded 32-byte key before storing service credentials. Keep the key private and back it up securely; credentials encrypted with a different key cannot be decrypted.
- Configure the public application URL.
- Configure OAuth redirect URLs for the production domain.
- Set hosted Inngest keys if background jobs run outside local development.
- Configure Polar only when billing is required.
- Configure Sentry through environment variables if monitoring is required.
- Keep all `.env` files and service credentials out of source control.

### Vercel setup for accounts

TaskOrbit uses Better Auth with email/password accounts and optional GitHub and
Google OAuth. In the Vercel project settings, add the required server-side
values for the features you enable:

- `DATABASE_URL` — a production Neon PostgreSQL connection string.
- `CREDENTIALS_ENCRYPTION_KEY` - a private base64-encoded 32-byte key used to encrypt stored service credentials (generate with `openssl rand -base64 32`).
- `BETTER_AUTH_SECRET` — a random secret (for example,
  `openssl rand -base64 32`).
- `BETTER_AUTH_URL` — `https://taskorbit-mayank-nu.vercel.app`.
- `NEXT_PUBLIC_APP_URL` — `https://taskorbit-mayank-nu.vercel.app`.

Apply the committed Prisma migrations with `npx prisma migrate deploy` after
connecting the database. To enable social login, add each provider's client ID
and secret and register these callback URLs:

- GitHub: `https://taskorbit-mayank-nu.vercel.app/api/auth/callback/github`
- Google: `https://taskorbit-mayank-nu.vercel.app/api/auth/callback/google`

GitHub and Google buttons appear only when their matching credentials are
configured. Polar billing remains optional and is hidden until its credentials
are configured. If the required database or auth values are missing, the login
and signup pages show setup guidance; account creation and workflow access
become available after setup is complete.

## Available Scripts

```bash
npm run dev      # Start the development server
npm run build    # Generate Prisma client and create a production build
npm run start    # Start the production server
npm run lint     # Run ESLint
```

## Integrations

TaskOrbit currently includes workflow support for:

- Google Forms
- Stripe
- HTTP APIs
- Gemini
- Discord
- WhatsApp

The node/executor architecture is intended to make additional integrations straightforward to add.

## Ownership and Maintenance

TaskOrbit is currently owned and maintained in this repository by **Mayank Lohani** (`@brinesolution`). Historical Git commit attribution is preserved in the repository history.

## Repository Status

This repository contains the TaskOrbit workflow automation application. Service-dependent features require their corresponding third-party credentials and accounts.
