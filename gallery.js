(() => {
  const selector = [
    "#work .media img",
    ".case-dark .media img",
    ".case-video + .case-archviz .media img"
  ].join(",");

  const images = [...document.querySelectorAll(selector)].filter((img) => {
    return (
      !img.closest(".viewer-card") &&
      !img.closest("[data-compare]") &&
      img.naturalWidth !== 0
    );
  });

  if (!images.length) return;

  images.forEach((img, index) => {
    const figure = img.closest(".media");
    if (!figure) return;

    figure.classList.add("zoomable-media");
    figure.dataset.galleryIndex = String(index);
    figure.tabIndex = 0;
    figure.setAttribute("role", "button");
    figure.setAttribute("aria-label", `${img.alt || "Portfolio image"} — open full view`);

    const badge = document.createElement("span");
    badge.className = "zoom-badge";
    badge.setAttribute("aria-hidden", "true");
    badge.innerHTML = "<span>View</span><b>+</b>";
    figure.appendChild(badge);

    const open = () => openLightbox(index);
    figure.addEventListener("click", open);
    figure.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });
  });

  const overlay = document.createElement("div");
  overlay.className = "portfolio-lightbox";
  overlay.setAttribute("aria-hidden", "true");
  overlay.innerHTML = `
    <div class="portfolio-lightbox-bar">
      <div class="portfolio-lightbox-meta">
        <span class="portfolio-lightbox-counter"></span>
        <span class="portfolio-lightbox-title"></span>
      </div>
      <div class="portfolio-lightbox-actions">
        <button type="button" data-lightbox-action="zoom">Actual size</button>
        <button type="button" data-lightbox-action="close">Close</button>
      </div>
    </div>

    <button class="portfolio-lightbox-nav portfolio-lightbox-prev" type="button" data-lightbox-action="prev" aria-label="Previous image">←</button>

    <div class="portfolio-lightbox-stage">
      <img class="portfolio-lightbox-image" alt="" />
    </div>

    <button class="portfolio-lightbox-nav portfolio-lightbox-next" type="button" data-lightbox-action="next" aria-label="Next image">→</button>
  `;
  document.body.appendChild(overlay);

  const stage = overlay.querySelector(".portfolio-lightbox-stage");
  const lightboxImage = overlay.querySelector(".portfolio-lightbox-image");
  const counter = overlay.querySelector(".portfolio-lightbox-counter");
  const title = overlay.querySelector(".portfolio-lightbox-title");
  const zoomButton = overlay.querySelector('[data-lightbox-action="zoom"]');

  let currentIndex = 0;
  let zoomed = false;
  let previousFocus = null;

  function render() {
    const source = images[currentIndex];

    zoomed = false;
    lightboxImage.classList.remove("is-zoomed");
    zoomButton.textContent = "Actual size";

    lightboxImage.src = source.currentSrc || source.src;
    lightboxImage.alt = source.alt || "Portfolio image";
    counter.textContent = `${String(currentIndex + 1).padStart(2, "0")} / ${String(images.length).padStart(2, "0")}`;
    title.textContent = source.alt || "Selected work";
    stage.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }

  function openLightbox(index) {
    currentIndex = index;
    previousFocus = document.activeElement;
    render();

    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    document.documentElement.classList.add("lightbox-open");

    overlay.querySelector('[data-lightbox-action="close"]').focus({ preventScroll: true });
  }

  function closeLightbox() {
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    document.documentElement.classList.remove("lightbox-open");

    if (previousFocus && typeof previousFocus.focus === "function") {
      previousFocus.focus({ preventScroll: true });
    }
  }

  function step(direction) {
    currentIndex = (currentIndex + direction + images.length) % images.length;
    render();
  }

  function toggleZoom() {
    zoomed = !zoomed;
    lightboxImage.classList.toggle("is-zoomed", zoomed);
    zoomButton.textContent = zoomed ? "Fit image" : "Actual size";

    if (!zoomed) {
      stage.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    }
  }

  overlay.addEventListener("click", (event) => {
    const action = event.target.closest("[data-lightbox-action]")?.dataset.lightboxAction;

    if (action === "close") closeLightbox();
    if (action === "prev") step(-1);
    if (action === "next") step(1);
    if (action === "zoom") toggleZoom();

    if (event.target === overlay) closeLightbox();
  });

  lightboxImage.addEventListener("click", toggleZoom);

  window.addEventListener("keydown", (event) => {
    if (!overlay.classList.contains("is-open")) return;

    if (event.key === "Escape") closeLightbox();
    if (event.key === "ArrowLeft") step(-1);
    if (event.key === "ArrowRight") step(1);
  });
})();