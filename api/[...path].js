// Vercel serverless catch-all handler for /api/* routes
//
// IMPORTANT: Use a static import so that Vercel's file tracer (@vercel/nft)
// can detect all dependencies (express, better-sqlite3, etc.) and include
// them in the serverless function bundle. A dynamic `await import()` prevents
// dependency tracing, causing the function to crash at runtime with missing
// modules and making Vercel fall back to serving index.html (405 for POST).
//
// The Vercel environment auto-detection for DB_PATH has been moved to
// server/db.js (checks process.env.VERCEL).
import app from '../server/index.js';

export default app;
