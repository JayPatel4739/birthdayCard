# Birthday card

The day-plan answers are sent through Resend from a small Node server. The Resend API key stays on the server and is never put in the browser code.

## Run locally

1. Install Node.js 18 or newer.
2. Create a Resend account and make a sending API key.
3. Copy `.env.example` to `.env` and replace `RESEND_API_KEY` with your key. Keep `.env` private; it is ignored by Git.
4. Start the app:

   ```sh
   npm start
   ```

5. Open [http://localhost:3000](http://localhost:3000).

The default sender is Resend's test sender, `onboarding@resend.dev`, which can send only to the email address on your Resend account. Make sure that address matches `RESEND_TO`. For delivery to other addresses, verify a domain in Resend and set `RESEND_FROM` to an address on it. Configure the same environment variables on your hosting provider when deploying; a static-only host cannot run this email endpoint by itself.
