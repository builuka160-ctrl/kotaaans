async function loadPortfolio() {
  const masonry = document.querySelector('.masonry') || document.getElementById('gallery');
  if (!masonry) return;
  try {
    const res = await fetch('/api/portfolio');
    if (!res.ok) return;
    const photos = await res.json();
    if (!photos || !photos.length) return; 
    masonry.innerHTML = '';
    photos.forEach((p, i) => {
      const fig = document.createElement('figure');
      
      fig.className = 'm-item' + (i % 3 === 0 ? ' m-tall' : '');
      const img = document.createElement('img');
      img.src = p.img_url;
      img.alt = '';
      img.loading = 'lazy';
      fig.appendChild(img);
      masonry.appendChild(fig);
    });
  } catch {}
  if (typeof initGalleryToggle === 'function') initGalleryToggle();
}

async function loadServices() {
  const grid = document.getElementById('services-grid');
  if (!grid) return;

  try {
    const res = await fetch('/api/services');
    if (!res.ok) return;
    const svcs = await res.json();
    if (!svcs || !svcs.length) return;

    grid.innerHTML = '';
    const catIcon = { hair: '✂️', beard: '🪒', extra: '✨' };

    svcs.forEach(s => {
      const card = document.createElement('div');
      card.className = 'svc-card';

      const vis = document.createElement('div');
      vis.className = 'svc-card-vis';
      if (s.img_url) {
        const img = document.createElement('img');
        img.src = s.img_url; img.alt = s.name; img.loading = 'lazy';
        vis.appendChild(img);
      } else {
        const fallback = document.createElement('div');
        fallback.className = 'svc-card-fallback cat-' + (s.category || 'hair');
        fallback.textContent = catIcon[s.category] || '✂️';
        vis.appendChild(fallback);
      }
      card.appendChild(vis);

      const body = document.createElement('div');
      body.className = 'svc-card-body';

      const name = document.createElement('div');
      name.className = 'svc-card-name';
      name.textContent = s.name;

      const desc = document.createElement('div');
      desc.className = 'svc-card-desc';
      desc.textContent = s.description || '';

      body.appendChild(name);
      body.appendChild(desc);
      card.appendChild(body);
      grid.appendChild(card);

      if (typeof window.observeReveal === 'function') window.observeReveal(card);
    });
  } catch {}
}

document.addEventListener('DOMContentLoaded', () => {
  loadServices();
  loadPortfolio();
});
