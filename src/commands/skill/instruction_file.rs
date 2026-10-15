//! Idempotent editing of an agent's instruction file (CLAUDE.md / AGENTS.md /
//! GEMINI.md).
//!
//! The "use nb for .ipynb" guidance is wrapped in sentinel comments so the block
//! can be updated in place across skill-text changes and removed cleanly, without
//! ever disturbing the user's own content around it. This is the one write that
//! touches a file a user may hand-maintain, so it is deliberately conservative:
//! replace only between the sentinels, append only when absent, create only when
//! the file does not exist.

use anyhow::{Context, Result};
use std::fs;
use std::path::Path;

pub const BEGIN: &str = "<!-- BEGIN nb-cli skill (managed by `nb skill install`) -->";
pub const END: &str = "<!-- END nb-cli skill -->";

/// The managed instruction text (without sentinels).
pub const INSTRUCTION_BODY: &str = "\
## Working with Notebooks (.ipynb files)

When the user asks to read, edit, execute, or work with .ipynb files, use the
notebook-cli skill, which provides the `nb` command-line tool. Do not use the
built-in Read/Write tools for `.ipynb` files.";

/// Outcome of planning an instruction-file edit.
#[derive(Debug, PartialEq, Eq)]
pub enum EditPlan {
    /// File does not exist; it will be created with just the managed block.
    Create,
    /// A managed block exists and its content differs; it will be replaced.
    Update,
    /// No managed block; it will be appended to the end.
    Append,
    /// A managed block exists and already matches; nothing to do.
    Unchanged,
}

/// The full managed block, including sentinels and surrounding blank lines.
fn managed_block() -> String {
    format!("{BEGIN}\n{INSTRUCTION_BODY}\n{END}")
}

/// Compute what editing `path` would do, without writing.
pub fn plan(path: &Path) -> Result<EditPlan> {
    if !path.exists() {
        return Ok(EditPlan::Create);
    }
    let existing = fs::read_to_string(path)
        .with_context(|| format!("reading instruction file {}", path.display()))?;
    match extract_block(&existing) {
        Some(current) if current.trim() == managed_block().trim() => Ok(EditPlan::Unchanged),
        Some(_) => Ok(EditPlan::Update),
        None => Ok(EditPlan::Append),
    }
}

/// Apply the edit. Returns the plan that was carried out.
pub fn apply(path: &Path) -> Result<EditPlan> {
    let plan = plan(path)?;
    match plan {
        EditPlan::Unchanged => {}
        EditPlan::Create => {
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent).ok();
            }
            fs::write(path, format!("{}\n", managed_block()))
                .with_context(|| format!("creating {}", path.display()))?;
        }
        EditPlan::Append => {
            let existing = fs::read_to_string(path)?;
            let sep = if existing.ends_with('\n') {
                "\n"
            } else {
                "\n\n"
            };
            let new = format!("{existing}{sep}{}\n", managed_block());
            fs::write(path, new).with_context(|| format!("appending to {}", path.display()))?;
        }
        EditPlan::Update => {
            let existing = fs::read_to_string(path)?;
            let new = replace_block(&existing, &managed_block());
            fs::write(path, new).with_context(|| format!("updating {}", path.display()))?;
        }
    }
    Ok(plan)
}

/// Remove the managed block from `path` if present. Returns true if a block was
/// removed. Leaves all other content untouched.
pub fn remove(path: &Path) -> Result<bool> {
    if !path.exists() {
        return Ok(false);
    }
    let existing = fs::read_to_string(path)?;
    if extract_block(&existing).is_none() {
        return Ok(false);
    }
    let stripped = strip_block(&existing);
    fs::write(path, stripped).with_context(|| format!("removing block from {}", path.display()))?;
    Ok(true)
}

/// The managed block (including sentinels) currently in `content`, if any.
fn extract_block(content: &str) -> Option<String> {
    let start = content.find(BEGIN)?;
    let end_rel = content[start..].find(END)?;
    let end = start + end_rel + END.len();
    Some(content[start..end].to_string())
}

/// Replace the existing managed block with `block`, preserving everything else.
fn replace_block(content: &str, block: &str) -> String {
    let Some(start) = content.find(BEGIN) else {
        return content.to_string();
    };
    let Some(end_rel) = content[start..].find(END) else {
        return content.to_string();
    };
    let end = start + end_rel + END.len();
    format!("{}{}{}", &content[..start], block, &content[end..])
}

/// Remove the managed block and collapse the blank space it leaves behind.
fn strip_block(content: &str) -> String {
    let Some(start) = content.find(BEGIN) else {
        return content.to_string();
    };
    let Some(end_rel) = content[start..].find(END) else {
        return content.to_string();
    };
    let end = start + end_rel + END.len();
    let mut before = content[..start].to_string();
    let mut after = content[end..].to_string();
    // Trim one trailing newline run from `before` and leading from `after` so we
    // don't leave a widening gap on repeated add/remove cycles.
    while before.ends_with('\n') {
        before.pop();
    }
    while after.starts_with('\n') {
        after.remove(0);
    }
    if before.is_empty() {
        after
    } else if after.is_empty() {
        format!("{before}\n")
    } else {
        format!("{before}\n\n{after}")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plan_create_for_missing_file() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join("AGENTS.md");
        assert_eq!(plan(&p).unwrap(), EditPlan::Create);
    }

    #[test]
    fn create_then_unchanged_is_idempotent() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join("AGENTS.md");
        assert_eq!(apply(&p).unwrap(), EditPlan::Create);
        assert_eq!(plan(&p).unwrap(), EditPlan::Unchanged);
        assert_eq!(apply(&p).unwrap(), EditPlan::Unchanged);
    }

    #[test]
    fn append_preserves_user_content() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join("AGENTS.md");
        fs::write(&p, "# My project rules\n\nUse tabs.\n").unwrap();
        assert_eq!(apply(&p).unwrap(), EditPlan::Append);
        let out = fs::read_to_string(&p).unwrap();
        assert!(out.contains("# My project rules"));
        assert!(out.contains("Use tabs."));
        assert!(out.contains(BEGIN) && out.contains(END));
    }

    #[test]
    fn update_replaces_only_the_block() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join("AGENTS.md");
        let stale = format!("# Rules\n\n{BEGIN}\nOLD TEXT\n{END}\n\n# After\n");
        fs::write(&p, stale).unwrap();
        assert_eq!(apply(&p).unwrap(), EditPlan::Update);
        let out = fs::read_to_string(&p).unwrap();
        assert!(out.contains("# Rules"));
        assert!(out.contains("# After"));
        assert!(out.contains("notebook-cli skill"));
        assert!(!out.contains("OLD TEXT"));
    }

    #[test]
    fn remove_leaves_surrounding_content() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join("AGENTS.md");
        fs::write(&p, "# Rules\n\nUse tabs.\n").unwrap();
        apply(&p).unwrap();
        assert!(remove(&p).unwrap());
        let out = fs::read_to_string(&p).unwrap();
        assert!(out.contains("# Rules"));
        assert!(out.contains("Use tabs."));
        assert!(!out.contains(BEGIN));
        // removing again is a no-op
        assert!(!remove(&p).unwrap());
    }
}
