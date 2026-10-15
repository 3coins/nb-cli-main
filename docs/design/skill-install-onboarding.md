# Design: `nb skill install` and post-install agent onboarding

## Problem

Getting `nb` working with an AI agent is two mental steps today:

1. Install the binary (`cargo install nb-cli`, `curl … install.sh | bash`, or a release download), then fix `PATH`.
2. Wire the skill into the agent — `npx skills install jupyter-ai-contrib/nb-cli` (a *different* tool) **plus** a manual edit to `CLAUDE.md`/`AGENTS.md` to tell the agent to prefer `nb` for `.ipynb`.

Step 2 is standard for the agent-tool ecosystem (MCP servers register via `claude mcp add`; skills via the Vercel `skills` tool), so the goal is not to remove it. The problems are narrower:

- It requires a **second tool** the user has to know to reach for.
- It has a **hidden manual sub-step** (the `AGENTS.md` edit) that is easy to skip, after which the agent silently keeps parsing notebook JSON and ignores `nb`.
- Nothing **signals the gap**: `cargo install` + typing `nb` commands works immediately, so the user is never prompted to discover step 2.

## Non-goal: do not reimplement skills.sh

The Vercel `skills` tool maintains per-agent install locations for ~79 agents and tracks them as agents change conventions. We will **not** reimplement that matrix. Instead:

- **First-class support for a curated top 5** (below), owned directly by `nb`.
- **Delegate the long tail to skills.sh**: when the agent isn't one of the five, `nb skill install` prints the `npx skills install jupyter-ai-contrib/nb-cli` fallback.

This keeps the maintenance blast radius to 5 entries we can patch, and keeps skills.sh as the escape hatch for everything else.

## Supported agents (v1)

All five are CLI-native or CLI-capable agents where `nb`'s shell-first design fits best. Locations verified Oct 2026 against each agent's own docs/skills ecosystem.

| Agent | User-scope skill dir | Project-scope skill dir | Instruction file | Detection probe |
|---|---|---|---|---|
| **Claude Code** | `~/.claude/skills/notebook-cli/` | `.claude/skills/notebook-cli/` | `CLAUDE.md` / `AGENTS.md` | `~/.claude/` exists, or `claude` on PATH |
| **Codex** | `~/.codex/skills/notebook-cli/` | `.codex/skills/notebook-cli/` | `AGENTS.md` | `~/.codex/` exists, or `codex` on PATH |
| **Kiro** | `~/.kiro/skills/notebook-cli/` (CLI) | `.kiro/steering/` + project skills | `AGENTS.md` | `~/.kiro/` exists, or `kiro` on PATH |
| **OpenCode** | `~/.opencode/skills/notebook-cli/` | `./skills/notebook-cli/` | `AGENTS.md` | `~/.opencode/`/`~/.config/opencode/` exists, or `opencode` on PATH |
| **Gemini CLI** | `~/.gemini/skills/notebook-cli/` | `.gemini/` | `GEMINI.md` | `~/.gemini/` exists, or `gemini` on PATH |

Notes:
- Codex, OpenCode, and Kiro natively discover `SKILL.md` directories; the skill drops in with no extra wiring beyond the instruction file.
- Claude Code reads the skill dir but still benefits from the `CLAUDE.md`/`AGENTS.md` nudge for the "use nb for .ipynb" rule.
- Gemini is the one agent that keys off a differently-named instruction file (`GEMINI.md`); it falls back to `AGENTS.md` where supported.
- Exact per-agent paths are confirmed per-release before shipping; the table is the source of truth and lives beside the embedded skill.

## The skill ships inside the binary

The keystone. Embed `skills/notebook-cli/` into the `nb` binary at compile time (`include_dir!`/`include_str!`). Consequences:

- `cargo install nb-cli` alone carries everything needed to register the skill — **no network, no second tool** at install time.
- The skill version is pinned to the binary version, so there's never a skew between `nb` behavior and the skill text describing it.
- `nb skill install` is a pure local file write.

## Command: `nb skill install`

```
nb skill install [--agent <name>...] [--scope user|project] [--yes] [--dry-run]
```

Behavior:

