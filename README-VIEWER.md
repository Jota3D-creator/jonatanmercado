# Viewer V4 update

Replace these files in the repository root:

- index.html
- styles.css
- viewer.js (new)

The asset paths used by the viewer are:

TONSTAD
- assets/models/Tonstad/Model_Tonstad_FINAL.glb
- assets/models/Tonstad/WOOD/Model_Tonstad_WOOD_BaseColor.png
- assets/models/Tonstad/WOOD/Model_Tonstad_WOOD_Normal.png
- assets/models/Tonstad/WOOD/Model_Tonstad_WOOD_Roughness.png
- assets/models/Tonstad/WOOD/Tonstad_AO.png
- same filenames under assets/models/Tonstad/WHITE/

HAUGA
- assets/models/Hauga/Almacenamiento_Hauga.glb

Debug mode:
Add ?viewerDebug=1 to the page URL.
Example:
https://jota3d-creator.github.io/jonatanmercado/?viewerDebug=1

Debug mode shows the node, material and animation names detected inside each GLB.
If doors/drawers remain disabled or move on the wrong axis, send a screenshot of that debug panel and the PRODUCT_CONFIG block can be mapped exactly without re-exporting the model.


## HAUGA exact mapping (from uploaded Almacenamiento_Hauga.glb)

Detected nodes:
- anim_Cajon 1
- anim_Cajon 2
- anim_Cajon 3
- door_Puerta 1
- door_Puerta 2
- door_Puerta 3
- door_Puerta 4

Detected authored animations:
- door_Puerta 1Action — hinged door, +90°
- door_Puerta 2Action — hinged door, -90°
- door_Puerta 1Action.002 — sliding door, X 0.322697 → -0.177303
- door_Puerta 1Action.003 — sliding door, X -0.177955 → 0.323045

The drawers have no authored animation in the GLB. viewer.js maps the three exact drawer node names and translates them +0.34 m on local Z.

Glass diagnosis:
- Material: GLASS_HAUGA
- Source alpha mode: BLEND
- baseColorFactor alpha: ~0.268
- the reused BaseColor atlas also contains alpha values 0 / 10 / 255

That means source factor alpha and texture alpha multiply together, making some window pixels almost fully invisible and creating unstable sorting. viewer.js replaces GLASS_HAUGA at runtime with MeshPhysicalMaterial transmission glass and ignores the atlas alpha channel.


## V5 page/layout changes
- HAUGA path now points to `assets/models/Hauga/Almacenamiento_Hauga.glb`.
- Hero vertical whitespace reduced.
- Product images aligned at the same top edge.
- Explanatory copy moved into bordered information cards.
- Hard-surface character is displayed uncropped / full-body.
- Tools & Systems expanded into six production-bottleneck case cards, without client or brand references.


## V6 image presentation
- Product imagery expanded to a wider 1460px editorial grid.
- Chair and faucet are top-aligned.
- The product caption is now a lighter editorial note instead of a boxed rectangle.
- The robot hero has exactly the same width as its two detail images combined.
- Portfolio imagery gets a subtle hover treatment and click-to-open full-screen gallery.
- Full-screen gallery supports next/previous, Escape, arrow keys, and Fit/Actual-size zoom.
- New root file: `gallery.js`.


## V6.1 — HAUGA motion correction

The uploaded `Almacenamiento_Hauga.glb` was inspected directly.

Authored door animations:
- `door_Puerta 1Action` → rotation / hinged door
- `door_Puerta 2Action` → rotation / hinged door
- `door_Puerta 1Action.002` → translation / sliding door
- `door_Puerta 1Action.003` → translation / sliding door

The previous viewer grouped all four under one `Doors` control, which mixed rotations and translations.

V6.1 exposes:
- Sliding doors
- Hinged doors
- Drawers

The three drawers are not animated in the source GLB. Their manual opening distance was reduced from 0.34 m to 0.22 m.


## V6.2 — embedded animations only

The viewer no longer changes any door or drawer transform manually.

All interaction is now generated exclusively by animation clips embedded in each GLB:
- hinged doors: clips targeting quaternion rotation
- sliding doors: clips targeting position
- drawers: clips whose animation or target node names contain drawer / cajon / cajón / gaveta

