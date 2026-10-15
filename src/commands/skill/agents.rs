//! Supported-agent registry for `nb skill install`.
//!
//! This is the curated top-5. Anything outside this list is delegated to
//! skills.sh (`npx skills install jupyter-ai-contrib/nb-cli`) rather than
//! reimplementing its ~79-agent location matrix. Keeping the blast radius to
//! five entries means a layout change in one agent is a small patch here, not a
//! silent break across a large matrix.
//!
//! The locations below MIRROR skills.sh's own definitions
//! (`vercel-labs/skills` `src/agents.ts`) for these five keys, rather than being
//! guessed from each agent's docs. The relevant conventions reproduced here:
//!
//! * The shared `.agents/skills` directory that Codex, OpenCode and Gemini CLI
//!   read natively — skills.sh installs those agents there, not into a
//!   per-agent named dir.
//! * XDG base-dir resolution for OpenCode (its global skills live under
//!   `$XDG_CONFIG_HOME` / `~/.config`, not `~/.opencode`).
//! * Config-home environment overrides (`$CODEX_HOME`, `$CLAUDE_CONFIG_DIR`).
//! * Detection keyed on config-dir existence, matching skills.sh's
//!   `detectInstalled` probes.
//!
//! When skills.sh changes a path, this table is what you diff against — the keys
//! here use skills.sh's own agent keys (`claude-code`, `kiro-cli`, …) as the
//! source of truth, exposed under short aliases for the `--agent` flag.

use std::path::{Path, PathBuf};

/// Where to place the skill, relative to a base directory.
#[derive(Clone, Copy)]
pub enum Scope {
    /// User-global (e.g. `~/.claude/skills/`). Default for a globally-installed CLI.
    User,
    /// Project-local (e.g. `./.agents/skills/`), resolved from the current dir.
    Project,
}

/// How skills.sh resolves an agent's skill directories and detects it. Each
/// closure-free field maps 1:1 to a field of skills.sh's `AgentConfig` so the
/// two can be diffed by eye.
pub struct Agent {
    /// Short, stable key used with `--agent` and in output (e.g. "codex").
    pub key: &'static str,
    /// skills.sh's own agent key, for cross-referencing its source
    /// (e.g. "codex", "claude-code", "kiro-cli", "gemini-cli").
    pub skills_sh_key: &'static str,
    /// Human-facing name (matches skills.sh `displayName`).
    pub display: &'static str,
    /// Project-scope skills dir relative to cwd (skills.sh `skillsDir`), e.g.
    /// ".agents/skills" or ".claude/skills". The skill lands in
    /// `<cwd>/<skills_dir>/<SKILL_NAME>/`.
    pub skills_dir: &'static str,
    /// How the user-global skills dir is resolved (skills.sh `globalSkillsDir`).
    pub global: GlobalDir,
    /// How skills.sh detects the agent as installed (its `detectInstalled`).
    pub detect: Detect,
    /// Instruction file this agent reads, relative to its scope base. The
    /// "use nb for .ipynb" block is written here. Order matters: first is
    /// preferred, rest are fallbacks that are updated only if already present.
    pub instruction_files: &'static [&'static str],
}

