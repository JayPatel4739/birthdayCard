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

The default sender is Resend's test sender, `onboarding@resend.dev`, which can send only to the email address on your Resend account. The sample recipient is `cognitio56@gmail.com` to match the account reported by Resend. For delivery to another address, verify a domain in Resend and set `RESEND_FROM` to an address on it. Configure the same environment variables on your hosting provider when deploying; a static-only host cannot run this email endpoint by itself.

## Deploy to Vercel

The card is a static site, and `api/send-plan.mjs` is deployed as a Vercel Function. `vercel.json` selects the **Other** preset and skips the build step. Connect the Git repository to Vercel with the project root as the Root Directory; leave the Output Directory blank. Vercel will serve `index.html`, `style.css`, and `script.js`, and expose the email endpoint at `/api/send-plan`.

Add these environment variables in the Vercel project settings before deploying:

- `RESEND_API_KEY`: your Resend sending key
- `RESEND_TO`: `cognitio56@gmail.com` for the Resend test sender
- `RESEND_FROM`: `Birthday Card <onboarding@resend.dev>`

For a verified sender domain, change `RESEND_FROM` to an address at that domain. After connecting the repository and adding the variables, pushes to the connected branch will trigger deployments. Vercel environment variables are configured in the project dashboard; do not upload `.env` or put the API key in browser files.
