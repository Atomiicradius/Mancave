# Deploying

The build is a plain static site (`npm run build` -> `dist/`). It uses relative URLs, so it works from a domain root
or a sub-path (e.g. `https://you.github.io/garage/`). Tested both ways with `vite preview` and a sub-path server.

## Before you publish: checklist
- [ ] Set `PORTFOLIO_URL` in `src/config.js` (still `https://example.com`).
- [ ] Fill in the turntable's author / source / licence in `src/credits.js` and `CREDITS.md` (currently "credit pending").
- [ ] Replace the placeholder tracks/covers: `public/audio/<name>.mp3`, `public/covers/<name>.jpg`, titles in `src/assets.js`.
      Only publish music you own or have the rights to.
- [ ] Licences: the NSX model is **CC BY-NC-SA 4.0 (non-commercial)** — fine for a personal, non-commercial site with the
      credit shown; not for anything commercial. Stockfish is **GPL-3.0** (source link is in the credits panel).

## Options
**GitHub Pages** — run `.github/workflows/deploy.yml` from the repo's Actions tab (manual trigger for now; add a `push:` trigger to auto-publish).
Enable once: Settings -> Pages -> Source: GitHub Actions.

**Netlify / Vercel** — import the repo; build command `npm run build`, output directory `dist`. No other config needed.

**Manual** — `npm run build`, then upload the contents of `dist/` to any static host.

Local check of the production build: `npm run build && npm run preview`.
