use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use datafusion::config::ConfigOptions;
use datafusion::error::Result as DFResult;
use datafusion::logical_expr::{Expr, LogicalPlan};
use datafusion::optimizer::analyzer::AnalyzerRule;
use datafusion::common::tree_node::{Transformed, TreeNode};


#[derive(Debug)]
pub struct VirtualColumnAnalyzer {
    pub virtual_columns: Arc<Mutex<HashMap<String, HashMap<String, Expr>>>>,
}

impl AnalyzerRule for VirtualColumnAnalyzer {

    fn name(&self) -> &str {
        "virtual_column_analyzer"
    }

    fn analyze(&self, plan: LogicalPlan, _config: &ConfigOptions) -> DFResult<LogicalPlan> {
        plan.transform_up(|node| {
            node.map_expressions(|expr| {
                if let Expr::Column(col) = &expr {
                    if let Some(relation) = &col.relation {
                        let table_name = relation.to_string();
                        let map = self.virtual_columns.lock().unwrap();
                        if let Some(table_cols) = map.get(&table_name) {
                            if let Some(calc_expr) = table_cols.get(&col.name) {
                                return Ok(Transformed::yes(calc_expr.clone().alias_qualified(col.relation.clone(), col.name.clone())));
                            }
                        }
                    }       
                }
                Ok(Transformed::no(expr))
            })
        }).map(|t| t.data)
    }

}