(() => {
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  const figures = [...document.querySelectorAll("#work .media")]
    .filter((figure) => !figure.matches(".compare-media") && !figure.closest("[data-compare]"));

  figures.forEach((figure) => {
    const img = figure.querySelector(":scope > img");
    if (!img) return;

    const setup = () => {
      const rect = img.getBoundingClientRect();
      if (!rect.width || !img.naturalWidth) return;

      // Only show a lens when the source contains meaningfully more detail
      // than the on-page presentation size.
      const availableZoom = img.naturalWidth / rect.width;
      if (availableZoom < 1.18) return;

      const zoom = Math.min(2.6, availableZoom);

      figure.classList.add("has-detail-lens");

      const lens = document.createElement("div");
      lens.className = "detail-lens";
      lens.setAttribute("aria-hidden", "true");
      lens.innerHTML = `<span class="detail-lens-ratio">${zoom.toFixed(1)}×</span>`;
      figure.appendChild(lens);

      const update = (event) => {
        const imageRect = img.getBoundingClientRect();
        const x = Math.max(0, Math.min(imageRect.width, event.clientX - imageRect.left));
        const y = Math.max(0, Math.min(imageRect.height, event.clientY - imageRect.top));

        const lensSize = lens.offsetWidth || 168;
        const half = lensSize / 2;

        lens.style.left = `${x}px`;
        lens.style.top = `${y}px`;
        lens.style.backgroundImage = `url("${img.currentSrc || img.src}")`;
        lens.style.backgroundSize = `${imageRect.width * zoom}px ${imageRect.height * zoom}px`;
        lens.style.backgroundPosition = `${half - x * zoom}px ${half - y * zoom}px`;
      };

      figure.addEventListener("pointerenter", (event) => {
        lens.classList.add("is-visible");
        update(event);
      });

      figure.addEventListener("pointermove", update);

      figure.addEventListener("pointerleave", () => {
        lens.classList.remove("is-visible");
      });
    };

    if (img.complete) setup();
    else img.addEventListener("load", setup, { once: true });
  });
})();