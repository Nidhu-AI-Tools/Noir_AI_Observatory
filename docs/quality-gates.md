# Quality gates

Run the complete local release check with:

```bash
corepack pnpm check
```

This validates source data, builds the static dashboard, audits generated public
links, and enforces generated artifact budgets. The link audit is structural: it
rejects malformed URLs, loopback targets, and Hugging Face provider-internal IDs
without repeatedly fetching third-party websites.

After a GitHub Pages deployment, the workflow verifies the five primary routes,
legacy routes, and generated Today and Research indexes at the deployed URL.

## Payload budgets

`config/dashboard-budgets.json` contains the public-artifact limits. Update a
limit only with a pull-request explanation that identifies the product need and
the measured before/after size.

## Daily curation recovery

The local LaunchAgent logs a timestamped start and successful push. If a draft
is committed locally but the push fails, retry the existing draft safely with:

```bash
launchctl kickstart -k "gui/$(id -u)/com.noir.ai-observatory-curation"
```

The job never force-pushes and preserves the local draft when a network failure
prevents the final push.
