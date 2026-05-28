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
        let virtual_columns = self.virtual_columns.lock().unwrap();

        plan.transform_up(|node| {
            node.map_expressions(|expr| {
                if let Expr::Column(col) = &expr {
                    if let Some(relation) = &col.relation {
                        let table_name = relation.to_string();
                        if let Some(table_cols) = virtual_columns.get(&table_name) {
                            if let Some(calc_expr) = table_cols.get(&col.name) {
                                // Recursively expand any nested virtual columns inside this expression
                                let expanded = expand_virtual_columns(calc_expr.clone(), &virtual_columns);
                                return Ok(Transformed::yes(expanded.alias_qualified(col.relation.clone(), col.name.clone())));
                            }
                        }
                    }       
                }
                Ok(Transformed::no(expr))
            })
        }).map(|t| t.data)
    }

}

/// Helper function to recursively expand column references mapping to virtual columns
fn expand_virtual_columns(
    expr: Expr,
    virtual_columns: &HashMap<String, HashMap<String, Expr>>,
) -> Expr {
    expr.transform_up(|e| {
        if let Expr::Column(col) = &e {
            if let Some(relation) = &col.relation {
                let table_name = relation.to_string();
                if let Some(table_cols) = virtual_columns.get(&table_name) {
                    if let Some(calc_expr) = table_cols.get(&col.name) {
                        let expanded = expand_virtual_columns(calc_expr.clone(), virtual_columns);
                        return Ok(Transformed::yes(expanded.alias_qualified(col.relation.clone(), col.name.clone())));
                    }
                }
            }
        }
        Ok(Transformed::no(e))
    }).unwrap().data
}