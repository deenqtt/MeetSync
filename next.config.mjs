/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",

  // Keep native/server-only packages out of the bundle so they run on Node.
  serverExternalPackages: [
    "prisma",
    "@prisma/client",
    "ws",
    "mqtt",
    "bufferutil",
    "utf-8-validate",
  ],

  // Standalone internal tool — don't block builds on lint/type noise from
  // verbatim-ported module code.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },

  poweredByHeader: false,
};

export default nextConfig;
