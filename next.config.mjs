/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "p3.music.126.net"
      },
      {
        protocol: "https",
        hostname: "api.injahow.cn"
      }
    ]
  }
};

export default nextConfig;
