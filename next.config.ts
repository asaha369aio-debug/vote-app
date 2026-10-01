import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 同じWi-Fiのスマホ等から開発サーバー（http://<このPCのIP>:3000）を開けるようにする
  allowedDevOrigins: ['192.168.*.*'],
};

export default nextConfig;
