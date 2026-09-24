import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // apify-client uses Node-only networking internals; load it with plain require
  serverExternalPackages: ["apify-client"],
};

export default nextConfig;
