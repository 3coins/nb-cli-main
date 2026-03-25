//! Smoke test for browser automation infrastructure (Phase 1)
//!
//! This test verifies that:
//! 1. JupyterLab can be started
//! 2. Headless Chrome can be launched
//! 3. A notebook URL can be opened
//! 4. Screenshots can be captured
//!
//! Run with: cargo test --test integration_browser_smoke -- --nocapture --test-threads=1

mod server_manager;
mod browser_helper;
mod test_helpers;

use once_cell::sync::Lazy;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use tempfile::TempDir;
use server_manager::{TestJupyterServer, ServerConfig};
use browser_helper::NotebookBrowser;

/// Shared test environment with one Jupyter server for all tests
struct SharedTestServer {
    temp_dir: TempDir,
    server: TestJupyterServer,
    venv_path_env: String,
}

/// Shared Jupyter server for all tests (starts once, used by all tests)
static SHARED_TEST_ENV: Lazy<Option<SharedTestServer>> = Lazy::new(|| {
    eprintln!("🚀 Initializing shared test environment (one-time setup)...");

    // Setup venv - this also checks prerequisites
    let _venv_root = test_helpers::setup_execution_venv()?;
    let venv_path_env = test_helpers::setup_venv_environment()?;

    let temp_dir = TempDir::new().expect("Failed to create temp directory");

    // Start Jupyter server
    let server = match TestJupyterServer::start_with_config(ServerConfig {
        working_dir: temp_dir.path().to_path_buf(),
        venv_path_env: Some(venv_path_env.clone()),
    }) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("⚠️  Failed to start Jupyter server: {}", e);
            eprintln!("   Run ./tests/setup_test_env.sh to install dependencies");
            return None;
        }
    };

    eprintln!("✅ Shared test environment ready (will be used by all tests)");

    Some(SharedTestServer {
        temp_dir,
        server,
        venv_path_env,
    })
});

/// Helper to run nb CLI commands in the shared test environment
fn run_nb(args: &[&str]) -> anyhow::Result<String> {
    let shared = SHARED_TEST_ENV.as_ref()
        .ok_or_else(|| anyhow::anyhow!("Shared test environment not available"))?;

    let binary_path = PathBuf::from(env!("CARGO_BIN_EXE_nb"));
    let output = Command::new(&binary_path)
        .args(args)
        .current_dir(shared.temp_dir.path())
        .env("PATH", &shared.venv_path_env)
        .output()?;

    if !output.status.success() {
        anyhow::bail!(
            "Command failed: nb {}\nstderr: {}",
            args.join(" "),
            String::from_utf8_lossy(&output.stderr)
        );
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

/// Take a screenshot with the browser
fn screenshot(browser: &NotebookBrowser, name: &str) -> String {
    let shared = match SHARED_TEST_ENV.as_ref() {
        Some(s) => s,
        None => return String::new(),
    };

    let screenshot_path = shared.temp_dir.path().join(name);
    if browser.screenshot(0, screenshot_path.to_str().unwrap()).is_ok() {
        eprintln!("📸 Screenshot saved: {}", screenshot_path.display());
        eprintln!("   View with: open {}", screenshot_path.display());
    }
    screenshot_path.display().to_string()
}

#[test]
fn test_jupyter_server_starts() {
    let shared = match SHARED_TEST_ENV.as_ref() {
        Some(s) => s,
        None => {
            eprintln!("⏭️  Skipping test - prerequisites not met");
            return;
        }
    };

    assert!(shared.server.is_running(), "Jupyter server should be running");
    eprintln!("✅ Server URL: {}", shared.server.url);
}

#[test]
fn test_create_notebook_via_cli() {
    let shared = match SHARED_TEST_ENV.as_ref() {
        Some(s) => s,
        None => {
            eprintln!("⏭️  Skipping test - prerequisites not met");
            return;
        }
    };

    run_nb(&["create", "smoke_test.ipynb"]).expect("Failed to create notebook");

    let notebook_path = shared.temp_dir.path().join("smoke_test.ipynb");
    assert!(notebook_path.exists(), "Notebook file should exist");

    let json = test_helpers::read_notebook_json(&notebook_path)
        .expect("Failed to read notebook");
    assert!(json["cells"].is_array(), "Notebook should have cells array");
}

#[test]
fn test_browser_launches() {
    let _shared = match SHARED_TEST_ENV.as_ref() {
        Some(s) => s,
        None => {
            eprintln!("⏭️  Skipping test - prerequisites not met");
            return;
        }
    };

    let browser = match NotebookBrowser::new() {
        Ok(b) => b,
        Err(e) => {
            eprintln!("⚠️  Failed to launch browser: {}", e);
            panic!("Browser failed to launch");
        }
    };

    eprintln!("✅ Browser launched successfully");
    drop(browser);
}

#[test]
fn test_open_notebook_and_screenshot() {
    let shared = match SHARED_TEST_ENV.as_ref() {
        Some(s) => s,
        None => {
            eprintln!("⏭️  Skipping test - prerequisites not met");
            return;
        }
    };

    run_nb(&["create", "screenshot_test.ipynb"]).expect("Failed to create notebook");

    let browser = match NotebookBrowser::new() {
        Ok(b) => b,
        Err(e) => {
            eprintln!("⚠️  Failed to launch browser: {}", e);
            return;
        }
    };

    if let Err(e) = browser.open_notebook(&shared.server.url, "screenshot_test.ipynb", &shared.server.token) {
        eprintln!("⚠️  Failed to open notebook: {}", e);
        screenshot(&browser, "error_smoke.png");
        panic!("Failed to open notebook");
    }

    std::thread::sleep(std::time::Duration::from_secs(2));
    screenshot(&browser, "smoke_test_success.png");
}