If a product does not contain one of those animation types, that UI control is hidden automatically.

The `Almacenamiento_Hauga.glb` attached during development contains four embedded animation clips, all for doors. No drawer animation clips are present in that exact uploaded file, so the drawer control will be hidden for it. If the GLB in the repository is updated with drawer clips, the control will appear automatically with no code change.

No procedural fallback remains.


## V6.3 — tactile viewer + original HAUGA materials
- HAUGA no longer applies fake Light/Dark tints. It keeps the materials exported in the GLB.
- Glass is the only runtime material correction: neutral physical transmission glass, transmission 0.90, roughness 0.09, no packed atlas alpha.
- Door/drawer movement still comes only from embedded GLB clips.
- Tap/click on an animated door or drawer now toggles that specific animation.
- Orbit drag does not trigger animations; taps are separated from drags by movement/time thresholds.
- Group sliders and Open All / Close All remain available.
- Drawer detection now also recognizes `cajonera`.

Important: the exact `Almacenamiento_Hauga.glb` uploaded in this conversation exposes four animation clips in its glTF JSON, all targeting door nodes. If the GitHub copy contains an additional drawer clip, V6.3 will detect it automatically from either its clip name or target node name and show the drawer control. If the drawer control does not appear online, the deployed GLB itself does not contain that clip.


## V6.4 — lamp image compare
- The main lamp image is now an interactive clay/final comparison.
- Drag the divider with mouse or touch.
- The component also uses an invisible native range input for keyboard accessibility.
- Clay asset path: `assets/images/product-visualization-lamp-clay-01.png`.
- The compare image is excluded from the fullscreen gallery so dragging never opens the lightbox.
- New root file: `compare.js`.


## V6.5 — alignment, drawer detection, HAUGA material & focus zoom
- Product imagery and Interactive 3D now use the same 1460px editorial grid.
- Viewer cards are closer together and slightly shorter.
- Double tap / double click a model part to smoothly focus the camera on it; Reset View returns home.
- Animated parts still toggle with a single tap/click and use only embedded GLB clips.
- Any unclassified position-only embedded animation is promoted to the Drawers group. This catches generic Blender Action names without manually moving geometry.
- HAUGA now exposes WOOD / WHITE. The WHITE variant follows the exported glTF WHITE definition: BaseColor texture removed, exported baseColorFactor retained, non-color maps preserved.
- HAUGA glass is clearer: opacity 0.12, depthWrite false, low roughness.


## V6.6 — anim_Cajon fallback + high-resolution lens
- The supplied `Almacenamiento_Hauga.glb` contains nodes `anim_Cajon 1`, `anim_Cajon 2`, `anim_Cajon 3`, but no AnimationClips target those nodes. The file contains four clips and all four target doors.
- V6.6 therefore keeps embedded animation clips as the first choice, but adds a narrow runtime fallback only for nodes whose names explicitly match drawer/cajon/gaveta patterns and have no embedded animation target.
- Drawer travel is derived from the actual drawer geometry: 52% of its depth. On the supplied HAUGA this resolves to approximately 0.22 m.
- The same fallback can activate a TONSTAD drawer if its node is named drawer/cajon/etc., without affecting doors or unrelated geometry.
- Portfolio still images now expose a circular high-resolution detail lens on desktop hover. The lens uses the original source pixels and automatically chooses up to 2.6x magnification based on available resolution.
- New root file: `magnifier.js`.


## V6.7 — strict visual grid + scale / leadership positioning
- Lamp compare, chair/faucet row and atmospheric interior now share one 1460px editorial grid.
- Chair and the complete right-hand column align on both the top and bottom edges.
- Gaps between the product images are reduced to 12px.
- Existing high-resolution circular magnifier remains active on portfolio stills.
- New Scale & Direction section explains team leadership, high-volume 3D production and AI-training dataset pipelines without naming clients or brands.
- Hero/About copy now reflects both hands-on art direction and leadership of artist teams.
- HAUGA drawer fallback now maps the exact inspected nodes:
  - anim_Cajon 1
  - anim_Cajon 2
  - anim_Cajon 3
  Each moves +0.22m on local Z. Door animation remains driven by the embedded GLB clips.


