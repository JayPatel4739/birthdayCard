const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = __dirname;
const MAX_BODY_BYTES = 16 * 1024;
const requestCounts = new Map();

function loadLocalEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator < 1) continue;

    const name = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[name] === undefined) process.env[name] = value;
  }
}

loadLocalEnv();

const PORT = Number(process.env.PORT || 3000);
const RECIPIENT = process.env.RESEND_TO || 'jay43184@gmail.com';
const SENDER = process.env.RESEND_FROM || 'Birthday Card <onboarding@resend.dev>';

function sendJson(response, status, payload) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  response.end(JSON.stringify(payload));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
        reject(new Error('Request is too large.'));
        request.destroy();
      }
    });
    request.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        reject(new Error('Please submit the answers again.'));
      }
    });
    request.on('error', reject);
  });
}

function allowRequest(request, response) {
  const origin = request.headers.origin;
  if (origin) {
    try {
      if (new URL(origin).host !== request.headers.host) {
        sendJson(response, 403, { success: false, error: 'This request was not accepted.' });
        return false;
      }
    } catch {
      sendJson(response, 403, { success: false, error: 'This request was not accepted.' });
      return false;
    }
  }

  const now = Date.now();
  const client = request.socket.remoteAddress || 'unknown';
  const recent = (requestCounts.get(client) || []).filter((time) => now - time < 60 * 60 * 1000);
  if (recent.length >= 8) {
    sendJson(response, 429, { success: false, error: 'Too many attempts. Please try again later.' });
    return false;
  }
  recent.push(now);
  requestCounts.set(client, recent);
  return true;
}

async function sendDayPlan(request, response) {
  if (!allowRequest(request, response)) return;
  if (!process.env.RESEND_API_KEY) {
    sendJson(response, 503, { success: false, error: 'Email is not configured yet. Add RESEND_API_KEY to the .env file and restart the app.' });
    return;
  }

  let answers;
  try {
    answers = await readJson(request);
  } catch (error) {
    sendJson(response, 400, { success: false, error: error.message });
    return;
  }

  const allowed = {
    destination: ['a cozy movie night', 'a cute café and dessert', 'a bookstore and coffee', 'a relaxed scenic walk'],
    treat: ['pizza', 'something sweet', 'boba and a snack', 'a fun surprise'],
    mood: ['cozy and relaxed', 'full of laughs', 'a little adventurous', 'slow and unplanned']
  };
  for (const key of Object.keys(allowed)) {
    if (!allowed[key].includes(answers[key])) {
      sendJson(response, 400, { success: false, error: 'Please answer every question and try again.' });
      return;
    }
  }

  const text = [
    'A hypothetical birthday day out',
    '',
    `Where to go: ${answers.destination}`,
    `Treat: ${answers.treat}`,
    `Mood: ${answers.mood}`
  ].join('\n');

  try {
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: SENDER,
        to: [RECIPIENT],
        subject: 'Birthday day-out plan',
        text
      })
    });
    const result = await resendResponse.json().catch(() => ({}));
    if (!resendResponse.ok) {
      const reason = typeof result.message === 'string'
        ? result.message
        : typeof result.name === 'string'
          ? result.name
          : 'Unknown Resend error';
      console.error(`Resend rejected the email (${resendResponse.status}):`, reason);
      sendJson(response, 502, {
        success: false,
        error: `Resend rejected the email (${resendResponse.status}): ${reason}`
      });
      return;
    }
    sendJson(response, 200, { success: true, id: result.id });
  } catch (error) {
    console.error('Resend request failed:', error.message);
    sendJson(response, 502, { success: false, error: 'Could not reach Resend. Check your internet connection and try again.' });
  }
}

const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, `http://${request.headers.host || 'localhost'}`).pathname;

  if (request.method === 'POST' && pathname === '/api/send-plan') {
    sendDayPlan(request, response);
    return;
  }

  if (request.method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
    response.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    });
    fs.createReadStream(path.join(ROOT, 'index.html')).pipe(response);
    return;
  }

  sendJson(response, 404, { success: false, error: 'Not found.' });
});

server.listen(PORT, () => {
  console.log(`Birthday card running at http://localhost:${PORT}`);
});
