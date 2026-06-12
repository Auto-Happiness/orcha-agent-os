/* tslint:disable */
/* eslint-disable */

export class OrchaSemanticEngine {
    free(): void;
    [Symbol.dispose](): void;
    constructor();
    register_calculated_column(table_name: string, column_name: string, expression: string): Promise<void>;
    register_table(table_name: string, fields_json: string): void;
    translate_sql(sql: string, dialect: string): Promise<string>;
}
