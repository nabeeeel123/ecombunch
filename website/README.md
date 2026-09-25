# Nabvisions.com website

Static site (HTML/CSS/JS, no build step): `index.html`, `styles.css`, `script.js`.

## Edit before launch
- `script.js` → `CONTACT_EMAIL`, `FORM_ENDPOINT` (free at formspree.io), and `portfolio` (real client results only).
- `index.html` → plan contents, FAQ answers, contact details.

## Deploy (Netlify, free)
1. netlify.com → Add new site → Import from GitHub → pick this repo.
2. Base directory: `website`, build command: empty, publish directory: `website`.
3. Domain management → Add domain `nabvisions.com`, then add the DNS records Netlify shows
   at your domain registrar (an A record for `@` and a CNAME for `www`).
4. HTTPS is issued automatically once DNS resolves.
