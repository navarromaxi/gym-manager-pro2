/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      {
        source: "/inscripciones/:gymId/turnos/:eventId",
        destination: "/inscripciones/:gymId?diario=:eventId",
      },
    ]
  },
}

export default nextConfig
