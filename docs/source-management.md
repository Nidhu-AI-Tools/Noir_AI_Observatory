# Source management

The source registry is configuration-as-code. Every change is validated, reviewable, and recoverable through Git history.

## Local workflow

Use `pnpm source:add` for an interactive add flow. The command validates the external provider, previews the resolved name and URL, normalizes tags, checks the selected category, and writes `config/sources.yaml` atomically.

Use `pnpm source:edit <id>` to change display name, description, category, tags, or status. Source IDs, kinds, and locators are intentionally immutable through ordinary edits.

Run `pnpm category:add` or `pnpm category:edit <id>` to manage taxonomy display metadata. Category IDs remain stable so a rename automatically applies to every source.

## Remote workflow

The Radar dashboard links to GitHub Issue Forms for additions and edits. Expand **Source details and settings** on any card to inspect its immutable ID and request changes. To activate automated pull requests:

1. Create a repository label named `source:approved`.
2. In repository Actions settings, enable the option allowing GitHub Actions to create pull requests.
3. Review a submitted source issue.
4. Apply the `source:approved` label.
5. Review and merge the configuration pull request created by the workflow.

Unapproved issues never receive write access or provider credentials. The workflow treats every field as data, validates it with the same service as the local CLI, and commits only registry configuration.

## Credentials

Public GitHub repositories and Hugging Face organizations can normally be validated without credentials. Set `GITHUB_TOKEN` or `HF_TOKEN` locally when needed. For Actions, `GITHUB_TOKEN` is provided automatically; `HF_TOKEN` is an optional repository secret.

Never place a token in `config/sources.yaml`, an issue, a command argument, or a committed environment file.