## V6.8 — drawer range, HAUGA node lookup, RMB pan, larger magnifier
- Drawer opening is reduced by 50%.
  - Embedded drawer clips (e.g. TONSTAD) use only the first 50% of the authored animation.
  - HAUGA `anim_Cajon 1/2/3` fallback distance is reduced from 0.22m to 0.11m.
- Fixed HAUGA drawer lookup after Three.js/GLTFLoader node-name sanitization by normalizing spaces/underscores and punctuation.
- Right mouse button drag now pans the 3D camera. Left drag orbits, middle wheel/button zooms/dollies.
- Browser context menu is disabled only over the viewer canvas so RMB pan works naturally.
- High-resolution detail lens doubled from 176px to 352px.
- Maximum true-detail magnification increased 50%, from 2.6× to 3.9×, capped by the actual source-image resolution.


## V6.9 — custom domain + public contact
- `Get in touch` now opens `hello@jonatanmercado.com`.
- Added root `CNAME` with `jonatanmercado.com`.
- Added a complete root `script.js` for reveal animations, header behavior, year and smooth navigation.
- `hello@jonatanmercado.com` is expected to forward to `mercado_jonatan@hotmail.com` through the configured mail-forwarding DNS.


## V6.10 — mobile pass
- Strange Planet and Architectural Visualization headers stack correctly on phones.
- About becomes a clean single-column mobile layout with a compact logo/name lockup.
- Mobile viewer controls move below the WebGL viewport rather than covering the model.
- Mobile Three.js memory/performance improvements:
  - lazy viewer initialization near the viewport
  - TONSTAD alternate finish textures load only when selected
  - DPR capped at 1.15
  - antialiasing and shadows disabled on mobile
  - autorotation disabled on mobile
  - offscreen viewers stop rendering
- Mobile typography and vertical spacing are explicitly constrained for 360–700px widths.


## V6.11 — contact spacing
- Desktop contact section reduced from ~76svh to 58svh.
- Top/bottom padding tightened.
- Footer gap reduced so the CTA no longer floats inside a large empty field.
- Mobile contact spacing from V6.10 remains unchanged.


## V6.12 — selected clients & collaborations
- Added a restrained logo strip between the statement and selected work.
- Label: `Selected clients & collaborations` to cover both direct clients and work delivered through partner studios/agencies.
- Marks included:
  - Paramount Pictures
  - Audi
  - Industrial Light & Magic
  - CHANEL
  - 4D Pipeline
  - Lithodomos
- Paramount, Audi, ILM and CHANEL currently use SVG CDN references from Worldvectorlogo.
- 4D Pipeline and Lithodomos use restrained typographic wordmarks because a reliable downloadable official vector asset was not located.
- The strip is monochrome and optical-height normalized, with a 3-column tablet layout and 2-column mobile layout.
- Brand marks remain trademarks of their respective owners; verify that each relationship can be publicly disclosed under the relevant NDA/contract.


## V6.13 — social/link preview metadata
- Added canonical URL for `https://jonatanmercado.com/`.
- Added Open Graph metadata for link previews.
- Preview title: `Jonatan Mercado — 3D Art Director & CG Lead`.
- Preview description emphasizes photoreal visualization, interactive 3D, real-time graphics and scalable production systems.
- Preview image explicitly points to the lamp render with a version query (`?v=20260907`) to help invalidate old cached previews.
- Added Twitter/X large-image card metadata.


## V6.14 — client logo strip fix
- Removed the external Worldvectorlogo SVG dependencies that were rendering as incorrect blocks/ovals in-browser.
- The entire clients strip is now self-contained in HTML/CSS.
- Audi rings are drawn locally with CSS.
- Paramount, ILM, CHANEL, 4D Pipeline and Lithodomos use restrained local typographic lockups.
- No third-party logo requests are required, so the strip is more reliable and removes `cdn.worldvectorlogo.com` from the page.


## V6.15 — 2026 showreel
- Updated the site-wide showreel to the 2026 reel:
  `https://www.youtube.com/watch?v=4j6Dr0Pi3mg`
- Updated the embedded privacy-enhanced YouTube player.
- Updated both Reel links in the Showreel and Contact sections.
