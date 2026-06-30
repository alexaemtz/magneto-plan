import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Allow Google OAuth popup to post a message back to this window.
          // "same-origin" (Vercel default) blocks it; "same-origin-allow-popups" fixes it
          // while keeping cross-origin isolation for windows we did NOT open.
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
        ],
      },
    ];
  },
};

export default nextConfig;
