// Vercel serverless catch-all handler for /api/* routes
// Uses /tmp for SQLite on Vercel (ephemeral storage)
if (!process.env.DB_PATH) {
  process.env.DB_PATH = '/tmp/momento.db';
}

import app from '../server/index.js';
export default app;
