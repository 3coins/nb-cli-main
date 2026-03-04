//! Remote execution backend using Jupyter Server API

pub mod client;
pub mod websocket;

use crate::execution::types::{ExecutionConfig, ExecutionResult};
use crate::execution::ExecutionBackend;
use anyhow::Result;

/// Remote execution backend using Jupyter Server
pub struct RemoteExecutor {
    config: ExecutionConfig,
    server_url: String,
    token: String,
}

impl RemoteExecutor {
    pub fn new(config: ExecutionConfig, server_url: String, token: String) -> Result<Self> {
        Ok(Self {
            config,
            server_url,
            token,
        })
    }
}

#[async_trait::async_trait]
impl ExecutionBackend for RemoteExecutor {
    async fn start(&mut self) -> Result<()> {
        // TODO: Create session via HTTP API
        Ok(())
    }

    async fn execute_code(&mut self, _code: &str) -> Result<ExecutionResult> {
        // TODO: Execute via WebSocket
        anyhow::bail!("Remote execution not yet implemented")
    }

    async fn stop(&mut self) -> Result<()> {
        // TODO: Delete session
        Ok(())
    }
}
