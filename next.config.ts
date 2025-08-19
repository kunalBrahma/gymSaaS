import type { NextConfig } from "next";

const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ik.imagekit.io',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
  allowedDevOrigins: [
    'https://9a57d6d255fc.ngrok-free.app/', // Replace with your current ngrok domain
    // Add more ngrok domains as needed
  ],
};
export default nextConfig;
