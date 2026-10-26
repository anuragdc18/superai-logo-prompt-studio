# Logo → Prompts Studio

Upload a client's logo → the 3 website colours are picked from it → Claude writes photo prompts for the
client's template in those colours. Plain HTML/JS in `public/`, published to GitHub Pages.

## Login
The tool opens with a team login. Only a salted PBKDF2 hash of the ID + password is in the code
(`public/auth-config.js`) — the password itself is never stored anywhere.
To change it: open `public/make-login.html` in a browser, type the new ID and password, and paste the line it
gives you into `public/auth-config.js`, then push.

Note: on GitHub Pages the code is public, so the login stops casual visitors; the API key has its own,
stronger protection below.

## Security — read this
- **The Claude API key is NEVER in this code or on GitHub.** Click the key button in the tool, paste the key once.
- With "Remember on this device" it is stored **encrypted** in that browser only
  (AES-256-GCM, passphrase stretched with PBKDF2-SHA256 × 600,000). Without the passphrase it can't be read.
- After unlocking it lives only in memory and locks again after 30 minutes without use, on reload, or with "Lock now".
- The key is sent only to `api.anthropic.com` (a strict Content-Security-Policy blocks every other server).
- Use a **separate key for this tool** with a **monthly spend limit** (console.anthropic.com → Limits).
- Each team member pastes the key on their own computer; never share it in chats or commit it.

## Using it
1. Upload the logo (PNG, JPG, WebP or SVG). Colours are picked automatically — click a found colour, then a box, to change.
2. Copy the 3 codes into the client site's **Admin → Logo & Colours** (Navy = dark, Royal = main, Brand = accent).
3. Pick the client's template, then **Write smart prompts with Claude** (or **Quick prompts** — no AI, no cost).
4. Copy or download the prompts, generate the images, send them back as the zip name shown.

## Changing things
- Base prompts per template: `public/templates.js` (`[DARK] [MAIN] [ACCENT]` = colour slots).
- Claude model: ⚙ Settings in the tool (default `claude-sonnet-4-5`).
