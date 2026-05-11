import { MySQLDialect } from './dialects/mysql';
import { PostgresDialect } from './dialects/postgres';
import { MSSQLDialect } from './dialects/mssql';
import { SQLiteDialect } from './dialects/sqlite';
import { ScanResult } from './types';

export class DatabaseScanner {

  static async scanMySQL(config: any): Promise<ScanResult> {
    return MySQLDialect.scan(config);
  }

  static async scanPostgres(config: any): Promise<ScanResult> {
    return PostgresDialect.scan(config);
  }

  static async scanMSSQL(config: any): Promise<ScanResult> {
    return MSSQLDialect.scan(config);
  }


  static async scanSQLite(config: any): Promise<ScanResult> {
    return SQLiteDialect.scan(config);
  }

  static async executeQuery(type: string, config: any, sqlStr: string): Promise<{ rows: any[], columns: string[] }> {
    if (type === "mysql") {
      return MySQLDialect.executeQuery(config, sqlStr);
    } else if (type === "mssql") {
      return MSSQLDialect.executeQuery(config, sqlStr);
    } else if (type === "sqlite") {
      return SQLiteDialect.executeQuery(config, sqlStr);
    } else {
      // postgres for PostgreSQL
      return PostgresDialect.executeQuery(config, sqlStr);
    }
  }
}

export * from './types';
