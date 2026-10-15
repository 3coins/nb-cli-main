//! Embedded `notebook-cli` skill assets.
//!
//! The skill directory (`skills/notebook-cli/`) is compiled into the binary so
//! that `nb skill install` works offline with no second tool. Each asset is a
//! (relative path, contents) pair; the relative path is reproduced verbatim
//! under the target agent's skill directory.
//!
//! Keep this list in sync with `skills/notebook-cli/`. A missing file here is a
//! silent gap in the installed skill, so new reference files must be added.

/// A single embedded skill file: its path relative to the skill root, and its
/// contents.
pub struct SkillFile {
    pub rel_path: &'static str,
    pub contents: &'static str,
}

/// Skill root is `<repo>/skills/notebook-cli`; `include_str!` paths are relative
/// to this source file (`src/commands/skill/assets.rs`), hence the `../../../`
/// prefix to reach the repo root.
macro_rules! skill_file {
    ($rel:literal) => {
        SkillFile {
            rel_path: $rel,
            contents: include_str!(concat!("../../../skills/notebook-cli/", $rel)),
        }
    };
}

/// Every file that makes up the installed skill.
pub const SKILL_FILES: &[SkillFile] = &[
    skill_file!("SKILL.md"),
    skill_file!("references/best-practices.md"),
    skill_file!("references/connect-mode.md"),
    skill_file!("references/create.md"),
    skill_file!("references/edit-cells.md"),
    skill_file!("references/execute.md"),
    skill_file!("references/output-format.md"),
    skill_file!("references/read.md"),
    skill_file!("references/validation-prompts.md"),
];

/// The skill directory name used under each agent's skills location.
pub const SKILL_NAME: &str = "notebook-cli";

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn skill_md_is_embedded_and_nonempty() {
        let skill_md = SKILL_FILES
            .iter()
            .find(|f| f.rel_path == "SKILL.md")
            .expect("SKILL.md must be embedded");
        assert!(skill_md.contents.contains("notebook-cli"));
    }

    #[test]
    fn all_assets_nonempty() {
        for f in SKILL_FILES {
            assert!(
                !f.contents.trim().is_empty(),
                "embedded skill file {} is empty",
                f.rel_path
            );
        }
    }
}
