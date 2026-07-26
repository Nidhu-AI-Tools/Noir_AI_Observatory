import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  basePath,
  output: "export",
  reactStrictMode: true,
  trailingSlash: true,
  transpilePackages: ["@noir/core", "@noir/dashboard-data"],
};

export default nextConfig;
