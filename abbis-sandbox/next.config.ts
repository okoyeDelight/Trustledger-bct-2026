import type { NextConfig } from "next";
const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingIncludes: {
    "/api/datasets/[name]": ["./data/raw/*.csv","./data/catalog.json"],
    "/api/records/search": ["./data/raw/*.csv","./data/catalog.json"],
    "/api/records/lookup": ["./data/raw/*.csv","./data/catalog.json"],
    "/api/catalog": ["./data/catalog.json"],
    "/api/auto/tick": ["./data/catalog.json"],
  },
};
export default config;
