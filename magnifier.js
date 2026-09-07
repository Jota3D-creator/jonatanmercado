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

  let activeTouchFigure = null;

  const hideActiveTouchLens = () => {
    if (!activeTouchFigure) return;
    activeTouchFigure.__hideTouchLens?.();
    activeTouchFigure = null;
  };

  figures.forEach((figure) => {
    const img = figure.querySelector(":scope > img");
    if (!img) return;

    let lens = null;
    let zoom = 2.4;
    let touchPinned = false;
    let touchMoved = false;
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastY = 0;
    let suppressNextClick = false;

    // Stop iOS/Android image callouts and context menus on these portfolio images.
    img.draggable = false;
    img.setAttribute("draggable", "false");

    figure.addEventListener("contextmenu", (event) => {
      if (!isTouchDevice) return;
      event.preventDefault();
    });

    img.addEventListener("contextmenu", (event) => {
      if (!isTouchDevice) return;
      event.preventDefault();
    });

    const buildLens = () => {
      if (lens) return;

      const rect = img.getBoundingClientRect();
      if (!rect.width || !rect.height || !img.naturalWidth || !img.naturalHeight) {
        return;
      }

      const availableZoomX = img.naturalWidth / rect.width;
      const availableZoomY = img.naturalHeight / rect.height;
      const availableZoom = Math.min(availableZoomX, availableZoomY);

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

      let left = clientX - figureRect.left;
      let top = clientY - figureRect.top;

      if (isTouchDevice) {
        // Lift the loupe above the fingertip so the inspected area stays visible.
        top -= Math.min(92, lensSize * 0.40);
      }

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
      figure.classList.add("is-touch-loupe-active");
      updateLens(clientX, clientY);
    };

    const hideLens = () => {
      touchPinned = false;
      figure.classList.remove("is-touch-loupe-active");
      lens?.classList.remove("is-visible");
    };

    figure.__hideTouchLens = hideLens;

    if (isTouchDevice) {
      // Mobile interaction:
      // 1) Tap once to activate the loupe.
      // 2) Drag to inspect while it is active.
      // 3) Tap again (or tap elsewhere) to close it.
      // No long-press is used, avoiding the native iOS/Android context menu.
      figure.addEventListener(
        "touchstart",
        (event) => {
          if (event.touches.length !== 1) return;

          const touch = event.touches[0];
          startX = lastX = touch.clientX;
          startY = lastY = touch.clientY;
          touchMoved = false;

          if (touchPinned) {
            // Once the loupe is active, this gesture belongs to the loupe.
            event.preventDefault();
            updateLens(touch.clientX, touch.clientY);
          }
        },
        { passive: false }
      );

      figure.addEventListener(
        "touchmove",
        (event) => {
          if (event.touches.length !== 1) return;

          const touch = event.touches[0];
          lastX = touch.clientX;
          lastY = touch.clientY;

          const distance = Math.hypot(lastX - startX, lastY - startY);
          if (distance > 9) touchMoved = true;

          if (!touchPinned) {
            // Normal swipe: allow the page to scroll.
            return;
          }

          event.preventDefault();
          updateLens(touch.clientX, touch.clientY);
        },
        { passive: false }
      );

      figure.addEventListener(
        "touchend",
        (event) => {
          if (!touchPinned) {
            // A clean tap activates the loupe. A swipe remains normal page scroll.
            if (!touchMoved) {
              hideActiveTouchLens();
              touchPinned = true;
              activeTouchFigure = figure;
              suppressNextClick = true;
              showLens(startX, startY);
            }
            return;
          }

          // If already active: a tap closes it; a drag leaves it visible.
          if (!touchMoved) {
            suppressNextClick = true;
            hideLens();
            if (activeTouchFigure === figure) activeTouchFigure = null;
          } else {
            updateLens(lastX, lastY);
          }
        },
        { passive: true }
      );

      figure.addEventListener("touchcancel", () => {
        touchMoved = false;
      }, { passive: true });

      // Prevent the gallery/lightbox click generated after a loupe tap.
      figure.addEventListener(
        "click",
        (event) => {
          if (!suppressNextClick) return;
          event.preventDefault();
          event.stopImmediatePropagation();
          suppressNextClick = false;
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

  if (isTouchDevice) {
    document.addEventListener(
      "touchstart",
      (event) => {
        if (!activeTouchFigure) return;
        if (activeTouchFigure.contains(event.target)) return;
        hideActiveTouchLens();
      },
      { passive: true, capture: true }
    );
  }
})();
