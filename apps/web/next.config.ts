import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@medisync/contracts",
    "@medisync/country-packs",
    "@medisync/design-tokens",
  ],
  images: {
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
