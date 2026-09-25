# Nabvisions.com website

Premium one-page agency site with a real-time 3D scene (Three.js):
- **Hero:** floating 3D monitor + phones playing animated content, reacting to mouse and scroll.
- **Process:** a pinned scroll scene where the 3D monitor walks through Script → Voiceover → Edit → Thumbnail → Publish.
- Smooth scrolling (Lenis), word-by-word headline reveals, custom cursor, magnetic buttons, 3D tilt cards.
- Lighter on phones (fewer particles, lower resolution, no custom cursor), honours "reduce motion", and falls back gracefully without WebGL.

## Files
| File | What it is |
|---|---|
| `index.html` | Page content (all text lives here) |
| `styles.css` | Design |
| `config.js` | **Your settings**: email, WhatsApp, booking link, form endpoint, video clips, client results, socials. No rebuild needed. |
| `src/` | 3D scene and interaction source code |
| `assets/app.js` | Built bundle of `src/` (committed, so hosting needs no build step) |

## Editing the 3D / JS code
```bash
cd website
npm install
npm run build     # rebuilds assets/app.js
python3 -m http.server 8000   # preview at http://localhost:8000
```
The page must be served over http(s); opening `index.html` directly from disk won't load the 3D module.

## Adding your own clips to the 3D screens
Put compressed, muted MP4s (under 3 MB each) in `assets/clips/` and list them in `config.js`:
`clips: ["assets/clips/short-1.mp4", "assets/clips/longform.mp4", "assets/clips/short-2.mp4"]`
(left phone 9:16, big screen 16:9, right phone 9:16).

## Deploy (Netlify, free)
1. netlify.com → Add new site → Import from GitHub → pick this repo.
2. Base directory: `website`, build command: empty, publish directory: `website`.
3. Domain management → Add domain `nabvisions.com`, then add the DNS records Netlify shows
   at your domain registrar (an A record for `@` and a CNAME for `www`).
4. HTTPS is issued automatically once DNS resolves.
