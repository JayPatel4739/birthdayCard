const answerChoices = {
  destination: ['a cozy movie night', 'a cute café and dessert', 'a bookstore and coffee', 'a relaxed scenic walk'],
  treat: ['pizza', 'something sweet', 'boba and a snack', 'a fun surprise'],
  mood: ['cozy and relaxed', 'full of laughs', 'a little adventurous', 'slow and unplanned']
};
const recentRequests = new Map();
const maxBodyLength = 16 * 1024;

function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.end(JSON.stringify(payload));
}

function requestIsAllowed(request) {
  const origin = request.headers.origin;
  const host = request.headers['x-forwarded-host'] || request.headers.host;
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return false;
    } catch {
      return false;
    }
  }

  const now = Date.now();
  const ip = request.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  const recent = (recentRequests.get(ip) || []).filter((time) => now - time < 60 * 60 * 1000);
  if (recent.length >= 8) return false;
  recent.push(now);
  recentRequests.set(ip, recent);
  return true;
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    sendJson(response, 405, { success: false, error: 'Method not allowed.' });
    return;
  }
  if (!requestIsAllowed(request)) {
    sendJson(response, 403, { success: false, error: 'This request was not accepted. Please try again later.' });
    return;
  }
  if (!process.env.RESEND_API_KEY) {
    sendJson(response, 503, { success: false, error: 'The form is not available right now.' });
    return;
  }

  let answers = request.body;
  if (typeof answers === 'string') {
    if (Buffer.byteLength(answers) > maxBodyLength) {
      sendJson(response, 413, { success: false, error: 'Please answer every question and try again.' });
      return;
    }
    try {
      answers = JSON.parse(answers || '{}');
    } catch {
      sendJson(response, 400, { success: false, error: 'Please answer every question and try again.' });
      return;
    }
  }
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    sendJson(response, 400, { success: false, error: 'Please answer every question and try again.' });
    return;
  }
  if (Buffer.byteLength(JSON.stringify(answers)) > maxBodyLength) {
    sendJson(response, 413, { success: false, error: 'Please answer every question and try again.' });
    return;
  }

  for (const [key, values] of Object.entries(answerChoices)) {
    if (!values.includes(answers[key])) {
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
        from: process.env.RESEND_FROM || 'Birthday Card <onboarding@resend.dev>',
        to: [process.env.RESEND_TO || 'cognitio56@gmail.com'],
        subject: 'Birthday day-out plan',
        text
      })
    });
    const result = await resendResponse.json().catch(() => ({}));
    if (!resendResponse.ok) {
      console.error(`Resend rejected the email (${resendResponse.status}):`, result.message || result.name || 'Unknown Resend error');
      sendJson(response, 502, { success: false, error: 'Could not complete that. Please try again.' });
      return;
    }
    sendJson(response, 200, { success: true });
  } catch (error) {
    console.error('Resend request failed:', error.message);
    sendJson(response, 502, { success: false, error: 'Could not complete that. Please try again.' });
  }
}
