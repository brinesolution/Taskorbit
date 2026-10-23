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

The project is designed as a portfolio-ready demonstration of modern full-stack architecture using Next.js, tRPC, Prisma, PostgreSQL, Inngest, and React Flow.

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

At minimum, configure `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, and `NEXT_PUBLIC_APP_URL`. OAuth, billing, hosted Inngest, and Sentry values are optional unless those features are being demonstrated.

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

## Demo Flow

The public root route (`/`) opens a standalone TaskOrbit demo workspace. Anyone
can switch between the three example workflows, inspect each step, and download
an importable `.taskorbit.json` file without signing in or entering ChatGPT.
The signed-in workspace also offers these templates from the empty-workflows
state.

For a reliable project demonstration:

1. Sign in and open the **Workflows** dashboard.
2. Create a new workflow.
3. Add a **Manual Trigger**.
4. Connect it to an **HTTP Request** action for a credential-free demonstration.
5. Save and execute the workflow.
6. Open **Executions** to show execution state and logs.
7. For an extended demo, add Gemini, Discord, WhatsApp, Google Forms, or Stripe after configuring the corresponding credentials.

A concise presentation sequence is:

```text
Create Workflow -> Add Trigger -> Add Action -> Connect Nodes -> Execute -> Inspect Result
```

## Production Checklist

Before deploying a public instance:

- Use a production PostgreSQL database.
- Set a strong `BETTER_AUTH_SECRET`.
- Configure the public application URL.
- Configure OAuth redirect URLs for the production domain.
- Set hosted Inngest keys if background jobs run outside local development.
- Configure Polar only when billing is required.
- Configure Sentry through environment variables if monitoring is required.
- Keep all `.env` files and service credentials out of source control.

### Vercel setup for accounts

TaskOrbit uses Better Auth with email/password accounts and optional GitHub and
Google OAuth. In the Vercel project settings, add the required server-side
values before enabling sign-up:

- `DATABASE_URL` — a production Neon PostgreSQL connection string.
- `BETTER_AUTH_SECRET` — a random secret (for example,
  `openssl rand -base64 32`).
- `BETTER_AUTH_URL` — `https://taskorbit-mayank.vercel.app`.
- `NEXT_PUBLIC_APP_URL` — `https://taskorbit-mayank.vercel.app`.

Apply the committed Prisma migrations with `npx prisma migrate deploy` after
connecting the database. To enable social login, add each provider's client ID
and secret and register these callback URLs:

- GitHub: `https://taskorbit-mayank.vercel.app/api/auth/callback/github`
- Google: `https://taskorbit-mayank.vercel.app/api/auth/callback/google`

GitHub and Google buttons appear only when their matching credentials are
configured. Polar billing remains optional and is hidden until its credentials
are configured. If the required database or auth values are missing, the login
and signup pages show setup guidance, while the public demo workspace continues
to work.

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

This repository is maintained as a full-stack project and demonstration build. Service-dependent features require their corresponding third-party credentials and accounts.
