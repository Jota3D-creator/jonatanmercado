# Jonatan Mercado — Portfolio V1

A single-page portfolio concept focused on Art Direction, real-time visualization and scalable 3D production systems.

https://jota3d-creator.github.io/jonatanmercado/

## Files
- `index.html` — main page
- `styles.css` — all layout / visual styling
- `script.js` — reveal animation + navigation behavior
- `viewer-demo.html` — lightweight interactive stand-in for the production Three.js viewer

## Important before publishing

### 1) Connect the real Three.js viewer
The current embedded `viewer-demo.html` is only a self-contained interaction mock for this V1.

Recommended final architecture:
- `jonatanmercado.com` → portfolio site
- `viewer.jonatanmercado.com` → production Three.js viewer

When the production viewer is live, replace:

```html
<iframe title="Interactive product viewer demo" src="viewer-demo.html" loading="lazy"></iframe>
```

with:

```html
<iframe title="Interactive product viewer" src="https://viewer.jonatanmercado.com" loading="lazy"></iframe>
```

If the viewer blocks iframe embedding through headers, keep a preview image/video in this slot and link the CTA to the subdomain instead.

### 2) Replace generated visual placeholders with actual work
The work section is intentionally laid out and styled already, but the project visuals are graphic placeholders. Replace them with your strongest renders / stills / short loops while preserving the existing card dimensions.

Suggested first pass:
- Interactive Product Viewer
- Scalable Production / Pipeline case study
- Strange Planet
- Knuckles / production-previz work

### 3) Contact
The current CTA points to the existing `jonatanmercado.com/contact`. When the new domain replaces the current ArtStation site, change that CTA to your preferred email or contact form.

### 4) Showreel
The reel is already embedded from:
`https://youtu.be/ae_JPEpZCVo`

## Deployment
This is a static site. It can be deployed directly to Netlify, Vercel, GitHub Pages, Cloudflare Pages, or any standard web host.
