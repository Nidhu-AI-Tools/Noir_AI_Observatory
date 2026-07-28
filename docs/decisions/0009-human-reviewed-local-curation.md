# ADR 0009: Human-reviewed local AI curation

## Status

Accepted

## Decision

Daily interpretation is generated locally from a deterministic, bounded evidence context. Ollama and Codex implement one structured provider contract. Ollama is restricted to an uncredentialed loopback HTTP origin; Codex executes ephemerally in a read-only sandbox. Provider text is schema validated, and evidence identifiers and URLs must exactly match the supplied context.

Draft generation, human publication, Git commit, and Git push are separate boundaries. Providers cannot invoke Git. Temporary contexts and raw responses are ignored, while published Markdown retains provider/model disclosure, evidence links, a context hash, and review time.

## Consequences

The default workflow costs no inference API usage and produces an auditable human-in-the-loop contribution. Local automation may prepare a draft, but publication still requires explicit review. The system does not fact-check publisher claims beyond enforcing provenance, so notes must preserve caveats and avoid presenting interpretation as fact.
