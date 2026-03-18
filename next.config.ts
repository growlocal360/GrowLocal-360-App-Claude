import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Supabase Storage (all projects)
      { protocol: 'https', hostname: '*.supabase.co' },
      // Google profile avatars (OAuth)
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      // GitHub avatars (OAuth)
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
    ],
  },
};

export default nextConfig;
