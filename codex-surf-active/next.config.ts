import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  // Keep dev output separate from production builds to avoid stale chunk mismatches.
  distDir: isDevelopment ? ".next-dev" : ".next",
};

export default nextConfig;
