import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["mysql2", "mssql", "serverless-mysql"],
};

export default nextConfig;
