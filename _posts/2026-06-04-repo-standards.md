---
title: "repo-standards: A Toolkit for Consistent, High-Quality GitHub Repositories"
description: "repo-standards is a versioned, AI-assisted framework that brings structure, security, documentation, and automation best practices to GitHub repositories. It includes templates, upgrade prompts for Claude Code, and a strong focus on supply-chain security and maintainability."
keywords: ["github standards", "repository standards", "repo standards", "claude code", "github best practices", "supply chain security"]
date: 2026-06-04
category: "Projects"
tags: [github, standards, automation, security, documentation, claude]
image: /assets/images/repo-standards/repo-standards-hero.webp
backdrop: /assets/images/repo-standards/repo-standards-hero.webp
status: published
series: "project-showcases"
series_order: 9
comments: true
---

<nav>
  <strong>Table of Contents</strong>
  <ol>
    <li><a href="#introduction">Introduction</a></li>
    <li><a href="#what-is">What is repo-standards?</a></li>
    <li><a href="#versions">Version History: v1 → v3</a></li>
    <li><a href="#features">Key Features</a></li>
    <li><a href="#how-it-works">How It Works</a></li>
    <li><a href="#prompts">The Modular Prompt System</a></li>
    <li><a href="#security">Security &amp; Supply-Chain Hardening</a></li>
    <li><a href="#templates">Templates &amp; Tooling Configs</a></li>
    <li><a href="#dogfood">Self-Validation &amp; Dogfooding</a></li>
    <li><a href="#pitfalls">Pitfalls &amp; Ground Rules</a></li>
    <li><a href="#key-takeaways">Key Takeaways</a></li>
    <li><a href="#conclusion">Conclusion</a></li>
    <li><a href="#more">More Project Showcases</a></li>
    <li><a href="#sources">Sources</a></li>
  </ol>
</nav>

<h2 id="introduction">Introduction</h2>

Maintaining multiple GitHub repositories at a high standard can quickly become repetitive and error-prone. **repo-standards** solves this by providing a living, versioned toolkit that defines what "good" looks like — and gives you the tools (including AI prompts) to bring existing repositories up to that standard efficiently.

It is the distilled result of years of refinement across the author's own projects and is actively dogfooded in the standards repository itself. The project lives at [Ranzlappen/repo-standards](https://github.com/Ranzlappen/repo-standards)<sup><a href="#source-1">[1]</a></sup> and is currently at **v3.2.0**.

<h2 id="what-is">What is repo-standards?</h2>

`repo-standards` is a portable framework that helps developers and maintainers bring consistency, security, and professionalism to their GitHub repositories. It answers two practical questions:

1. What does a well-maintained repository look like?
2. How can I bring my existing repos up to that level with minimal manual effort?

The answer is a combination of:

- Clear templates and folder structures
- Security and supply-chain hardening practices
- Documentation and governance standards
- Automated upgrade processes powered by Claude Code<sup><a href="#source-2">[2]</a></sup>
- Versioned releases so you can track compatibility via a `.standards-version` file

<h2 id="versions">Version History: v1 → v3</h2>

The standards follow semantic versioning. A repository's `.standards-version` file declares which major version it follows; the upgrade tooling refuses to apply v2 rules to a v1 repo (or vice versa), preventing silent conflicts.

| Version | Major additions |
|---|---|
| **v1** | Basic repository structure and community files |
| **v2** | "Tiny-commit rhythm" (one file per response), Conventional Commits enforcement, hardened CI with least-privilege permissions and SHA-pinned workflow actions |
| **v2.1** | Refactoring-guide documentation, OIDC-based automated publishing (npm, PyPI, GHCR), governance templates, AI-native `CLAUDE.md` support and multi-AI coordination playbooks |
| **v3** | Dogfoods its own standards; modular prompt structure; OpenSSF Scorecard<sup><a href="#source-3">[3]</a></sup> integration; Phase 0 migration-planning layer; supply-chain baseline with dependency-review gates |

The current release, **v3.2.0**, introduces the one-step upgrade instruction: copy `PROMPT.md` into a fresh Claude Code session.

<h2 id="features">Key Features</h2>

- **Versioned Standards (v3)** — Semantic versioning so every repository knows exactly which standard it follows. The `.standards-version` file is the single source of truth.
- **AI-Assisted Upgrades** — A modular `PROMPT.md` that Claude Code can execute to upgrade a repository through a structured sequence of pull requests.
- **Security &amp; Supply Chain** — Includes CodeQL, Gitleaks, dependency review, OpenSSF Scorecard, signed commits, and OIDC publishing with no stored tokens.
- **Strong Documentation Practices** — Templates for README, CHANGELOG, CONTRIBUTING, SECURITY, GOVERNANCE, and Architecture Decision Records (ADRs).
- **Code Quality Tooling** — Pre-configured linting, formatting, and pre-commit hooks for Node (ESLint, Prettier), Python (Ruff, pyproject.toml), and Android projects.
- **AI-Native Support** — Includes `CLAUDE.md` templates, `.cursorrules`, and an AI Team Playbook for working effectively with multiple AI coding assistants.
- **Dogfooding** — The standards repository itself follows every rule it defines, verified by `dogfood-audit.py` on every PR.

