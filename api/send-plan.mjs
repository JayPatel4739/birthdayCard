const answerChoices = {
  destination: ['a cozy movie night', 'a cute café and dessert', 'a bookstore and coffee', 'a relaxed scenic walk'],
  treat: ['pizza', 'something sweet', 'boba and a snack', 'a fun surprise'],
  mood: ['cozy and relaxed', 'full of laughs', 'a little adventurous', 'slow and unplanned']
};
const recentRequests = new Map();
const maxBodyLength = 16 * 1024;

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

function requestIsAllowed(request) {
  const origin = request.headers.get('origin');
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return false;
    } catch {
      return false;
    }
  }

  const now = Date.now();
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const recent = (recentRequests.get(ip) || []).filter((time) => now - time < 60 * 60 * 1000);
  if (recent.length >= 8) return false;
  recent.push(now);
  recentRequests.set(ip, recent);
  return true;
}

export default {
  async fetch(request) {
    if (request.method !== 'POST') {
      return jsonResponse({ success: false, error: 'Method not allowed.' }, 405);
    }
    if (!requestIsAllowed(request)) {
      return jsonResponse({ success: false, error: 'This request was not accepted. Please try again later.' }, 403);
    }
    if (!process.env.RESEND_API_KEY) {
      return jsonResponse({ success: false, error: 'The form is not available right now.' }, 503);
    }

    let answers;
    try {
      const body = await request.text();
      if (body.length > maxBodyLength) return jsonResponse({ success: false, error: 'Please answer every question and try again.' }, 413);
      answers = JSON.parse(body || '{}');
    } catch {
      return jsonResponse({ success: false, error: 'Please answer every question and try again.' }, 400);
    }

    for (const [key, values] of Object.entries(answerChoices)) {
      if (!values.includes(answers[key])) {
        return jsonResponse({ success: false, error: 'Please answer every question and try again.' }, 400);
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
        return jsonResponse({ success: false, error: 'Could not complete that. Please try again.' }, 502);
      }
      return jsonResponse({ success: true });
    } catch (error) {
      console.error('Resend request failed:', error.message);
      return jsonResponse({ success: false, error: 'Could not complete that. Please try again.' }, 502);
    }
  }
};
