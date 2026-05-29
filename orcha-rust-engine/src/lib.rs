use datafusion::common::diagnostic;
use wasm_bindgen::prelude::*;
use datafusion::prelude::*;
use datafusion::logical_expr::LogicalPlan;
use std::sync::{Arc, Mutex};
use std::collections::HashMap;

pub mod error;
pub mod model;
pub mod analyzer;
pub mod context;
pub mod dialects;

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

    pub async fn translate_sql(&self, sql: &str, dialect: &str) -> Result<String, JsError> {
        let physical_sql = translate_sql(&self.ctx, sql, dialect)
            .await
            .map_err(OrchaError::from)?;
        Ok(physical_sql)
    }

    pub fn register_table(&self, table_name: &str, fields_json: &str) -> Result<(), JsError> {
        let fields: Vec<FieldInput> = serde_json::from_str(fields_json)
            .map_err(OrchaError::from)?;
            
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

#[cfg(test)]
mod tests {
    use super::*;
    use wasm_bindgen_test::*;

    #[wasm_bindgen_test]
    async fn test_end_to_end_transpilation() {
        let engine = OrchaSemanticEngine::new().unwrap();

        let fields_json = r#"[
            {"name": "id", "type": "integer"},
            {"name": "amount", "type": "double"},
            {"name": "customer_id", "type": "integer"}
        ]"#;
        engine.register_table("orders", fields_json).unwrap();
        engine.register_calculated_column("orders", "amount_with_tax", "amount * 1.05")
            .await
            .unwrap();

        let query = "SELECT id, amount_with_tax FROM orders";
        let physical_sql = engine.translate_sql(query, "").await.unwrap();
       
        assert!(physical_sql.contains("1.05"));
        assert!(physical_sql.to_lowercase().contains("orders"));
    }
}