import type { NextConfig } from "next";

const allowedDevOrigins = (process.env.DEV_ALLOWED_ORIGINS ?? "10.48.17.162")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  allowedDevOrigins,
};

export default nextConfig;
