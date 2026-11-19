import { httpRequest } from 'http-request';
import { createResponse } from 'create-response';

// Blocklist lives in the code bundle (store lowercase)
const BLOCKED_EMAILS = new Set([
  'blocked@example.com',
  'spammer@test.com',
  'bad.actor@mail.com',
]);

const SKIP_HEADERS = ['host', 'content-length', 'transfer-encoding', 'connection', 'accept-encoding'];

function forwardHeaders(request) {
  const out = {};
  const all = request.getHeaders();
  for (const name in all) {
    if (!SKIP_HEADERS.includes(name.toLowerCase())) out[name] = all[name];
  }
  return out;
}

export async function responseProvider(request) {
  if (request.method !== 'POST') {
    return forward(request, undefined);
  }

  const rawBody = await request.text();

  try {
    const parsed = JSON.parse(rawBody);
    const email = parsed && typeof parsed.email === 'string'
      ? parsed.email.trim().toLowerCase()
      : null;

    if (email && BLOCKED_EMAILS.has(email)) {
      return createResponse(
        403,
        { 'Content-Type': ['application/json'] },
        JSON.stringify({ error: 'Forbidden' })
      );
    }
  } catch (e) {
    // Invalid JSON: pass through and let origin handle it
  }

  return forward(request, rawBody);
}

async function forward(request, body) {
  const opts = {
    method: request.method,
    headers: forwardHeaders(request),
  };
  if (body !== undefined) opts.body = body;

  const originResp = await httpRequest(`${request.scheme}://${request.host}${request.url}`, opts);
  return createResponse(originResp.status, originResp.getHeaders(), originResp.body);
}