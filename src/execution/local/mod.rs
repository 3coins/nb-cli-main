//! Local execution backend using direct kernel connection

pub mod discovery;
pub mod manager;
pub mod executor;

pub use executor::LocalExecutor;
