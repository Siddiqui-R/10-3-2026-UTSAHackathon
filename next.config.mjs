/** @type {import('next').NextConfig} */
const nextConfig = {
  // The FTC reported-numbers index is read from disk at runtime, so ship it with the routes that use it.
  experimental: {
    outputFileTracingIncludes: {
      "/api/check-number": ["./data/ftc-reported-numbers.tsv.gz"],
      "/api/screen": ["./data/ftc-reported-numbers.tsv.gz"],
    },
  },
};

export default nextConfig;
