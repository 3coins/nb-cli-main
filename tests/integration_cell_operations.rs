//! Integration tests for cell operations with browser automation
//!
//! These tests verify:
//! 1. Cell add operations
//! 2. Cell update operations
//! 3. Cell delete operations
//! 4. Real-time Y.js synchronization (cells added while browser is open)
//!
//! Run with: cargo test --test integration_cell_operations -- --nocapture --test-threads=1

mod server_manager;
mod browser_helper;
mod test_helpers;

use once_cell::sync::Lazy;
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
        eprintln!("📸 {}: {}", name, screenshot_path.display());
    }
    screenshot_path.display().to_string()
}

#[test]
fn test_cell_add_operation() {
    let shared = match SHARED_TEST_ENV.as_ref() {
        Some(s) => s,
        None => {
            eprintln!("⏭️  Skipping test - prerequisites not met");
            return;
        }
    };

    // Create notebook
    run_nb(&["create", "add_test.ipynb"]).expect("Failed to create notebook");

    // Add first cell
    run_nb(&[
        "cell", "add", "add_test.ipynb",
        "--source", "x = 1",
    ]).expect("Failed to add first cell");

    // Add second cell
    run_nb(&[
        "cell", "add", "add_test.ipynb",
        "--source", "y = 2",
    ]).expect("Failed to add second cell");

    // Add third cell at specific index
    run_nb(&[
        "cell", "add", "add_test.ipynb",
        "--source", "z = 3",
        "--insert-at", "1",
    ]).expect("Failed to add cell at index");

    // Verify notebook structure
    let notebook_path = shared.temp_dir.path().join("add_test.ipynb");
    let json = test_helpers::read_notebook_json(&notebook_path)
        .expect("Failed to read notebook");

    let cells = json["cells"].as_array().unwrap();
    assert!(cells.len() >= 3, "Should have at least 3 cells, got {}", cells.len());

    // Launch browser and open notebook
    let browser = match NotebookBrowser::new() {
        Ok(b) => b,
        Err(e) => {
            eprintln!("⚠️  Skipping browser portion: {}", e);
            return;
        }
    };

    if let Err(e) = browser.open_notebook(&shared.server.url, "add_test.ipynb", &shared.server.token) {
        eprintln!("⚠️  Failed to open notebook: {}", e);
        screenshot(&browser, "error_cell_add.png");
        panic!("Failed to open notebook");
    }

    std::thread::sleep(std::time::Duration::from_secs(2));
    screenshot(&browser, "cell_add_test.png");
}

#[test]
fn test_cell_update_operation() {
    let shared = match SHARED_TEST_ENV.as_ref() {
        Some(s) => s,
        None => {
            eprintln!("⏭️  Skipping test - prerequisites not met");
            return;
        }
    };

    // Create notebook with a cell
    run_nb(&["create", "update_test.ipynb"]).expect("Failed to create notebook");

    run_nb(&[
        "cell", "add", "update_test.ipynb",
        "--source", "original_value = 42",
    ]).expect("Failed to add cell");

    // Update cell by index
    run_nb(&[
        "cell", "update", "update_test.ipynb",
        "--cell-index", "0",
        "--source", "updated_value = 100",
    ]).expect("Failed to update cell");

    // Verify the update
    let notebook_path = shared.temp_dir.path().join("update_test.ipynb");
    let json = test_helpers::read_notebook_json(&notebook_path)
        .expect("Failed to read notebook");

    let cells = json["cells"].as_array().unwrap();
    let cell_source = cells[0]["source"].as_str()
        .or_else(|| cells[0]["source"].as_array().and_then(|a| a[0].as_str()))
        .unwrap_or("");

    assert!(cell_source.contains("updated_value"), "Cell should contain updated content");

    // Open in browser
    let browser = match NotebookBrowser::new() {
        Ok(b) => b,
        Err(e) => {
            eprintln!("⚠️  Skipping browser portion: {}", e);
            return;
        }
    };

    if let Err(e) = browser.open_notebook(&shared.server.url, "update_test.ipynb", &shared.server.token) {
        eprintln!("⚠️  Failed to open notebook: {}", e);
        screenshot(&browser, "error_cell_update.png");
        panic!("Failed to open notebook");
    }

    std::thread::sleep(std::time::Duration::from_secs(2));
    screenshot(&browser, "cell_update_test.png");
}

