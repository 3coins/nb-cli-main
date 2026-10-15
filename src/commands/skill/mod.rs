//! `nb skill` — install the notebook-cli skill into supported AI agents.
//!
//! Curated top-5 support (Claude Code, Codex, Kiro, OpenCode, Gemini CLI).
//! Anything else is delegated to skills.sh so we never own the long-tail
//! location matrix.

pub mod agents;
pub mod assets;
pub mod instruction_file;

use agents::{Agent, Scope};
use anyhow::{Context, Result};
use clap::{Args, Subcommand};
use std::fs;
use std::path::{Path, PathBuf};

const SKILLS_SH_FALLBACK: &str = "npx skills install jupyter-ai-contrib/nb-cli";

#[derive(Subcommand)]
pub enum SkillCommands {
    /// Install the notebook-cli skill into detected (or named) agents
    Install(InstallArgs),
    /// Show which agents are detected and whether the skill is installed
    Status(StatusArgs),
    /// Remove the notebook-cli skill from detected (or named) agents
    Uninstall(UninstallArgs),
}

#[derive(Args)]
pub struct InstallArgs {
    /// Target specific agent(s) by key (claude, codex, kiro, opencode, gemini).
    /// Repeatable. Defaults to all detected agents.
    #[arg(long = "agent", value_name = "AGENT")]
    agents: Vec<String>,
    /// Install into project scope (./.<agent>/) instead of user scope (~/.<agent>/).
    #[arg(long)]
    project: bool,
    /// Apply without the confirmation prompt.
    #[arg(long, short = 'y')]
    yes: bool,
    /// Print what would be written without writing anything.
    #[arg(long)]
    dry_run: bool,
}

#[derive(Args)]
pub struct StatusArgs {
    /// Check project scope instead of user scope.
    #[arg(long)]
    project: bool,
}

#[derive(Args)]
pub struct UninstallArgs {
    /// Target specific agent(s) by key. Defaults to all detected agents.
    #[arg(long = "agent", value_name = "AGENT")]
    agents: Vec<String>,
    /// Uninstall from project scope.
    #[arg(long)]
    project: bool,
    /// Apply without the confirmation prompt.
    #[arg(long, short = 'y')]
    yes: bool,
}

pub fn execute(command: SkillCommands) -> Result<()> {
    match command {
        SkillCommands::Install(args) => install(args),
        SkillCommands::Status(args) => status(args),
        SkillCommands::Uninstall(args) => uninstall(args),
    }
}

/// Resolve the agents to operate on from `--agent` flags, or detect them.
/// Unknown keys produce the skills.sh fallback hint and are skipped.
fn resolve_targets(requested: &[String], home: &Path) -> Vec<&'static Agent> {
    if requested.is_empty() {
        return agents::AGENTS
            .iter()
            .filter(|a| a.is_detected(home))
            .collect();
    }
    let mut out = Vec::new();
    for key in requested {
        match agents::by_key(key) {
            Some(a) => out.push(a),
            None => {
                eprintln!(
                    "Agent \"{key}\" is not directly supported.\n  Install it via skills.sh: {SKILLS_SH_FALLBACK}"
                );
            }
        }
    }
    out
}

fn home_dir() -> Result<PathBuf> {
    dirs::home_dir().context("could not determine home directory")
}

fn scope_of(project: bool) -> Scope {
    if project {
        Scope::Project
    } else {
        Scope::User
    }
}

fn install(args: InstallArgs) -> Result<()> {
    let home = home_dir()?;
    let cwd = std::env::current_dir().context("could not determine current directory")?;
    let scope = scope_of(args.project);

    let targets = resolve_targets(&args.agents, &home);
    if targets.is_empty() {
        println!("No supported agents detected.");
        println!("  To install anyway, name one: nb skill install --agent claude");
        println!("  For other agents, use skills.sh: {SKILLS_SH_FALLBACK}");
        return Ok(());
    }

    // Build and show the plan first.
    println!(
        "Installing the notebook-cli skill ({} scope):\n",
        if args.project { "project" } else { "user" }
    );
    for agent in &targets {
        let skill_dir = agent.skill_dir(scope, &home, &cwd);
        let instr = instruction_target(agent, scope, &home, &cwd);
        let instr_plan = instruction_file::plan(&instr)?;
        println!("  {} ({})", agent.display, agent.key);
        println!("    skill:       {}", skill_dir.display());
        println!(
            "    instruction: {} [{}]",
            instr.display(),
            describe_plan(&instr_plan)
        );
    }
    println!();

    if args.dry_run {
        println!("Dry run — nothing was written.");
        return Ok(());
    }

    if !args.yes && !confirm("Proceed?")? {
        println!("Aborted.");
        return Ok(());
    }

    for agent in &targets {
        let skill_dir = agent.skill_dir(scope, &home, &cwd);
        write_skill(&skill_dir).with_context(|| format!("writing skill for {}", agent.display))?;
        let instr = instruction_target(agent, scope, &home, &cwd);
        let plan = instruction_file::apply(&instr)?;
        println!(
            "✅ {}: skill -> {} | instruction {} -> {}",
            agent.display,
            skill_dir.display(),
            instr.display(),
            describe_plan(&plan)
        );
    }
    println!("\nDone. Restart your agent session if it was already running.");
    Ok(())
}

