import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The shared workspace package publishes TypeScript source.
  transpilePackages: ["@hacknc26/shared"],
  experimental: {
    // TypeScript 7 provides a native CLI rather than the JavaScript compiler API.
    useTypeScriptCli: true,
  },
};

export default nextConfig;
