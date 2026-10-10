import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static build served by FastAPI (see Dockerfile). Output goes to ./out.
  output: "export",
};

export default nextConfig;
