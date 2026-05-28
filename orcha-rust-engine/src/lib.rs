use wasm_bindgen::prelude::*;
use datafusion::prelude::*;
use datafusion::logical_expr::LogicalPlan;
use std::sync::{Arc, Mutex};
use std::collections::HashMap;

pub mod error;
pub mod model;
pub mod analyzer;
pub mod context;

use crate::error::OrchaError;
use crate::model::FieldInput;
use crate::context::{create_session_context, register_table, translate_sql};

#[wasm_bindgen]
pub struct OrchaSemanticEngine {
    ctx: SessionContext,
    virtual_columns: Arc<Mutex<HashMap<String, HashMap<String, Expr>>>>,
}

#[wasm_bindgen]
impl OrchaSemanticEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Result<OrchaSemanticEngine, JsError> {
        let virtual_columns = Arc::new(Mutex::new(HashMap::new()));
        let ctx = create_session_context(Arc::clone(&virtual_columns));

        Ok(OrchaSemanticEngine { ctx, virtual_columns })
    }

    pub async fn translate_sql(&self, sql: &str) -> Result<String, JsError> {
        let physical_sql = translate_sql(&self.ctx, sql)
            .await
            .map_err(OrchaError::from)?;
        Ok(physical_sql)
    }

    pub fn register_table(&self, table_name: &str, fields_json: &str) -> Result<(), JsError> {
        // Parse the JSON array into our Rust structs, mapping any JSON error to OrchaError
        let fields: Vec<FieldInput> = serde_json::from_str(fields_json)
            .map_err(OrchaError::from)?;
            
        // Register the schema with DataFusion
        register_table(&self.ctx, table_name, fields)
            .map_err(OrchaError::from)?;
            
        Ok(())
    }

    pub async fn register_calculated_column(
        &self,
        table_name: &str,
        column_name: &str,
        expression: &str,
    ) -> Result<(), JsError> {
        let sql = format!("SELECT {} FROM {}", expression, table_name);
        
        let df = self.ctx.sql(&sql).await
            .map_err(|e| JsError::new(&format!("Invalid expression formula: {e}")))?;
        
        let plan = df.logical_plan();

        if let LogicalPlan::Projection(projection) = plan {
            if let Some(expr) = projection.expr.first() {
                let mut map = self.virtual_columns.lock().unwrap();
                map.entry(table_name.to_string())
                    .or_default()
                    .insert(column_name.to_string(), expr.clone());
                return Ok(());
            }
        }
        
        Err(JsError::new("Failed to parse calculated column expression"))
    }
}