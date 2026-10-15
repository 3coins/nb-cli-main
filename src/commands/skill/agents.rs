//! Supported-agent registry for `nb skill install`.
//!
//! This is the curated top-5. Anything outside this list is delegated to
//! skills.sh (`npx skills install jupyter-ai-contrib/nb-cli`) rather than
//! reimplementing its ~79-agent location matrix. Keeping the blast radius to
//! five entries means a layout change in one agent is a small patch here, not a
//! silent break across a large matrix.

use std::path::PathBuf;

/// Where to place the skill, relative to a base directory.
#[derive(Clone, Copy)]
pub enum Scope {
    /// User-global (e.g. `~/.claude/skills/`). Default for a globally-installed CLI.
    User,
    /// Project-local (e.g. `./.claude/skills/`), resolved from the current dir.
    Project,
}

/// A directly-supported agent.
pub struct Agent {
    /// Stable key used with `--agent` and in output.
    pub key: &'static str,
    /// Human-facing name.
    pub display: &'static str,
    /// Executable name probed on `PATH` for detection.
    pub bin: &'static str,
    /// User-scope config dir under `$HOME` (e.g. ".claude"). The skill goes in
    /// `<home>/<user_dir>/skills/<SKILL_NAME>/`.
    pub user_dir: &'static str,
    /// Project-scope config dir relative to cwd (e.g. ".claude"), or None when
    /// the agent discovers project skills from `./skills/` directly.
    pub project_dir: Option<&'static str>,
    /// Instruction file this agent reads, relative to its scope base. The
    /// "use nb for .ipynb" block is written here. Order matters: first is
    /// preferred, rest are fallbacks that are updated only if already present.
    pub instruction_files: &'static [&'static str],
}

/// The curated top 5. CLI-native agents where `nb`'s shell-first design fits.
pub const AGENTS: &[Agent] = &[
    Agent {
        key: "claude",
        display: "Claude Code",
        bin: "claude",
        user_dir: ".claude",
        project_dir: Some(".claude"),
        instruction_files: &["CLAUDE.md", "AGENTS.md"],
    },
    Agent {
        key: "codex",
        display: "Codex",
        bin: "codex",
        user_dir: ".codex",
        project_dir: Some(".codex"),
        instruction_files: &["AGENTS.md"],
    },
    Agent {
        key: "kiro",
        display: "Kiro",
        bin: "kiro",
        user_dir: ".kiro",
        project_dir: Some(".kiro"),
        instruction_files: &["AGENTS.md"],
    },
    Agent {
        key: "opencode",
        display: "OpenCode",
        bin: "opencode",
        user_dir: ".opencode",
        project_dir: None, // discovers project skills from ./skills/
        instruction_files: &["AGENTS.md"],
    },
    Agent {
        key: "gemini",
        display: "Gemini CLI",
        bin: "gemini",
        user_dir: ".gemini",
        project_dir: Some(".gemini"),
        instruction_files: &["GEMINI.md", "AGENTS.md"],
    },
];

/// Look up an agent by its `--agent` key.
pub fn by_key(key: &str) -> Option<&'static Agent> {
    AGENTS.iter().find(|a| a.key.eq_ignore_ascii_case(key))
}

impl Agent {
    /// True if this agent appears installed: its user config dir exists, or its
    /// binary is on `PATH`.
    pub fn is_detected(&self, home: &std::path::Path) -> bool {
        if home.join(self.user_dir).is_dir() {
            return true;
        }
        bin_on_path(self.bin)
    }

    /// Directory the skill is written to for the given scope.
    ///
    /// - `User`: `<home>/<user_dir>/skills/<SKILL_NAME>/`
    /// - `Project`: `<cwd>/<project_dir>/skills/<SKILL_NAME>/`, or
    ///   `<cwd>/skills/<SKILL_NAME>/` when the agent has no project config dir.
    pub fn skill_dir(
        &self,
        scope: Scope,
        home: &std::path::Path,
        cwd: &std::path::Path,
    ) -> PathBuf {
        let skill_name = super::assets::SKILL_NAME;
        match scope {
            Scope::User => home.join(self.user_dir).join("skills").join(skill_name),
            Scope::Project => match self.project_dir {
                Some(dir) => cwd.join(dir).join("skills").join(skill_name),
                None => cwd.join("skills").join(skill_name),
            },
        }
    }

    /// Base directory the instruction file lives in for the given scope.
    pub fn instruction_base(
        &self,
        scope: Scope,
        home: &std::path::Path,
        cwd: &std::path::Path,
    ) -> PathBuf {
        match scope {
            Scope::User => home.join(self.user_dir),
            Scope::Project => cwd.to_path_buf(),
        }
    }
}

/// Whether an executable is found on `PATH`.
fn bin_on_path(bin: &str) -> bool {
    let Some(paths) = std::env::var_os("PATH") else {
        return false;
    };
    std::env::split_paths(&paths).any(|dir| {
        let candidate = dir.join(bin);
        candidate.is_file() || {
            #[cfg(windows)]
            {
                dir.join(format!("{bin}.exe")).is_file()
            }
            #[cfg(not(windows))]
            {
                false
            }
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

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
        }
    }

    #[test]
    fn user_skill_dir_shape() {
        let home = std::path::Path::new("/home/u");
        let cwd = std::path::Path::new("/proj");
        let claude = by_key("claude").unwrap();
        assert_eq!(
            claude.skill_dir(Scope::User, home, cwd),
            PathBuf::from("/home/u/.claude/skills/notebook-cli")
        );
    }

    #[test]
    fn opencode_project_dir_falls_back_to_bare_skills() {
        let home = std::path::Path::new("/home/u");
        let cwd = std::path::Path::new("/proj");
        let oc = by_key("opencode").unwrap();
        assert_eq!(
            oc.skill_dir(Scope::Project, home, cwd),
            PathBuf::from("/proj/skills/notebook-cli")
        );
    }
}
