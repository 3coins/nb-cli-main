//! Manages Jupyter server lifecycle for integration tests

use anyhow::{bail, Context, Result};
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

/// Represents a running Jupyter server for testing
pub struct TestJupyterServer {
    /// The server process
    process: Arc<Mutex<Option<Child>>>,
    /// Server URL
    pub url: String,
    /// Authentication token
    pub token: String,
    /// Working directory
    pub working_dir: PathBuf,
    /// Port number
    pub port: u16,
}

/// Configuration for starting a Jupyter server
pub struct ServerConfig {
    /// Working directory for the server
    pub working_dir: PathBuf,
    /// Optional venv PATH to use
    pub venv_path_env: Option<String>,
}

impl TestJupyterServer {
    /// Start a new Jupyter server for testing
    ///
    /// This will:
    /// 1. Find an available port
    /// 2. Start jupyter server with that port
    /// 3. Parse output to extract URL and token
    /// 4. Wait for server to be ready
    pub fn start(working_dir: &Path) -> Result<Self> {
        Self::start_with_config(ServerConfig {
            working_dir: working_dir.to_path_buf(),
            venv_path_env: None,
        })
    }

    /// Start a Jupyter server with custom configuration
    pub fn start_with_config(config: ServerConfig) -> Result<Self> {
        let port = find_available_port()?;
        let token = "test".to_string(); // Static token for testing

        eprintln!("🚀 Starting JupyterLab on port {} (token: {})", port, token);

        // Start jupyter server
        // Use `jupyter lab` for full JupyterLab UI support
        let mut command = Command::new("jupyter");

        // Set PATH if venv is provided
        if let Some(venv_path) = &config.venv_path_env {
            command.env("PATH", venv_path);
        }

        let mut child = command
            .args([
                "lab",
                "--no-browser",
                "--port",
                &port.to_string(),
                &format!("--IdentityProvider.token={}", token), // Use static token
                "--ServerApp.allow_origin='*'",
            ])
            .current_dir(&config.working_dir)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .context("Failed to start jupyter lab. Is jupyterlab installed in the test venv?")?;

        // Jupyter outputs to stderr, not stdout
        let stderr = child
            .stderr
            .take()
            .context("Failed to capture jupyter server stderr")?;

        // Build the base URL
        let url = format!("http://127.0.0.1:{}", port);

        // Wait for server to output ready message
        wait_for_jupyter_url(stderr, port)?;

        // Double-check server is ready by making API request
        wait_for_server_ready(&url, &token)?;

        eprintln!("✅ JupyterLab ready at {}", url);

        Ok(Self {
            process: Arc::new(Mutex::new(Some(child))),
            url,
            token,
            working_dir: config.working_dir,
            port,
        })
    }

    /// Check if server is still running
    pub fn is_running(&self) -> bool {
        if let Ok(mut process) = self.process.lock() {
            if let Some(child) = process.as_mut() {
                return matches!(child.try_wait(), Ok(None));
            }
        }
        false
    }

    /// Stop the server
    pub fn stop(&self) -> Result<()> {
        if let Ok(mut process) = self.process.lock() {
            if let Some(mut child) = process.take() {
                // Try graceful shutdown first
                #[cfg(unix)]
                {
                    // Send SIGTERM
                    unsafe {
                        libc::kill(child.id() as i32, libc::SIGTERM);
                    }
                }

                #[cfg(not(unix))]
                {
                    let _ = child.kill();
                }

                // Wait up to 5 seconds for graceful shutdown
                for _ in 0..50 {
                    match child.try_wait() {
                        Ok(Some(_)) => {
                            return Ok(());
                        }
                        Ok(None) => {
                            thread::sleep(Duration::from_millis(100));
                        }
                        Err(_) => {
                            break;
                        }
                    }
                }

                // Force kill if still running
                let _ = child.kill();
                let _ = child.wait();
            }
        }

        Ok(())
    }
}

impl Drop for TestJupyterServer {
    fn drop(&mut self) {
        // Always try to cleanup, even if stop() fails
        if let Err(e) = self.stop() {
            eprintln!("⚠️  Warning: Failed to stop server cleanly: {}", e);
            // Try force kill as last resort
            if let Ok(mut process) = self.process.lock() {
                if let Some(mut child) = process.take() {
                    let _ = child.kill();
                    let _ = child.wait();
                }
            }
        }
    }
}

/// Find an available port for the test server
fn find_available_port() -> Result<u16> {
    use std::net::TcpListener;

    // Try to bind to port 0, which will assign a random available port
    let listener = TcpListener::bind("127.0.0.1:0")
        .context("Failed to bind to random port")?;

    let port = listener.local_addr()?.port();

    // Close the listener so the port is available for jupyter
    drop(listener);

    Ok(port)
}

/// Wait for Jupyter server to output its ready message
fn wait_for_jupyter_url(stderr: impl std::io::Read + Send + 'static, port: u16) -> Result<()> {
    let reader = BufReader::new(stderr);

    // Spawn a thread to read stderr without blocking
    let (tx, rx) = std::sync::mpsc::channel();

    thread::spawn(move || {
        for line in reader.lines() {
            if let Ok(line) = line {
                // Look for the "is running at:" message which indicates server is ready
                if line.contains("is running at:") || (line.contains("http://") && line.contains(&format!(":{}", port))) {
                    let _ = tx.send(true);
                    // Continue reading to prevent pipe from blocking, but we're done waiting
                    break;
                }
            }
        }
    });

    // Wait up to 30 seconds for server to start
    match rx.recv_timeout(Duration::from_secs(30)) {
        Ok(_) => Ok(()),
        Err(_) => {
            bail!("Timeout waiting for Jupyter server to start");
        }
    }
}

/// Wait for server to be ready by making test requests
fn wait_for_server_ready(url: &str, token: &str) -> Result<()> {
    eprintln!("⏳ Waiting for server to be ready...");

    let client = reqwest::blocking::Client::new();
    let api_url = format!("{}/api", url);

    for attempt in 1..=30 {
        match client
            .get(&api_url)
            .header("Authorization", format!("token {}", token))
            .timeout(Duration::from_secs(2))
            .send()
        {
            Ok(resp) if resp.status().is_success() => {
                eprintln!("✅ Server is ready (attempt {})", attempt);
                return Ok(());
            }
            Ok(resp) => {
                eprintln!("⏳ Server responded with status {} (attempt {})", resp.status(), attempt);
            }
            Err(e) => {
                eprintln!("⏳ Server not ready yet: {} (attempt {})", e, attempt);
            }
        }

        thread::sleep(Duration::from_millis(500));
    }

    bail!("Server did not become ready within timeout period")
}
