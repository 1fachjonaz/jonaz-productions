// Vercel entry for the admin API (same code as the Netlify function).
import handler from "../netlify/functions/admin.mjs";
export const POST = (request) => handler(request);
export const GET = (request) => handler(request);
