# Dozer Lab — Gemini Chat Integration

This workspace contains a static frontend and a small Node.js proxy that forwards chat requests to Google Gemini (via `@google/genai`). Keep your Gemini API key server-side — do NOT place it in client JS.

Quick start

1. Install dependencies for the proxy:

```bash
cd "d:/coding/pythoncodes/simulation/vecor - Copy/New folder/kutty_lab"
npm install
```

2. Set your API key in the environment and start the proxy:

Windows (PowerShell):
```powershell
$env:GEMINI_API_KEY = "your_key_here"
# Dozer Lab — Gemini Chat Integration

This workspace contains a static frontend and a small Node.js proxy that forwards chat requests to Google Gemini (via `@google/genai`). Keep your Gemini API key server-side — do NOT place it in client JS.

Quick start (local)

1. Install dependencies for the proxy:

```bash
cd "d:/coding/pythoncodes/simulation/vecor - Copy/New folder/kutty_lab"
npm install
```

2. Set your API key in the environment and start the proxy:

Windows (PowerShell):
```powershell
$env:GEMINI_API_KEY = "your_key_here"
npm start
```

macOS / Linux:
```bash
export GEMINI_API_KEY="your_key_here"
npm start
```

3. Open `index.html` in your browser (file://) or serve the folder with a static server. The chat UI will POST to `http://localhost:3000/api/chat` by default.

Deploying the proxy (Vercel)

- GitHub Pages is static; you must host the proxy (server-side) separately. This project includes a Vercel serverless function at `api/chat.js` and `vercel.json` for easy deploy.

1. Install the Vercel CLI (optional) and log in, or use the Vercel dashboard.

```bash
npm i -g vercel
vercel login
```

2. From the project root, deploy:

```bash
vercel --prod
```

3. In the Vercel dashboard for the project, add Environment Variables:
	 - `GEMINI_API_KEY` = your Gemini API key
	 - (optional) `PROXY_TOKEN` = a random secret to protect your proxy

4. After deployment, you'll have an endpoint like `https://your-app.vercel.app/api/chat`.

Protecting the proxy (recommended)

- If you set `PROXY_TOKEN` in Vercel, the function will require clients to send an `Authorization: Bearer <PROXY_TOKEN>` header. This helps prevent unauthorized use.

Wiring the frontend (GitHub Pages)

- In `index.html`, before the `<script src="script.js"></script>` line add:

```html
<script>
	window.CHAT_API = 'https://your-app.vercel.app/api/chat';
	// Optional: if you set PROXY_TOKEN on the server, set it here (not secret-free if committed)
	// window.PROXY_TOKEN = 'your_proxy_token_here';
</script>
```

- If you host the static site on GitHub Pages, the browser will call the Vercel function; the secret stays only on the server.

Security notes

- Never commit `GEMINI_API_KEY` to the repository. Use the provided `.env.example` as a template and keep real keys in your environment or Vercel settings.
- If you must embed a short-lived token in the static site, rotate it frequently. Do not commit secrets to GitHub.

If you'd like, I can:
- Add a `vercel` GitHub Action to auto-deploy the API on push, or
- Convert the function to a Netlify Function instead. Which do you prefer?
