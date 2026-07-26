# Contributing

## Local setup

Use the Node and pnpm versions declared by `.nvmrc` and `package.json`.

```bash
corepack enable
corepack prepare pnpm@10.34.5 --activate
pnpm install
pnpm check
```

## Change guidelines

- Keep domain logic out of React components.
- Collectors return normalized domain records; they do not write dashboard files.
- Storage is accessed through the storage package rather than direct filesystem calls.
- Never commit credentials, authorization headers, or private response payloads.
- Dashboard artifacts must be reproducible from committed configuration and observation data.
- Treat files under `data/` as generated records; use collection commands rather than editing them manually.
- Add fixture-based tests for provider integrations; routine tests must not require network access.
- Update an architecture decision record when changing a foundational choice.
- Do not change an existing source ID when editing its category, tags, or display metadata.
- Run `pnpm registry:validate` after manually editing registry YAML.

## Pull requests

Pull requests should be narrow, describe how the change was verified, and pass `pnpm check`. Automated data commits use a clearly marked `data:` prefix.

Approved source-request automation requires the repository label `source:approved` and the repository setting that allows GitHub Actions to create pull requests.
