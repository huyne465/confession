import type { NextConfig } from 'next';
import type { RemotePattern } from 'next/dist/shared/lib/image-config';

/**
 * Uploaded assets are served from the same origin as the API (nginx proxies
 * /assets/ to the Cloud Storage bucket), so the API URL is enough to derive the
 * host next/image must be allowed to fetch. NEXT_PUBLIC_IMAGE_HOSTS adds any
 * extra origin — a CDN, or the bucket accessed directly.
 */
function derivedPatterns(): RemotePattern[] {
  const origins = [
    process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api',
    ...(process.env.NEXT_PUBLIC_IMAGE_HOSTS ?? '').split(',').filter(Boolean),
  ];

  const patterns: RemotePattern[] = [];
  for (const origin of origins) {
    try {
      const url = new URL(origin.trim());
      patterns.push({
        protocol: url.protocol.replace(':', '') as 'http' | 'https',
        hostname: url.hostname,
        ...(url.port ? { port: url.port } : {}),
      });
    } catch {
      // A malformed entry must not take the whole build down.
    }
  }
  return patterns;
}

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'fastly.picsum.photos' },
      { protocol: 'https', hostname: 'storage.googleapis.com' },
      ...derivedPatterns(),
    ],
  },
};

export default nextConfig;
