// Vercel serverless catch-all handler for /api/* routes
// Uses /tmp for SQLite on Vercel (ephemeral storage)
//
// NOTE: dynamic import is required here because ES module `import` declarations
// are hoisted above all other statements. A static `import` would cause
// server/index.js (which calls initDb()) to run BEFORE DB_PATH is set,
// making SQLite try to write to the read-only filesystem and crashing the function.
if (!process.env.DB_PATH) {
  process.env.DB_PATH = '/tmp/momento.db';
}

const { default: app } = await import('../server/index.js');
export default app;
