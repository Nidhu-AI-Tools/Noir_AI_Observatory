# Automated daily curation

At `12:45 Asia/Kolkata`, macOS runs Ollama locally, merges current `main` data into `Noir`, creates a source-bound draft, and pushes `Noir`. That push starts a GitHub-hosted workflow that opens or updates a bot-authored pull request and requests review from `Nidhushan`.

The note remains a draft until you approve and merge the pull request. After an approved merge, another GitHub-hosted workflow records publication metadata on `main`. GitHub sends the review-request email according to your notification settings.

## One-time setup

First merge these automation files into `main`. Then create a dedicated clone so automation never interrupts your normal working copy:

```bash
git clone https://github.com/Nidhu-AI-Tools/Noir_AI_Observatory.git "$HOME/Noir_AI_Observatory_Automation"
cd "$HOME/Noir_AI_Observatory_Automation"
git switch Noir
corepack pnpm install --frozen-lockfile
bash scripts/install-curation-automation.sh
```

Under **Repository Settings → Actions → General**, enable **Read and write permissions** and **Allow GitHub Actions to create and approve pull requests**. In GitHub notification settings, enable email notifications for pull-request review requests.

The Mac must be awake and online around `12:45`, and its Git credentials must be able to push `Noir`. Ollama is started automatically and the job waits for it to become ready.

Test the complete local half immediately:

```bash
launchctl kickstart -k "gui/$(id -u)/com.noir.ai-observatory-curation"
tail -f .noir/automated-curation.log
```

When `Noir` is pushed, **Open daily AI curation review** creates the pull request and requests your review. No GitHub CLI, personal access token, or self-hosted GitHub runner is required.

To disable the schedule:

```bash
launchctl bootout "gui/$(id -u)/com.noir.ai-observatory-curation"
```
