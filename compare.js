(() => {
  document.querySelectorAll("[data-compare]").forEach((root) => {
    const compare = root.querySelector(".image-compare");
    const range = root.querySelector(".image-compare-range");

    if (!compare || !range) return;

    const setValue = (value) => {
      const clamped = Math.max(0, Math.min(100, Number(value)));
      compare.style.setProperty("--compare-position", `${clamped}%`);
      range.value = String(clamped);
    };

    range.addEventListener("input", () => {
      setValue(range.value);
    });

    const updateFromPointer = (clientX) => {
      const rect = compare.getBoundingClientRect();
      if (!rect.width) return;

      const value = ((clientX - rect.left) / rect.width) * 100;
      setValue(value);
    };

    let dragging = false;

    compare.addEventListener("pointerdown", (event) => {
      dragging = true;
      compare.setPointerCapture?.(event.pointerId);
      updateFromPointer(event.clientX);
    });

    compare.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      updateFromPointer(event.clientX);
    });

    const stop = (event) => {
      dragging = false;
      try {
        compare.releasePointerCapture?.(event.pointerId);
      } catch {}
    };

    compare.addEventListener("pointerup", stop);
    compare.addEventListener("pointercancel", stop);

    // Prevent the gallery lightbox from opening when interacting with the compare.
    root.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    setValue(range.value);
  });
})();