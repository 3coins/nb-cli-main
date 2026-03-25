//! Browser automation helper for testing notebook collaboration
//!
//! Uses headless_chrome for pure Rust browser automation without Node.js dependencies.

use anyhow::{Context, Result};
use headless_chrome::{Browser, LaunchOptions};
use std::time::Duration;

/// Manages a headless Chrome instance for notebook testing
pub struct NotebookBrowser {
    browser: Browser,
    /// Index of the tab used for notebook (created when opening notebook)
    notebook_tab_index: std::sync::Mutex<Option<usize>>,
}

impl NotebookBrowser {
    /// Launch headless Chrome
    ///
    /// This will automatically download Chromium if not found on the system.
    /// To use system Chrome/Chromium, ensure it's installed and in PATH.
    ///
    /// **Non-headless mode**: Set environment variable `HEADLESS=false` to run with visible browser.
    /// This is useful for debugging and watching tests run in real-time.
    ///
    /// Example: `HEADLESS=false cargo test --test integration_browser_smoke test_create_and_open_notebook -- --nocapture`
    pub fn new() -> Result<Self> {
        // Check if non-headless mode is requested via environment variable
        let headless = std::env::var("HEADLESS")
            .map(|v| v != "false" && v != "0")
            .unwrap_or(true);

        if !headless {
            eprintln!("🌐 Launching Chrome (visible window - HEADLESS=false)");
        }

        // Try to find Chrome in common macOS location
        let chrome_path = std::path::Path::new("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");

        // Build launch options with Chrome path if it exists
        // Use 720p window size (1280x720) for better JupyterLab visibility without huge screenshots
        let options = if chrome_path.exists() {
            LaunchOptions::default_builder()
                .headless(headless)
                .path(Some(chrome_path.to_path_buf()))
                .window_size(Some((1280, 720)))
                .build()
                .context("Failed to build launch options")?
        } else {
            LaunchOptions::default_builder()
                .headless(headless)
                .window_size(Some((1280, 720)))
                .build()
                .context("Failed to build launch options")?
        };

        let browser = Browser::new(options)
            .context("Failed to launch Chrome. Ensure Chrome/Chromium is installed.")?;

        Ok(Self {
            browser,
            notebook_tab_index: std::sync::Mutex::new(None),
        })
    }

    /// Open notebook at URL: {base_url}/lab/tree/{path}?token={token}
    ///
    /// This activates the Y.js collaboration for that notebook.
    /// The notebook must exist on the server before opening.
    pub fn open_notebook(&self, base_url: &str, notebook_path: &str, token: &str) -> Result<()> {
        let url = format!("{}/lab/tree/{}?token={}", base_url, notebook_path, token);

        // Wait a moment for browser to initialize
        std::thread::sleep(Duration::from_millis(500));

        // Get or create a tab for the notebook
        let tab = {
            let tabs = self.browser.get_tabs().lock().unwrap();
            if tabs.is_empty() {
                drop(tabs);
                // No tabs exist, create a new one
                self.browser.new_tab()?
            } else {
                // Use the first existing tab
                tabs.first().unwrap().clone()
            }
        };

        // Store the tab index (should be 0 in most cases)
        let tab_index = {
            let tabs = self.browser.get_tabs().lock().unwrap();
            tabs.iter().position(|t| {
                // Match by tab ID
                std::ptr::eq(t.as_ref(), tab.as_ref())
            }).unwrap_or(0)
        };
        *self.notebook_tab_index.lock().unwrap() = Some(tab_index);

        // Navigate to the notebook
        tab.navigate_to(&url)?;

        // Wait for JupyterLab to load (look for main element)
        tab.wait_for_element_with_custom_timeout("#main", Duration::from_secs(10))
            .context("JupyterLab failed to load. Check that jupyter-collaboration extension is installed.")?;

        // Keep page open for a bit to let Y.js initialize
        std::thread::sleep(Duration::from_secs(2));

        Ok(())
    }

    /// Take screenshot for debugging
    ///
    /// Saves a PNG screenshot of the specified tab to output_path.
    /// If tab_index is not provided (or 0), uses the notebook tab if available.
    pub fn screenshot(&self, tab_index: usize, output_path: &str) -> Result<()> {
        // Use notebook tab index if available and tab_index is 0
        let actual_index = if tab_index == 0 {
            self.notebook_tab_index.lock().unwrap()
                .unwrap_or(0)
        } else {
            tab_index
        };

        let tabs = self.browser.get_tabs().lock().unwrap();
        let tab = tabs.get(actual_index)
            .context(format!("Tab {} not found (have {} tabs)", actual_index, tabs.len()))?;

        let screenshot_data = tab.capture_screenshot(
            headless_chrome::protocol::cdp::Page::CaptureScreenshotFormatOption::Png,
            None,
            None,
            true,
        )?;

        std::fs::write(output_path, screenshot_data)?;
        Ok(())
    }

    /// Get the number of open tabs
    pub fn tab_count(&self) -> usize {
        self.browser.get_tabs().lock().unwrap().len()
    }

    /// Wait for a duration (useful for letting operations complete)
    pub fn wait(&self, duration: Duration) {
        std::thread::sleep(duration);
    }
}

impl Drop for NotebookBrowser {
    fn drop(&mut self) {
        // Browser cleanup happens automatically
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[ignore] // Only run manually: cargo test --test browser_helper -- --ignored
    fn test_browser_launch() {
        let browser = NotebookBrowser::new();
        assert!(browser.is_ok(), "Failed to launch browser");
    }
}
