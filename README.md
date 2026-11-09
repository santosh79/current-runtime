# Current website

A static, single-page project site for Current. Everything it needs is in this directory: no build step, no package installation, no tracking, no backend, and no requests to other hosts. Fonts are served from `fonts/`.

## Files

- `index.html`: content, metadata, navigation, the walkthrough markup, and a static transcript shown when JavaScript is off.
- `styles.css`: layout, type and colour; responsive down to 360px; focus states; reduced-motion support.
- `script.js`: the interactive walkthrough (approve, send back, reject, apply) and the copy buttons. It replays a workflow in the browser and makes no network requests. Commit-log hashes are real SHA-256 from Web Crypto; where Web Crypto is unavailable the blocks show no hash rather than a substitute.
- `favicon.svg`: the wave mark.
- `fonts/`: Schibsted Grotesk (variable) and Martian Mono, Latin subset, with their SIL Open Font License files.

## Preview

Serve the directory with any static server, for example from the repository root:

```sh
python3 -m http.server 8080 --directory web
```

Then open http://localhost:8080. Opening `index.html` straight from disk also works, though some browsers block local font files that way and fall back to system fonts.

## Deploy to your domain

1. Publish this directory as the document root on any static host (GitHub Pages, Cloudflare Pages, Netlify, S3 and similar). There is no build command; the entry point is `index.html`.
2. Add your domain in the host's dashboard and create the DNS records it asks for. Never point the website at Current's local runtime API.
3. Turn on HTTPS.
4. In `index.html`, replace the commented canonical and `og:url` placeholder with your real domain.

All asset paths are relative, so the site also works under a path prefix.

## Content

Copy and setup instructions come from the repository README and `docs/threat_model.md`.

The walkthrough replays a real proposal Current produced for `examples/nextjs-auth` ("add rate limiting to the login endpoint", proposal `sha256:884ec559ec2e`): its justification, its four edits (shown as diffs under "View proposed changes") and its report are verbatim. The files the model reads, the timings, the revision (which adds `npm test` and a claim), and the commit hashes are simulated. The commit-log blocks chain real SHA-256 hashes computed in the browser, but over a JSON stand-in, not Current's canonical commit encoding; the page says so. The walkthrough is not connected to a runtime.

To show a different proposal, update the diff markup in `index.html` (inside `#changes`) and the `PROPOSALS` data in `script.js` together. Never embed provider keys in the site or expose Current's unauthenticated HTTP or MCP endpoints to make the demo live.

When the README changes (new intents, roadmap items, setup steps), update the matching sections here: the intents table, "Works today" and "Planned", and the quickstart.

## Checked before handoff

Tested in headless Chromium, served over HTTP:

- 375px, 820px and 1440px wide: no horizontal overflow, no console errors, no requests to other hosts.
- All three walkthrough paths: send back then approve and apply; approve and apply; reject. The review panel stays hidden until a proposal exists and gains the revision's command and claim after a send-back.
- Web Crypto removed: the commit log shows no hashes and says why.
- JavaScript disabled: the static transcript and the first proposal's changes show; the walkthrough buttons stay hidden.

Not yet checked: real Safari and Firefox, a screen reader pass, and 200% zoom.
