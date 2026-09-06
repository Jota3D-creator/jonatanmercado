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
