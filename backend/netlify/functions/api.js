const serverless = require("serverless-http");
const app = require("../../app");

// One serverless endpoint for every /api/* request. The static site is served
// straight from Netlify's CDN (see netlify.toml), this only runs the API.
const handler = serverless(app);

const FUNCTION_PREFIX = "/.netlify/functions/api";

exports.handler = (event, context) => {
  // Netlify rewrites /api/* to this function, so the app sees the function's
  // own path. Put the public /api prefix back before Express routes it.
  if (event.path && event.path.startsWith(FUNCTION_PREFIX)) {
    event.path = "/api" + event.path.slice(FUNCTION_PREFIX.length);
  }
  return handler(event, context);
};