<h2 id="how-it-works">How It Works</h2>

There are two execution flows:

**Option A: GitHub Actions (recommended for mobile or shared machines)**

1. Install the [Claude Code GitHub Action](https://github.com/marketplace/actions/claude-code-action) in your target repository.
2. Open an issue titled "Upgrade to repo standards", paste the contents of `PROMPT.md` in the body, and tag `@claude`.
3. Claude posts a Phase 0 plan, waits for your confirmation, then opens the canonical sequence of pull requests.
4. Review and merge each PR; CI runs automatically after each merge.

**Option B: Direct Claude Code session**

1. Clone the target repository locally (or open it in the Claude Code Android app).
2. Start a new session and paste `PROMPT.md` as the first message.
3. Claude profiles the repo (Phase 0), scores each checklist item by effort × value × risk, and presents a tailored roadmap before touching a single file.
4. You confirm; Claude works through the 8-PR canonical sequence.

Both flows are auditable, reversible where possible, and designed to respect existing behavior 100%. Claude is instructed to stop and propose options rather than self-decide on any conflict.

<h2 id="prompts">The Modular Prompt System</h2>

`PROMPT.md` is an entry-point index that references seven focused files under `prompt/`:

| File | Purpose |
|---|---|
| `migration-planning.md` | Phase 0 — repo profile, scoring, and roadmap |
| `00-version-check.md` | Compatibility gate (refuses major-version mismatches) |
| `01-ground-rules.md` | The 18 non-negotiable behavioral rules in full |
| `02-canonical-pr-sequence.md` | Steps 1–2: read, audit, plan the 8-PR sequence |
| `03-pr-description.md` | Step 3: required PR structure |
| `04-wiki-seeding.md` | Step 4: optional Wiki integration |
| `05-migration-debrief.md` | Step 5: mandatory session debrief |

The 18 ground rules include: behavior preservation (100% of original functionality must survive), the tiny-commit discipline (one file per response, one Conventional Commit per change), post-task self-checks after every commit, and a branch-guard rule (rebase, never merge, when behind `origin/main`).

<h2 id="security">Security &amp; Supply-Chain Hardening</h2>

Supply-chain security is a first-class concern in v3:<sup><a href="#source-4">[4]</a></sup>

- **SHA-pinned workflow actions** — all `uses:` lines in provided workflow templates are pinned to 40-character commit SHAs with a trailing `# vX.Y.Z` comment. Dependabot bumps both the SHA and the comment so pins stay current without manual effort.
- **Least-privilege permissions** — every workflow job declares the minimum `permissions:` it needs; nothing defaults to write-all.
- **Gitleaks scanning** — runs on every PR and on a weekly schedule to catch accidentally committed secrets.
- **CodeQL analysis** — static security scanning for supported languages.
- **OpenSSF Scorecard** — weekly runs with badge integration, surfacing supply-chain risk scores publicly.<sup><a href="#source-3">[3]</a></sup>
- **Dependency review** — a required PR status check that gates on CVE severity "high" using the GitHub `dependency-review-action`.
- **OIDC publishing** — `release-please.yml` publishes to npm, PyPI, and GHCR via OIDC (no long-lived token stored as a secret).
- **Pre-commit hook** — blocks files ≥ 5 MB before push to prevent accidental large-binary commits.

<h2 id="templates">Templates &amp; Tooling Configs</h2>

The `templates/` directory contains ready-to-use boilerplate for downstream consumers:

**Community files:** `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `SECURITY.md`, `FUNDING.yml`, `CODEOWNERS`

**Workflow templates:**
- `dependency-review.yml` — per-PR CVE gating
- `security-scan.yml` — CodeQL + Gitleaks + OpenSSF Scorecard
- `release-please.yml` — OIDC-based publishing (npm / PyPI / GHCR), disabled by default, activated per repo via repository variables
- `stale.yml` — opt-in issue/PR housekeeping
- `dogfood-audit.yml` — self-compliance verification

**Language-specific CI:** templates for Node, Python, static HTML, and Android projects.

**Tooling configs:** `.editorconfig`, Prettier, ESLint flat config, Ruff, `pyproject.toml`, Vitest, pre-commit hooks.

**AI support files:** `CLAUDE.md` template, `.cursorrules`, and an AI Team Playbook for multi-assistant coordination.

**GitHub Wiki layouts:** Home, Architecture, FAQ, and Migration Guide page templates.

<h2 id="dogfood">Self-Validation &amp; Dogfooding</h2>

`dogfood-audit.py` runs 8 assertion groups covering 33 invariants on every pull request:

1. LICENSE compliance
2. Versioning correctness (`.standards-version` present and valid)
3. Community files presence
4. Workflow integrity (SHA pins, permissions declarations)
5. README badge validity
6. Modular prompt structure
7. Placeholder hygiene (no unreplaced `TODO` placeholders in shipped files)
8. Workflow–sidecar pairing (each workflow has a corresponding test or check)

Every PR must pass all 33 invariants before merge. The standards repository cannot publish a version it cannot itself satisfy — that is the dogfooding guarantee.

<h2 id="pitfalls">Pitfalls &amp; Ground Rules</h2>

A few things worth knowing before you run the upgrade prompt:

- **Major-version compatibility** — the tooling hard-refuses to apply v3 rules to a v1 or v2 repo. Run a version bump PR first if needed.
- **Android repos last** — the recommended upgrade order is: single-file HTML → small utilities → larger projects → Android (the toolchain is different enough to warrant separate care).
- **Out-of-scope issues** — if Claude discovers problems beyond the upgrade scope, it auto-files GitHub issues rather than fixing them silently. Set `DISABLE_OUT_OF_SCOPE_ISSUES=true` to suppress.
- **Token budget** — sessions are sized at ~30% context per response and ~4-hour caps. Large repos may need multiple sessions to complete the full 8-PR sequence.
- **Behavior preservation is non-negotiable** — the prompt explicitly forbids changing any user-facing behavior or API contract. Standards are additive.

<h2 id="key-takeaways">Key Takeaways</h2>

- repo-standards provides a clear, versioned definition of what a high-quality GitHub repository looks like, currently at v3.2.0.
- The modular `PROMPT.md` + Claude Code integration dramatically reduces the effort required to standardize repositories — from days of manual work to a guided sequence of reviewed PRs.
- Strong emphasis on supply-chain security: SHA-pinned actions, OIDC publishing, OpenSSF Scorecard, Gitleaks, and a pre-commit size gate.
- Excellent documentation and template coverage across Node, Python, static HTML, and Android stacks.
- Actively maintained and dogfooded: the standards repo must itself pass `dogfood-audit.py` on every commit.

<h2 id="conclusion">Conclusion</h2>

For anyone maintaining more than one or two repositories, **repo-standards** offers a practical and thoughtful way to raise quality, improve security, and reduce long-term maintenance burden. The combination of clear standards, high-quality templates, and AI-assisted migration — backed by a self-validating dogfood loop — makes it especially compelling in 2026.

Whether you want to bring existing projects up to a professional standard or start new ones on a solid foundation, this toolkit is worth a look.

[View the repository](https://github.com/Ranzlappen/repo-standards) — MIT licensed, v3.2.0 current.

<h2 id="more">More Project Showcases</h2>

Other projects in this series that might interest you:

- [Pageside](/blog/2026/06/04/pageside/) — Manifest V3 browser extension for CSS injection, TTS, and media downloads
- [tools.ranzlappen.com](/blog/2026/06/04/tools/) — Browser-based developer utilities
- [Discord Music Bot](/blog/2026/06/04/discord-musicbot/) — A self-hosted Discord music bot

<h2 id="sources">Sources</h2>

<ol>
  <li id="source-1"><a href="https://github.com/Ranzlappen/repo-standards">Ranzlappen/repo-standards</a> — GitHub repository: README, PROMPT.md, UPGRADE_CHECKLIST.md, templates/, and v3.2.0 release (accessed June 2026).</li>
  <li id="source-2"><a href="https://docs.anthropic.com/en/docs/claude-code/overview">Claude Code — Overview</a> — Anthropic's official documentation for Claude Code, the AI coding assistant used to execute the upgrade prompt.</li>
  <li id="source-3"><a href="https://securityscorecards.dev/">OpenSSF Scorecard</a> — Automated supply-chain risk scoring tool integrated in the v3 security-scan workflow.</li>
  <li id="source-4"><a href="https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions">GitHub Docs — Security hardening for GitHub Actions</a> — The official guidance on least-privilege permissions and SHA-pinned actions that underpins the v3 supply-chain hardening.</li>
  <li id="source-5"><a href="https://www.conventionalcommits.org/en/v1.0.0/">Conventional Commits v1.0.0</a> — The commit-message specification enforced by the v2+ "tiny-commit rhythm" ground rule.</li>
  <li id="source-6"><a href="https://release-please.readthedocs.io/en/latest/">Release Please</a> — The automated release PR tool used in the OIDC publishing workflow template.</li>
</ol>
