(() => {
  const isTouchDevice =
    window.matchMedia("(pointer: coarse)").matches ||
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0;

  const figures = [...document.querySelectorAll("#work .media")].filter(
    (figure) =>
      !figure.matches(".compare-media") &&
      !figure.closest("[data-compare]")
  );

  figures.forEach((figure) => {
    const img = figure.querySelector(":scope > img");
    if (!img) return;

    let lens = null;
    let zoom = 2.4;
    let holdTimer = null;
    let touchActive = false;
    let startX = 0;
    let startY = 0;
    let lastTouch = null;
    let suppressClick = false;

    const buildLens = () => {
      if (lens) return;

      const rect = img.getBoundingClientRect();
      if (!rect.width || !rect.height || !img.naturalWidth || !img.naturalHeight) {
        return;
      }

      const availableZoomX = img.naturalWidth / rect.width;
      const availableZoomY = img.naturalHeight / rect.height;
      const availableZoom = Math.min(availableZoomX, availableZoomY);

      // Always enable on touch. If the source has limited native resolution,
      // keep the zoom conservative rather than disabling the interaction.
      zoom = isTouchDevice
        ? Math.max(1.6, Math.min(2.8, availableZoom || 2.2))
        : Math.max(1.6, Math.min(3.9, availableZoom || 2.6));

      figure.classList.add("has-detail-lens");

      lens = document.createElement("div");
      lens.className = "detail-lens";
      lens.setAttribute("aria-hidden", "true");
      lens.innerHTML = `<span class="detail-lens-ratio">${zoom.toFixed(1)}×</span>`;
      figure.appendChild(lens);
    };

    const updateLens = (clientX, clientY) => {
      buildLens();
      if (!lens) return;

      const imageRect = img.getBoundingClientRect();
      const figureRect = figure.getBoundingClientRect();

      const xInImage = Math.max(
        0,
        Math.min(imageRect.width, clientX - imageRect.left)
      );
      const yInImage = Math.max(
        0,
        Math.min(imageRect.height, clientY - imageRect.top)
      );

      const lensSize = lens.offsetWidth || (isTouchDevice ? 220 : 352);
      const half = lensSize / 2;

      // Position relative to the figure, not the page.
      let left = clientX - figureRect.left;
      let top = clientY - figureRect.top;

      if (isTouchDevice) {
        // Lift the lens above the finger, like a text-selection loupe.
        top -= Math.min(105, lensSize * 0.42);
      }

      // Keep the lens inside the image so it never gets clipped away.
      left = Math.max(half + 6, Math.min(figureRect.width - half - 6, left));
      top = Math.max(half + 6, Math.min(figureRect.height - half - 6, top));

      lens.style.left = `${left}px`;
      lens.style.top = `${top}px`;
      lens.style.backgroundImage = `url("${img.currentSrc || img.src}")`;
      lens.style.backgroundSize = `${imageRect.width * zoom}px ${imageRect.height * zoom}px`;
      lens.style.backgroundPosition = `${half - xInImage * zoom}px ${half - yInImage * zoom}px`;
    };

    const showLens = (clientX, clientY) => {
      buildLens();
      if (!lens) return;
      lens.classList.add("is-visible");
      updateLens(clientX, clientY);
    };

    const hideLens = () => {
      if (holdTimer) {
        clearTimeout(holdTimer);
        holdTimer = null;
      }
      touchActive = false;
      lastTouch = null;
      lens?.classList.remove("is-visible");
    };

    if (isTouchDevice) {
      // Use native touch events on phones/iOS. Pointer Events can be cancelled
      // by Safari while the page is deciding whether the gesture is a scroll.
      figure.addEventListener(
        "touchstart",
        (event) => {
          if (event.touches.length !== 1) return;

          const touch = event.touches[0];
          startX = touch.clientX;
          startY = touch.clientY;
          lastTouch = touch;
          suppressClick = false;

          if (holdTimer) clearTimeout(holdTimer);

          // Short hold lets a normal swipe still scroll the page.
          holdTimer = window.setTimeout(() => {
            touchActive = true;
            suppressClick = true;
            showLens(touch.clientX, touch.clientY);
          }, 170);
        },
        { passive: true }
      );

      figure.addEventListener(
        "touchmove",
        (event) => {
          if (event.touches.length !== 1) {
            hideLens();
            return;
          }

          const touch = event.touches[0];
          lastTouch = touch;

          if (!touchActive) {
            const dx = touch.clientX - startX;
            const dy = touch.clientY - startY;

            // User is scrolling: cancel the long-press activation.
            if (Math.hypot(dx, dy) > 12 && holdTimer) {
              clearTimeout(holdTimer);
              holdTimer = null;
            }
            return;
          }

          // Once the loupe is active, drag controls the loupe instead of scroll.
          event.preventDefault();
          updateLens(touch.clientX, touch.clientY);
        },
        { passive: false }
      );

      figure.addEventListener("touchend", hideLens, { passive: true });
      figure.addEventListener("touchcancel", hideLens, { passive: true });

      // Prevent the gallery/lightbox click that can fire after a long press.
      figure.addEventListener(
        "click",
        (event) => {
          if (!suppressClick) return;
          event.preventDefault();
          event.stopImmediatePropagation();
          suppressClick = false;
        },
        true
      );
    } else {
      figure.addEventListener("pointerenter", (event) => {
        showLens(event.clientX, event.clientY);
      });

      figure.addEventListener("pointermove", (event) => {
        if (!lens?.classList.contains("is-visible")) return;
        updateLens(event.clientX, event.clientY);
      });

      figure.addEventListener("pointerleave", hideLens);
    }

    if (img.complete) buildLens();
    else img.addEventListener("load", buildLens, { once: true });
  });
})();
