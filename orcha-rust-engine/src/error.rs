use datafusion::error::DataFusionError;
use std::fmt;

#[derive(Debug)]
pub enum OrchaError {
    DataFusionError(String),
    Json(String),
    Custom(String),
}

impl fmt::Display for OrchaError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            OrchaError::DataFusionError(msg) => write!(f, "DataFusion error: {msg}"),
            OrchaError::Json(msg) => write!(f, "JSON error: {msg}"),
            OrchaError::Custom(msg) => write!(f, "Error: {msg}"),
        }
    }
}

impl std::error::Error for OrchaError {}

impl From<DataFusionError> for OrchaError {
    fn from(err: DataFusionError) -> Self {
        OrchaError::DataFusionError(err.to_string())
    }
}

impl From<serde_json::Error> for OrchaError{
    fn from(err: serde_json::Error) -> Self {
        OrchaError::Json(err.to_string())
    }
}
