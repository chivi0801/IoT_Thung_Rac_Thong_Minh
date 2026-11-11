/**
 * ==========================================================================
 * APP CONFIG (config.js)
 * Centralised runtime endpoints so the frontend can switch between the
 * Spring Boot gateway served on :8080 and a local static HTTP server.
 * ==========================================================================
 */

const APP_CONFIG = {
  API_BASE_URL: window.location.origin.includes(':8080')
    ? window.location.origin + '/api/v1'
    : 'http://localhost:8080/api/v1',
  WS_URL: 'ws://' + (window.location.hostname || 'localhost') + ':8080/ws/iot'
};

window.APP_CONFIG = APP_CONFIG;