1. **Detect** installed agents from the top-5 table (probe column). With no `--agent`, operate on all detected agents; if none detected, print the skills.sh fallback and exit 0.
2. For each target agent:
   - Write the embedded skill to the agent's skill dir (`--scope`, default `user`).
   - **Idempotently** add/update the instruction block in that agent's instruction file (see below).
   - Print exactly what was written (paths + a one-line summary).
3. `--dry-run` prints the plan without writing. `--yes` skips confirmation on the interactive path.
4. For an agent not in the five, print:
   `Agent "<x>" is not directly supported. Install via: npx skills install jupyter-ai-contrib/nb-cli`

### Idempotent instruction-file editing

Writing to a user's `AGENTS.md`/`CLAUDE.md`/`GEMINI.md` is the one risky operation (they may hand-maintain it). Rules:

- Wrap the injected text in sentinel comments so re-running updates in place instead of duplicating:

  ```markdown
  <!-- BEGIN nb-cli skill (managed by `nb skill install`) -->
  ## Working with Notebooks (.ipynb files)
  When the user asks to read, edit, execute, or work with .ipynb files, use the
  notebook-cli skill, which provides the `nb` command-line tool. Do not use the
  built-in Read/Write tools for `.ipynb` files.
  <!-- END nb-cli skill -->
  ```

- If the sentinels exist, replace the block (handles skill-text updates across versions).
- If the file doesn't exist, create it with just the block.
- On the interactive path, show a diff and confirm before writing (unless `--yes`).
- Never touch content outside the sentinels.

### Companion subcommands

- `nb skill status` — for each detected agent, report whether the skill dir and instruction block are present, and print the exact fix command for any gap. This is the self-diagnosis path for "why isn't my agent using nb?".
- `nb skill uninstall [--agent …]` — remove the skill dir and the sentinel block cleanly.

## Post-install onboarding

Two entry points, because the two install methods have different hooks.

### `curl … install.sh | bash` (has a post-install moment)

After the binary lands and PATH guidance is printed, the script:

1. Detects agents (same probes as the table).
2. For each detected agent, prompts (TTY only):
   `Detected Claude Code. Register the nb skill for it now? [Y/n]`
3. On yes, runs `nb skill install --agent <name> --yes`.
4. In non-interactive contexts (piped, CI, no TTY), **does not prompt**; prints the one-line `nb skill install` hint instead.

This is the "1-click" path for the common case: one curl, answer the prompt(s), done.

### `cargo install nb-cli` (no post-install hook)

Cargo runs no post-install script, so onboarding happens on **first run**:

1. On the first `nb <command>` invocation, if any top-5 agent is detected but has no skill registered, print a single dismissable line to stderr:
   `Tip: run \`nb skill install\` so your agent uses nb for notebooks. (Run \`nb skill install --help\` for options.)`
2. Record a marker (e.g. `~/.nb-cli/state`) so the tip prints at most once.
3. Never block or alter the command's actual output.

## README changes

- Lead the "AI Agent Integration" section with `nb skill install` as the primary path.
- Demote `npx skills install …` and manual copy to "Other agents / manual" — still documented, no longer the headline.
- Document `nb skill status` as the troubleshooting entry point.

## Open questions

1. **Gemini instruction file**: confirm whether current Gemini CLI reads `AGENTS.md` as a fallback or strictly `GEMINI.md`; the writer should target the right file per detected version.
2. **Scope default**: user-scope (`~/.<agent>/`) is the safe default for a globally-installed CLI. Should `nb skill install` auto-detect a project context (an existing `AGENTS.md` in cwd) and offer project scope? Leaning yes, as a prompt, not a default.
3. **First-run tip channel**: stderr vs. a dedicated `nb --version`-style notice. stderr keeps stdout clean for agent parsing; confirm no agent harness treats stderr noise as an error.
4. **Embedded-skill size**: the skill + references is ~30 KB; negligible for a Rust binary, but confirm it doesn't trip any release-size budget.

## Rollout

1. Embed the skill assets + add the top-5 table as data.
2. Implement `nb skill install` / `status` / `uninstall` with idempotent instruction-file editing.
3. Add the `install.sh` prompt and the first-run tip.
4. Update README and the Codex `prefix_rule` note to reference `nb skill install`.
