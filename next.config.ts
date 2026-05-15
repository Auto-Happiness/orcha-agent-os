import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ["mysql2", "mssql", "serverless-mysql", "duckdb"],
};

export default nextConfig;
