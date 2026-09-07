(() => {
  const isTouch = window.matchMedia("(pointer: coarse)").matches;

  const figures = [...document.querySelectorAll("#work .media")]
    .filter(
      (figure) =>
        !figure.matches(".compare-media") &&
        !figure.closest("[data-compare]")
    );

  figures.forEach((figure) => {
    const img = figure.querySelector(":scope > img");
    if (!img) return;

    const setup = () => {
      const rect = img.getBoundingClientRect();
      if (!rect.width || !img.naturalWidth) return;

      const availableZoom = img.naturalWidth / rect.width;
      if (availableZoom < 1.18) return;

      const zoom = Math.min(isTouch ? 3.2 : 3.9, availableZoom);

      figure.classList.add("has-detail-lens");

      const lens = document.createElement("div");
      lens.className = "detail-lens";
      lens.setAttribute("aria-hidden", "true");
      lens.innerHTML = `<span class="detail-lens-ratio">${zoom.toFixed(1)}×</span>`;
      figure.appendChild(lens);

      const update = (event) => {
        const imageRect = img.getBoundingClientRect();

        const x = Math.max(
          0,
          Math.min(imageRect.width, event.clientX - imageRect.left)
        );

        const y = Math.max(
          0,
          Math.min(imageRect.height, event.clientY - imageRect.top)
        );

        const lensSize = lens.offsetWidth || (isTouch ? 230 : 352);
        const half = lensSize / 2;

        const lensY = isTouch
          ? Math.max(half + 8, y - 90)
          : y;

        lens.style.left = `${x}px`;
        lens.style.top = `${lensY}px`;
        lens.style.backgroundImage = `url("${img.currentSrc || img.src}")`;
        lens.style.backgroundSize = `${imageRect.width * zoom}px ${imageRect.height * zoom}px`;
        lens.style.backgroundPosition = `${half - x * zoom}px ${half - y * zoom}px`;
      };

      if (isTouch) {
        let activePointer = null;

        figure.addEventListener("pointerdown", (event) => {
          if (event.pointerType !== "touch") return;

          activePointer = event.pointerId;
          lens.classList.add("is-visible");
          update(event);
          figure.setPointerCapture?.(event.pointerId);
        });

        figure.addEventListener("pointermove", (event) => {
          if (
            event.pointerType === "touch" &&
            event.pointerId === activePointer &&
            lens.classList.contains("is-visible")
          ) {
            update(event);
          }
        });

        const hideLens = (event) => {
          if (activePointer !== null && event.pointerId !== activePointer) return;
          lens.classList.remove("is-visible");
          activePointer = null;
        };

        figure.addEventListener("pointerup", hideLens);
        figure.addEventListener("pointercancel", hideLens);
        figure.addEventListener("lostpointercapture", () => {
          lens.classList.remove("is-visible");
          activePointer = null;
        });
      } else {
        figure.addEventListener("pointerenter", (event) => {
          lens.classList.add("is-visible");
          update(event);
        });

        figure.addEventListener("pointermove", update);

        figure.addEventListener("pointerleave", () => {
          lens.classList.remove("is-visible");
        });
      }
    };

    if (img.complete) setup();
    else img.addEventListener("load", setup, { once: true });
  });
})();
