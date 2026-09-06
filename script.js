const reveal = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in');
      reveal.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach(el => reveal.observe(el));
document.getElementById('year').textContent = new Date().getFullYear();

let lastY = 0;
const header = document.querySelector('.site-header');
window.addEventListener('scroll', () => {
  const y = window.scrollY;
  header.classList.toggle('hidden', y > lastY && y > 140);
  lastY = y;
}, { passive: true });
