function initGalleryToggle() {
  const gallery   = document.getElementById('gallery');
  const toggleBtn = document.getElementById('galleryToggle');
  if (!gallery || !toggleBtn) return;
  const ROW_HEIGHT = 388;
  let expanded = false;
  gallery.style.maxHeight = gallery.children.length ? ROW_HEIGHT + 'px' : 'none';
  toggleBtn.style.display = gallery.children.length > 4 ? '' : 'none';
  const newBtn = toggleBtn.cloneNode(true);
  toggleBtn.parentNode.replaceChild(newBtn, toggleBtn);
  newBtn.addEventListener('click', () => {
    expanded = !expanded;
    gallery.style.maxHeight = expanded ? gallery.scrollHeight + 'px' : ROW_HEIGHT + 'px';
    newBtn.textContent = expanded ? 'Skatīt mazāk ↑' : 'Skatīt vairāk ↓';
  });
}

document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', e => {
    const href = link.getAttribute('href');
    if (!href || href === '#') return;
    const target = document.querySelector(href);
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});
