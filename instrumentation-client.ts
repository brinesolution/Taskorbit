import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  integrations: [Sentry.replayIntegration()],
  tracesSampleRate: 0.1,
  enableLogs: Boolean(dsn),
  replaysSessionSampleRate: 0.05,
  replaysOnErrorSampleRate: 1,
  sendDefaultPii: false,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
