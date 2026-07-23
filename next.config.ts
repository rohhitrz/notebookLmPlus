import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "fluent-ffmpeg",
    "ffmpeg-static",
    "youtubei.js",
    "bgutils-js",
    "jsdom",
  ],
};

export default nextConfig;
