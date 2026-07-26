# 0002: Begin with a static dashboard

- Status: Accepted
- Date: 2026-07-26

## Context

The initial dashboard is read-only and consumes data produced by scheduled jobs. It does not require user sessions or request-time computation.

## Decision

Build the dashboard with Next.js static export and deploy it through GitHub Pages. Generated, frontend-sized JSON summaries will be its data boundary.

## Consequences

Hosting requires no application server. The public dashboard cannot mutate repository configuration directly; the initial remote management path will use GitHub forms and pull requests. Next.js can later run with a server when a hosted admin interface is warranted.
