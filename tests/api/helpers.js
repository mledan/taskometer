/**
 * Test helpers for exercising Vercel API routes in-process.
 *
 * Vercel's runtime hands routes (req, res) where res has a chainable
 * status/json/end/setHeader surface. We mock just that surface so
 * routes can be called directly from vitest with no server boot.
 */

export function mockReq({ method = 'GET', query = {}, body = null, headers = {} } = {}) {
  return { method, query, body, headers };
}

export function mockRes() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    headersSent: false,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; this.headersSent = true; return this; },
    end(payload) { if (payload != null) this.body = payload; this.headersSent = true; return this; },
    setHeader(k, v) { this.headers[k] = v; return this; },
  };
}

export async function callHandler(handler, init) {
  const req = mockReq(init);
  const res = mockRes();
  await handler(req, res);
  return { status: res.statusCode, body: res.body, headers: res.headers };
}