fn status(args: StatusArgs) -> Result<()> {
    let home = home_dir()?;
    let cwd = std::env::current_dir()?;
    let scope = scope_of(args.project);

    println!(
        "notebook-cli skill status ({} scope):\n",
        if args.project { "project" } else { "user" }
    );
    let mut any_detected = false;
    for agent in agents::AGENTS {
        let detected = agent.is_detected(&home);
        if detected {
            any_detected = true;
        }
        let skill_dir = agent.skill_dir(scope, &home, &cwd);
        let skill_present = skill_dir.join("SKILL.md").is_file();
        let instr = instruction_target(agent, scope, &home, &cwd);
        let instr_present = matches!(
            instruction_file::plan(&instr),
            Ok(instruction_file::EditPlan::Unchanged)
        );

        let mark = |b: bool| if b { "✓" } else { "✗" };
        println!(
            "  {:<12} detected:{} skill:{} instruction:{}",
            agent.display,
            mark(detected),
            mark(skill_present),
            mark(instr_present)
        );
        if detected && (!skill_present || !instr_present) {
            println!("      fix: nb skill install --agent {}", agent.key);
        }
    }
    if !any_detected {
        println!("\nNo supported agents detected. For other agents: {SKILLS_SH_FALLBACK}");
    }
    Ok(())
}

fn uninstall(args: UninstallArgs) -> Result<()> {
    let home = home_dir()?;
    let cwd = std::env::current_dir()?;
    let scope = scope_of(args.project);

    let targets = resolve_targets(&args.agents, &home);
    if targets.is_empty() {
        println!("No supported agents detected.");
        return Ok(());
    }

    if !args.yes && !confirm("Remove the notebook-cli skill from these agents?")? {
        println!("Aborted.");
        return Ok(());
    }

    for agent in &targets {
        let skill_dir = agent.skill_dir(scope, &home, &cwd);
        if skill_dir.is_dir() {
            fs::remove_dir_all(&skill_dir)
                .with_context(|| format!("removing {}", skill_dir.display()))?;
        }
        let instr = instruction_target(agent, scope, &home, &cwd);
        let removed = instruction_file::remove(&instr)?;
        println!(
            "✅ {}: removed skill dir{}",
            agent.display,
            if removed { " + instruction block" } else { "" }
        );
    }
    Ok(())
}

/// The instruction file to edit for an agent: the first candidate that already
/// exists, else the preferred (first) one.
fn instruction_target(agent: &Agent, scope: Scope, home: &Path, cwd: &Path) -> PathBuf {
    let base = agent.instruction_base(scope, home, cwd);
    for name in agent.instruction_files {
        let candidate = base.join(name);
        if candidate.exists() {
            return candidate;
        }
    }
    base.join(agent.instruction_files[0])
}

/// Write every embedded skill asset under `skill_dir`.
fn write_skill(skill_dir: &Path) -> Result<()> {
    for file in assets::SKILL_FILES {
        let dest = skill_dir.join(file.rel_path);
        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent).with_context(|| format!("creating {}", parent.display()))?;
        }
        fs::write(&dest, file.contents).with_context(|| format!("writing {}", dest.display()))?;
    }
    Ok(())
}

fn describe_plan(plan: &instruction_file::EditPlan) -> &'static str {
    use instruction_file::EditPlan::*;
    match plan {
        Create => "create",
        Update => "update",
        Append => "append",
        Unchanged => "up to date",
    }
}

fn confirm(prompt: &str) -> Result<bool> {
    use dialoguer::Confirm;
    Ok(Confirm::new()
        .with_prompt(prompt)
        .default(true)
        .interact()?)
}
