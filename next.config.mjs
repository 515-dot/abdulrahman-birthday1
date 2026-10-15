// This is a server-rendered Next.js app. Do NOT add `output: 'export'` and do NOT host it on
// GitHub Pages: it needs a Node runtime for sessions, API routes and PostgreSQL.
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
];

export default {
  poweredByHeader: false,
  serverExternalPackages: ['@node-rs/argon2'], // native module must not be bundled
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};
