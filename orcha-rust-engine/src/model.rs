use serde::Deserialize;
use datafusion::arrow::datatypes::DataType;
use crate::error::OrchaError;


#[derive(Deserialize)]
pub struct FieldInput {
    pub name: String,
    #[serde(rename = "type")]
    pub data_type: String,
}

impl FieldInput {

    pub fn to_arrow(&self) -> Result<DataType, OrchaError> {
        match self.data_type.to_lowercase().as_str() {
            "integer" | "int" | "int32" => Ok(DataType::Int32),
            "bigint" | "int64" | "long" => Ok(DataType::Int64),
            "double" | "float64" => Ok(DataType::Float64),
            "float" | "float32" => Ok(DataType::Float32),
            "boolean" | "bool" => Ok(DataType::Boolean),
            "varchar" | "string" | "text" | "char" | "uuid" => Ok(DataType::Utf8),
            "date" => Ok(DataType::Date32),
            "timestamp" | "datetime" | "timestamptz" => Ok(DataType::Timestamp(
                datafusion::arrow::datatypes::TimeUnit::Millisecond,
                None,
            )),
            "decimal" | "numeric" => Ok(DataType::Decimal128(38, 10)),
            "binary" => Ok(DataType::Binary),
            _ => Err(OrchaError::Custom(format!(
                "Unsupported database type: {}",
                self.data_type
            ))),
        }
    }

}