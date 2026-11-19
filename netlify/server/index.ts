// Netlify Server entrypoint: serves the existing Express API (/api/*).
// The server only handles /api/* (see [server] in netlify.toml); the static
// frontend in dist/ is served by the Netlify CDN.
import { apiApp } from '../../server/apiApp.ts';

export default apiApp;
