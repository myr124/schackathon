import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      new URL("https://media.tenor.com/**"),
      new URL("https://picsum.photos/**"),
    ],
  },
};

export default nextConfig;
