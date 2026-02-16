import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: 1.0,
  tracePropagationTargets: [
    /^https:\/\/.*\.vercel\.app\/api/,
    /^https:\/\/.*\.railway\.app\/api/,
    /^https:\/\/the-office\.vza\.net\/api/,
  ],
  enableLogs: true,
  environment: process.env.NODE_ENV,
});

export function onRouterTransitionStart(href: string, navigationType: string) {
  Sentry.captureRouterTransitionStart(href, navigationType);
}
