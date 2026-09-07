Jonatan Mercado portfolio — V6.17

Changes in this pass:
- Added touch magnifier on mobile/tablet: press and drag over portfolio stills.
- Mobile lens appears above the finger so the detail remains visible.
- Kept desktop high-resolution magnifier behavior.
- Added visible fallback email under Get in touch: hello@jonatanmercado.com.
- Get in touch remains a mailto link with subject=Project inquiry.
- Carries forward V6.16 fixes: mobile viewer aspect, About alignment/type, header logo contrast, concrete cinematic still, 2026 reel.

V6.18 touch magnifier fix
- Replaced phone magnifier gesture handling with native touchstart/touchmove/touchend.
- 170 ms long-press activates the lens; normal swipes still scroll the page.
- Once active, dragging moves the loupe and prevents the page from scrolling.
- Added iOS/Safari-friendly touch handling and click suppression so the gallery does not open after a long press.
- The lens is constrained inside the image so it cannot disappear behind overflow clipping.
