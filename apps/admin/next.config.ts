import type { NextConfig } from "next";

// Every admin page reads the signed-in user's cookies, so nothing here is
// prerendered; cache components stay off to keep the pages plain and dynamic.
const nextConfig: NextConfig = {};

export default nextConfig;