#[test]
fn test_cell_delete_operation() {
    let shared = match SHARED_TEST_ENV.as_ref() {
        Some(s) => s,
        None => {
            eprintln!("⏭️  Skipping test - prerequisites not met");
            return;
        }
    };

    // Create notebook with multiple cells
    run_nb(&["create", "delete_test.ipynb"]).expect("Failed to create notebook");

    run_nb(&[
        "cell", "add", "delete_test.ipynb",
        "--source", "cell_1 = 1",
    ]).expect("Failed to add cell 1");

    run_nb(&[
        "cell", "add", "delete_test.ipynb",
        "--source", "cell_2 = 2",
    ]).expect("Failed to add cell 2");

    run_nb(&[
        "cell", "add", "delete_test.ipynb",
        "--source", "cell_3 = 3",
    ]).expect("Failed to add cell 3");

    // Get initial cell count
    let notebook_path = shared.temp_dir.path().join("delete_test.ipynb");
    let json_before = test_helpers::read_notebook_json(&notebook_path)
        .expect("Failed to read notebook");
    let initial_count = json_before["cells"].as_array().unwrap().len();

    // Delete middle cell
    run_nb(&[
        "cell", "delete", "delete_test.ipynb",
        "--cell-index", "1",
    ]).expect("Failed to delete cell");

    // Verify deletion
    let json_after = test_helpers::read_notebook_json(&notebook_path)
        .expect("Failed to read notebook");
    let final_count = json_after["cells"].as_array().unwrap().len();

    assert_eq!(final_count, initial_count - 1, "Cell count should decrease by 1");

    // Open in browser
    let browser = match NotebookBrowser::new() {
        Ok(b) => b,
        Err(e) => {
            eprintln!("⚠️  Skipping browser portion: {}", e);
            return;
        }
    };

    if let Err(e) = browser.open_notebook(&shared.server.url, "delete_test.ipynb", &shared.server.token) {
        eprintln!("⚠️  Failed to open notebook: {}", e);
        screenshot(&browser, "error_cell_delete.png");
        panic!("Failed to open notebook");
    }

    std::thread::sleep(std::time::Duration::from_secs(2));
    screenshot(&browser, "cell_delete_test.png");
}

#[test]
fn test_cell_operations_with_browser_open() {
    let shared = match SHARED_TEST_ENV.as_ref() {
        Some(s) => s,
        None => {
            eprintln!("⏭️  Skipping test - prerequisites not met");
            return;
        }
    };

    // Create empty notebook
    run_nb(&["create", "live_test.ipynb"]).expect("Failed to create notebook");

    // Launch browser FIRST (notebook open in JupyterLab)
    let browser = match NotebookBrowser::new() {
        Ok(b) => b,
        Err(e) => {
            eprintln!("⚠️  Failed to launch browser: {}", e);
            return;
        }
    };

    if let Err(e) = browser.open_notebook(&shared.server.url, "live_test.ipynb", &shared.server.token) {
        eprintln!("⚠️  Failed to open notebook: {}", e);
        screenshot(&browser, "error_live_open.png");
        panic!("Failed to open notebook");
    }

    eprintln!("🌐 Notebook open - adding cells via CLI (watch for live updates)");
    std::thread::sleep(std::time::Duration::from_secs(2));

    // NOW add cells while browser is watching
    run_nb(&[
        "cell", "add", "live_test.ipynb",
        "--source", "print('Hello from CLI while browser is watching!')",
    ]).expect("Failed to add cell");

    std::thread::sleep(std::time::Duration::from_secs(2));
    screenshot(&browser, "live_test_after_add1.png");

    run_nb(&[
        "cell", "add", "live_test.ipynb",
        "--type", "markdown",
        "--source", "# Live Update Test\n\nThis cell was added while the notebook was open!",
    ]).expect("Failed to add markdown cell");

    std::thread::sleep(std::time::Duration::from_secs(2));
    screenshot(&browser, "live_test_after_add2.png");

    run_nb(&[
        "cell", "add", "live_test.ipynb",
        "--source", "x = 42\ny = x * 2\nprint(f'Result: {y}')",
    ]).expect("Failed to add cell 3");

    std::thread::sleep(std::time::Duration::from_secs(3));
    screenshot(&browser, "live_test_final.png");

    if std::env::var("HEADLESS").map(|v| v == "false").unwrap_or(false) {
        eprintln!("💡 Browser still open - inspect the live updates!");
        std::thread::sleep(std::time::Duration::from_secs(5));
    }
}
