# Amazon product photo downloader

`download-amazon-photos.js` opens Amazon search results in a headless Chromium
browser (Playwright), grabs the product photos for a few search terms, and
saves them as full-size images into the `download/` folder at the repo root,
along with a `manifest.json` describing each photo (search term, product
title, source URL).

## Run it

```bash
node scripts/download-amazon-photos.js
```

Requires Node.js and Playwright with Chromium (`npm i playwright` if it is not
installed globally).

Edit the `SEARCHES` and `PER_SEARCH` constants at the top of the script to
change which products are fetched and how many photos per search.

## Note on network access

If you run this in a Claude Code cloud session, the environment's network
policy must allow `www.amazon.com` and `m.media-amazon.com` (choose full
network access, or add those domains to the allowlist in the environment
settings at claude.ai/code). With the default trusted-domains policy the
requests are blocked by the proxy with HTTP 403.