/// Resolution strategy for the user-global skills directory, mirroring the
/// expressions skills.sh uses for each agent's `globalSkillsDir`.
#[derive(Clone, Copy)]
pub enum GlobalDir {
    /// `<$ENV or ~/.<default>>/skills` — a config home overridable by an env var
    /// (e.g. Codex `$CODEX_HOME || ~/.codex`, Claude `$CLAUDE_CONFIG_DIR || ~/.claude`).
    /// Note: skills.sh resolves some of these to a SHARED dir, so this is only
    /// used when the shared variants below do not apply.
    HomeSubdir {
        env: &'static str,
        default_subdir: &'static str,
    },
    /// `~/.agents/skills` — the shared universal location (skills.sh resolves
    /// Codex's and others' global skills here).
    SharedAgents,
    /// `<$XDG_CONFIG_HOME or ~/.config>/<subdir>/skills` — XDG-based resolution
    /// (OpenCode's global skills).
    XdgConfig { subdir: &'static str },
    /// A plain `~/.<subdir>/skills` with no env override (Kiro, Gemini).
    PlainHomeSubdir { subdir: &'static str },
}

/// Detection probe, mirroring skills.sh's `detectInstalled` for each agent.
#[derive(Clone, Copy)]
pub enum Detect {
    /// A config dir under `$HOME` exists, optionally overridden by an env var,
    /// optionally also matching a second absolute path (Codex also checks
    /// `/etc/codex`).
    ConfigDir {
        env: Option<&'static str>,
        subdir: &'static str,
        also_abs: Option<&'static str>,
    },
    /// A dir under `$XDG_CONFIG_HOME` / `~/.config` exists (OpenCode checks
    /// `$XDG_CONFIG_HOME/opencode`).
    XdgConfigDir { subdir: &'static str },
}

/// `$XDG_CONFIG_HOME`, falling back to `~/.config`, matching skills.sh's
/// `xdgConfig ?? join(home, '.config')`.
fn xdg_config_home(home: &Path) -> PathBuf {
    match std::env::var_os("XDG_CONFIG_HOME") {
        Some(v) if !v.is_empty() => PathBuf::from(v),
        _ => home.join(".config"),
    }
}

/// A trimmed, non-empty environment variable value.
fn trimmed_env(name: &str) -> Option<String> {
    std::env::var(name)
        .ok()
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
}

/// The curated top 5. CLI-native agents where `nb`'s shell-first design fits.
/// Values mirror skills.sh `src/agents.ts` for the referenced keys.
pub const AGENTS: &[Agent] = &[
    // skills.sh: 'claude-code' — skillsDir ".claude/skills",
    // globalSkillsDir join($CLAUDE_CONFIG_DIR || ~/.claude, "skills"),
    // detect existsSync($CLAUDE_CONFIG_DIR || ~/.claude).
    Agent {
        key: "claude",
        skills_sh_key: "claude-code",
        display: "Claude Code",
        skills_dir: ".claude/skills",
        global: GlobalDir::HomeSubdir {
            env: "CLAUDE_CONFIG_DIR",
            default_subdir: ".claude",
        },
        detect: Detect::ConfigDir {
            env: Some("CLAUDE_CONFIG_DIR"),
            subdir: ".claude",
            also_abs: None,
        },
        instruction_files: &["CLAUDE.md", "AGENTS.md"],
    },
    // skills.sh: 'codex' — skillsDir ".agents/skills",
    // globalSkillsDir join(home, ".agents", "skills"),
    // detect existsSync($CODEX_HOME || ~/.codex) || existsSync("/etc/codex").
    Agent {
        key: "codex",
        skills_sh_key: "codex",
        display: "Codex",
        skills_dir: ".agents/skills",
        global: GlobalDir::SharedAgents,
        detect: Detect::ConfigDir {
            env: Some("CODEX_HOME"),
            subdir: ".codex",
            also_abs: Some("/etc/codex"),
        },
        instruction_files: &["AGENTS.md"],
    },
    // skills.sh: 'kiro-cli' — skillsDir ".kiro/skills",
    // globalSkillsDir join(home, ".kiro/skills"),
    // detect existsSync(~/.kiro).
    Agent {
        key: "kiro",
        skills_sh_key: "kiro-cli",
        display: "Kiro CLI",
        skills_dir: ".kiro/skills",
        global: GlobalDir::PlainHomeSubdir { subdir: ".kiro" },
        detect: Detect::ConfigDir {
            env: None,
            subdir: ".kiro",
            also_abs: None,
        },
        instruction_files: &["AGENTS.md"],
    },
    // skills.sh: 'opencode' — skillsDir ".agents/skills",
    // globalSkillsDir join($XDG_CONFIG_HOME || ~/.config, "opencode/skills"),
    // detect existsSync($XDG_CONFIG_HOME || ~/.config, "opencode").
    Agent {
        key: "opencode",
        skills_sh_key: "opencode",
        display: "OpenCode",
        skills_dir: ".agents/skills",
        global: GlobalDir::XdgConfig { subdir: "opencode" },
        detect: Detect::XdgConfigDir { subdir: "opencode" },
        instruction_files: &["AGENTS.md"],
    },
    // skills.sh: 'gemini-cli' — skillsDir ".agents/skills",
    // globalSkillsDir join(home, ".gemini/skills"),
    // detect existsSync(~/.gemini).
    Agent {
        key: "gemini",
        skills_sh_key: "gemini-cli",
        display: "Gemini CLI",
        skills_dir: ".agents/skills",
        global: GlobalDir::PlainHomeSubdir { subdir: ".gemini" },
        detect: Detect::ConfigDir {
            env: None,
            subdir: ".gemini",
            also_abs: None,
        },
        instruction_files: &["GEMINI.md", "AGENTS.md"],
    },
];

/// Look up an agent by its `--agent` key (short key or skills.sh key).
pub fn by_key(key: &str) -> Option<&'static Agent> {
    AGENTS
        .iter()
        .find(|a| a.key.eq_ignore_ascii_case(key) || a.skills_sh_key.eq_ignore_ascii_case(key))
}

impl Agent {
    /// True if this agent appears installed, matching skills.sh `detectInstalled`.
    pub fn is_detected(&self, home: &Path) -> bool {
        match self.detect {
            Detect::ConfigDir {
                env,
                subdir,
                also_abs,
            } => {
                let primary = env
                    .and_then(trimmed_env)
                    .map(PathBuf::from)
                    .unwrap_or_else(|| home.join(subdir));
                if primary.is_dir() {
                    return true;
                }
                also_abs.is_some_and(|p| Path::new(p).is_dir())
            }
            Detect::XdgConfigDir { subdir } => xdg_config_home(home).join(subdir).is_dir(),
        }
    }

    /// The parent directory that holds skill subdirs for the given scope,
    /// matching skills.sh `skillsDir` (project) / `globalSkillsDir` (user).
    /// The skill itself lands in `<this>/<SKILL_NAME>/`.
    fn skills_root(&self, scope: Scope, home: &Path, cwd: &Path) -> PathBuf {
        match scope {
            Scope::Project => cwd.join(self.skills_dir),
            Scope::User => match self.global {
                GlobalDir::HomeSubdir {
                    env,
                    default_subdir,
                } => {
                    let base = trimmed_env(env)
                        .map(PathBuf::from)
                        .unwrap_or_else(|| home.join(default_subdir));
                    base.join("skills")
                }
                GlobalDir::SharedAgents => home.join(".agents").join("skills"),
                GlobalDir::XdgConfig { subdir } => {
                    xdg_config_home(home).join(subdir).join("skills")
                }
                GlobalDir::PlainHomeSubdir { subdir } => home.join(subdir).join("skills"),
            },
        }
    }

    /// Directory the skill is written to for the given scope:
    /// `<skills_root>/<SKILL_NAME>/`.
    pub fn skill_dir(&self, scope: Scope, home: &Path, cwd: &Path) -> PathBuf {
        self.skills_root(scope, home, cwd)
            .join(super::assets::SKILL_NAME)
    }

    /// Base directory the instruction file lives in for the given scope.
    ///
    /// * Project scope: the current working directory.
    /// * User scope: the agent's config home (so Claude's `CLAUDE.md` lands in
    ///   `$CLAUDE_CONFIG_DIR || ~/.claude`, Gemini's `GEMINI.md` in `~/.gemini`,
    ///   etc.). Agents whose skills live in the shared `.agents` tree still read
    ///   their instruction file from their own config home, so this is derived
    ///   from the detection/config dir, not from `skills_dir`.
    pub fn instruction_base(&self, scope: Scope, home: &Path, cwd: &Path) -> PathBuf {
        match scope {
            Scope::Project => cwd.to_path_buf(),
            Scope::User => self.config_home(home),
        }
    }

    /// The agent's user-scope config home (e.g. `~/.claude`, `~/.codex`,
    /// `~/.config/opencode`), honoring the same env/XDG overrides skills.sh uses.
    fn config_home(&self, home: &Path) -> PathBuf {
        match self.detect {
            Detect::ConfigDir { env, subdir, .. } => env
                .and_then(trimmed_env)
                .map(PathBuf::from)
                .unwrap_or_else(|| home.join(subdir)),
            Detect::XdgConfigDir { subdir } => xdg_config_home(home).join(subdir),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const HOME: &str = "/home/u";
    const CWD: &str = "/proj";

    fn home() -> &'static Path {
        Path::new(HOME)
    }
    fn cwd() -> &'static Path {
        Path::new(CWD)
    }

    #[test]
    fn five_agents_registered() {
        assert_eq!(AGENTS.len(), 5);
    }

    #[test]
    fn keys_are_unique_and_lookupable() {
        for a in AGENTS {
            assert!(by_key(a.key).is_some());
            assert!(
                by_key(&a.key.to_uppercase()).is_some(),
                "lookup is case-insensitive"
            );
            // skills.sh key also resolves
            assert!(by_key(a.skills_sh_key).is_some());
        }
    }

    #[test]
    fn claude_user_skill_dir_matches_skills_sh() {
        // globalSkillsDir join(~/.claude, "skills") -> + SKILL_NAME
        let claude = by_key("claude").unwrap();
        assert_eq!(
            claude.skill_dir(Scope::User, home(), cwd()),
            PathBuf::from("/home/u/.claude/skills/notebook-cli")
        );
    }

    #[test]
    fn codex_user_skill_dir_is_shared_agents_not_dot_codex() {
        // skills.sh: globalSkillsDir join(home, ".agents", "skills").
        let codex = by_key("codex").unwrap();
        assert_eq!(
            codex.skill_dir(Scope::User, home(), cwd()),
            PathBuf::from("/home/u/.agents/skills/notebook-cli")
        );
    }

    #[test]
    fn codex_project_skill_dir_is_dot_agents() {
        // skills.sh: skillsDir ".agents/skills".
        let codex = by_key("codex").unwrap();
        assert_eq!(
            codex.skill_dir(Scope::Project, home(), cwd()),
            PathBuf::from("/proj/.agents/skills/notebook-cli")
        );
    }

    #[test]
    fn kiro_user_skill_dir_matches_skills_sh() {
        let kiro = by_key("kiro").unwrap();
        assert_eq!(
            kiro.skill_dir(Scope::User, home(), cwd()),
            PathBuf::from("/home/u/.kiro/skills/notebook-cli")
        );
    }

    #[test]
    fn gemini_user_skill_dir_matches_skills_sh() {
        // globalSkillsDir join(home, ".gemini/skills").
        let gemini = by_key("gemini").unwrap();
        assert_eq!(
            gemini.skill_dir(Scope::User, home(), cwd()),
            PathBuf::from("/home/u/.gemini/skills/notebook-cli")
        );
    }

    #[test]
    fn gemini_project_skill_dir_is_dot_agents() {
        let gemini = by_key("gemini").unwrap();
        assert_eq!(
            gemini.skill_dir(Scope::Project, home(), cwd()),
            PathBuf::from("/proj/.agents/skills/notebook-cli")
        );
    }

    #[test]
    fn opencode_user_skill_dir_is_xdg_config_default() {
        // No XDG_CONFIG_HOME set in this test env -> ~/.config/opencode/skills.
        // Guard: only assert when the ambient env doesn't set XDG_CONFIG_HOME.
        if std::env::var_os("XDG_CONFIG_HOME").is_none() {
            let oc = by_key("opencode").unwrap();
            assert_eq!(
                oc.skill_dir(Scope::User, home(), cwd()),
                PathBuf::from("/home/u/.config/opencode/skills/notebook-cli")
            );
        }
    }

    #[test]
    fn opencode_project_skill_dir_is_dot_agents() {
        let oc = by_key("opencode").unwrap();
        assert_eq!(
            oc.skill_dir(Scope::Project, home(), cwd()),
            PathBuf::from("/proj/.agents/skills/notebook-cli")
        );
    }

    #[test]
    fn claude_instruction_base_is_config_home() {
        if std::env::var_os("CLAUDE_CONFIG_DIR").is_none() {
            let claude = by_key("claude").unwrap();
            assert_eq!(
                claude.instruction_base(Scope::User, home(), cwd()),
                PathBuf::from("/home/u/.claude")
            );
        }
    }

    #[test]
    fn opencode_instruction_base_is_xdg_config_home() {
        if std::env::var_os("XDG_CONFIG_HOME").is_none() {
            let oc = by_key("opencode").unwrap();
            assert_eq!(
                oc.instruction_base(Scope::User, home(), cwd()),
                PathBuf::from("/home/u/.config/opencode")
            );
        }
    }

    #[test]
    fn project_instruction_base_is_cwd() {
        for a in AGENTS {
            assert_eq!(a.instruction_base(Scope::Project, home(), cwd()), cwd());
        }
    }
}
