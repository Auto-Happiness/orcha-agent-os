use datafusion::logical_expr::LogicalPlan;
use datafusion::sql::unparser::Unparser;
use datafusion::sql::unparser::dialect::{DefaultDialect, MySqlDialect, PostgreSqlDialect, SqliteDialect};
use crate::error::OrchaError;

pub fn plan_to_sql_with_dialect(plan: &LogicalPlan, dialect_name: &str) -> Result<String, OrchaError> {
    let physical_sql = match dialect_name.to_lowercase().as_str() {
        "mysql" => {
            let dialect = MySqlDialect {};
            let unparser = Unparser::new(&dialect);
            unparser.plan_to_sql(plan)?
        }
        "postgres" | "postgresql" => {
            let dialect = PostgreSqlDialect {};
            let unparser = Unparser::new(&dialect);
            unparser.plan_to_sql(plan)?
        }
        "sqlite" => {
            let dialect = SqliteDialect {};
            let unparser = Unparser::new(&dialect);
            unparser.plan_to_sql(plan)?
        }
        "mssql" | "sqlserver" => {
            // MSSQL executes standard ANSI SQL correctly (using double quote identifier escaping)
            let dialect = DefaultDialect {};
            let unparser = Unparser::new(&dialect);
            unparser.plan_to_sql(plan)?
        }
        _ => {
            let dialect = DefaultDialect {};
            let unparser = Unparser::new(&dialect);
            unparser.plan_to_sql(plan)?
        }
    };
    
    Ok(physical_sql.to_string())
}