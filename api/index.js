// Vercel serverless handler for /api/* routes
//
// All /api/* requests are routed here via the vercel.json rewrite:
//   { "source": "/api/(.*)", "destination": "/api" }
// Express then handles internal routing based on the original request URL.
//
// IMPORTANT: Use a static import so that Vercel's file tracer (@vercel/nft)
// can detect all dependencies (express, better-sqlite3, etc.) and include
// them in the serverless function bundle.
import app from '../server/index.js';

export default app;
