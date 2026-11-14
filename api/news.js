// Vercel entry for the in-game news endpoint used by /qcnews (same code as the Netlify function).
import handler from "../netlify/functions/news.mjs";
export const POST = (request) => handler(request);
export const GET = (request) => handler(request);
export const OPTIONS = (request) => handler(request);
