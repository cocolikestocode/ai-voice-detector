// Dynamic application configuration
// Automatically resolves HTTP/HTTPS and WS/WSS based on the current window location

const isBrowser = typeof window !== "undefined";
const isSecure = isBrowser && window.location.protocol === "https:";
const currentHost = isBrowser ? window.location.host : "localhost:5173";

// In development and production, requests route through the Vite / Nginx reverse proxy by default
export const API_BASE_URL = 
  import.meta.env.VITE_API_BASE_URL || 
  (isBrowser ? window.location.origin : "http://localhost:8000");

export const WS_BASE_URL = 
  import.meta.env.VITE_WS_BASE_URL || 
  `${isSecure ? "wss" : "ws"}://${currentHost}`;

export const DEFAULT_CONFIG = {
  defaultThreshold: 1.0,
  targetSamplingRate: 16000,
  chunkDurationSec: 4.0,
  chunkSamples: 64000
};
