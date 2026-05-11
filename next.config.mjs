import { createRequire } from "module";
const require = createRequire(import.meta.url);

const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  sw: "sw-custom.js",
  publicExcludes: ["!icons/**/*", "!screenshots/**/*"],
  buildExcludes: [/middleware-manifest\.json$/],
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
      handler: "CacheFirst",
      options: {
        cacheName: "google-fonts-stylesheets",
        expiration: { maxEntries: 4, maxAgeSeconds: 7 * 24 * 60 * 60 },
      },
    },
    {
      urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
      handler: "CacheFirst",
      options: {
        cacheName: "google-fonts-webfonts",
        expiration: { maxEntries: 20, maxAgeSeconds: 365 * 24 * 60 * 60 },
      },
    },
    {
      urlPattern: /\/_next\/static\/.*/i,
      handler: "CacheFirst",
      options: {
        cacheName: "next-static",
        expiration: { maxEntries: 64, maxAgeSeconds: 30 * 24 * 60 * 60 },
      },
    },
    {
      urlPattern: /\/api\/wallet\/.*/i,
      handler: "NetworkFirst",
      options: {
        cacheName: "wallet-data",
        networkTimeoutSeconds: 30,
        expiration: { maxEntries: 32, maxAgeSeconds: 5 * 60 },
      },
    },
    {
      urlPattern: /\/api\/.*/i,
      handler: "NetworkFirst",
      options: {
        cacheName: "api-cache",
        networkTimeoutSeconds: 60,
        expiration: { maxEntries: 64, maxAgeSeconds: 60 },
      },
    },
    {
      urlPattern: /^https?:\/\/[^/]+\/(?!_next\/static\/).*$/,
      handler: "NetworkFirst",
      options: {
        cacheName: "pages-cache",
        networkTimeoutSeconds: 10,
        expiration: { maxEntries: 32, maxAgeSeconds: 24 * 60 * 60 },
      },
    },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },

  // Packages that run only in Node.js (server components / API routes)
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "prisma", "bcryptjs", "cheerio"],
  },

  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    remotePatterns: [
      { protocol: "https", hostname: "*.buyme.co.il" },
      { protocol: "https", hostname: "*.hever.co.il" },
    ],
  },

  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        // Required for PWA service worker to control the full origin scope
        { key: "Service-Worker-Allowed", value: "/" },
      ],
    },
    {
      source: "/sw-custom.js",
      headers: [
        { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        { key: "Content-Type", value: "application/javascript" },
      ],
    },
  ],
};

export default withPWA(nextConfig);
