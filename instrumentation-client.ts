import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

// Monitoring is disabled when the DSN is unset (local / fork environments).
// User file names, file contents and query strings are never sent —
// the site's promise that data never leaves the browser applies to monitoring too.
if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0,
    beforeSend(event) {
      if (event.request) {
        delete event.request.query_string;
        delete event.request.data;
      }
      return event;
    },
  });
}
