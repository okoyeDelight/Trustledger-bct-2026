import type { NextConfig } from "next";
const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingIncludes: {
    "/api/datasets/[name]": ["./data/raw/*.csv"],
  },
};
export default config;
