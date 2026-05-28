use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use datafusion::prelude::*;
use datafusion::datasource::MemTable;
use datafusion::arrow::datatypes::{Field, Schema};
use datafusion::sql::unparser::Unparser;
use datafusion::sql::unparser::dialect::DefaultDialect;
use crate::error::OrchaError;
use crate::model::FieldInput;
use crate::analyzer::VirtualColumnAnalyzer;


pub fn create_session_context(virtual_columns: Arc<Mutex<HashMap<String, HashMap<String, Expr>>>>) -> SessionContext    {
    let ctx = SessionContext::new();
    let analyzer =  VirtualColumnAnalyzer { virtual_columns };
    ctx.add_analyzer_rule(Arc::new(analyzer));
    ctx
}

pub fn register_table(ctx: &SessionContext, table_name: &str, fields: Vec<FieldInput>,) -> Result<(), OrchaError> {
    let mut arrow_fields = Vec::new();

    for field in fields {
        let data_type = field.to_arrow()?;
        arrow_fields.push(Field::new(&field.name, data_type, true));
    }

    let schema = Arc::new(Schema::new(arrow_fields));
    let mem_table = MemTable::try_new(schema, vec![vec![]])?;
    ctx.register_table(table_name, Arc::new(mem_table))?;

    Ok(())
}


pub async fn translate_sql(ctx: &SessionContext, sql: &str) -> Result<String, OrchaError> {
    let state = ctx.state();
    let plan = state.create_logical_plan(sql).await?;
    let optimized_plan = state.optimize(&plan)?;
    let dialect = DefaultDialect {};
    let unparser = Unparser::new(&dialect);
    let physical_sql = unparser.plan_to_sql(&optimized_plan)?;
    Ok(physical_sql.to_string())
}
