(function () {
  const loader = document.getElementById('loader');
  if (!loader) return;
  const hide = () => {
    loader.classList.add('loader-hide');
    setTimeout(() => loader.remove(), 750);
  };
  const minWait  = new Promise(r => setTimeout(r, 2000));
  const pageLoad = new Promise(r => {
    if (document.readyState === 'complete') r();
    else window.addEventListener('load', r, { once: true });
  });
  Promise.all([minWait, pageLoad]).then(hide);
})();

const nav = document.getElementById('nav');
const burger = document.getElementById('burger');
const navLinks = document.getElementById('nav-links');

if (nav) {
  window.addEventListener('scroll', () => {
    nav.classList.toggle('nav-scrolled', window.scrollY > 80);
  });
}

if (burger && nav) {
  burger.addEventListener('click', () => {
    nav.classList.toggle('nav-open');
  });
}

if (navLinks && nav) {
  navLinks.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => nav.classList.remove('nav-open'));
  });
}

document.querySelectorAll('.stab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.stab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.services-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    const panel = document.getElementById('tab-' + tab.dataset.tab);
    if (panel) panel.classList.add('active');
  });
});

document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const href = a.getAttribute('href');
    if (!href || href === '#') return;
    const target = document.querySelector(href);
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('revealed');
      observer.unobserve(e.target);
    }
  });
}, { threshold: 0.06 });

document.querySelectorAll('.masonry-item, .review-card, .fact, .reveal').forEach(el => {
  el.classList.add('reveal-item');
  observer.observe(el);
});

window.observeReveal = function(el) {
  el.classList.add('reveal-item');
  observer.observe(el);
};

// Gallery expand / collapse (mobile only)
(function () {
  const toggle = document.getElementById('galleryToggle');
  const masonry = document.getElementById('masonry');
  if (!toggle || !masonry) return;

  toggle.addEventListener('click', () => {
    const expanded = masonry.classList.toggle('expanded');
    toggle.setAttribute('aria-expanded', expanded);
    toggle.textContent = expanded ? 'Paslēpt ↑' : 'Rādīt vairāk ↓';
    if (!expanded) {
      // Scroll back to top of section when collapsing
      masonry.closest('section').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
})();

// ── Services loader ────────────────────────────────────────────────
(async function loadServices() {
  const grid = document.getElementById('services-grid');
  if (!grid) return;

  const EMOJI = { hair: '✂️', beard: '🪒', extra: '✨' };
  const CAT_CLASS = { hair: 'cat-hair', beard: 'cat-beard', extra: 'cat-extra' };

  try {
    const res = await fetch('/api/services');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const services = await res.json();

    if (!Array.isArray(services) || !services.length) {
      grid.innerHTML = '<p style="color:var(--muted);grid-column:1/-1">Pakalpojumi drīzumā.</p>';
      return;
    }

    grid.innerHTML = services.map(s => {
      const cat = (s.category || 'extra').toLowerCase();
      const emoji = EMOJI[cat] || '✂️';
      const catCls = CAT_CLASS[cat] || 'cat-extra';
      const visual = s.img_url
        ? `<div class="svc-card-vis"><img src="${s.img_url}" alt="${s.name}" loading="lazy"></div>`
        : `<div class="svc-card-vis"><div class="svc-card-fallback ${catCls}">${emoji}</div></div>`;
      const meta = [
        s.time_label ? `<span>${s.time_label}</span>` : '',
        s.price      ? `<span style="color:var(--accent);font-weight:600">${parseFloat(s.price).toFixed(2)} €</span>` : '',
      ].filter(Boolean).join('<span style="color:var(--muted)"> · </span>');

      return `
        <article class="svc-card">
          ${visual}
          <div class="svc-card-body">
            <div class="svc-card-name">${s.name}</div>
            ${s.description ? `<div class="svc-card-desc">${s.description}</div>` : ''}
            ${meta ? `<div class="svc-card-desc" style="margin-top:10px">${meta}</div>` : ''}
          </div>
        </article>`;
    }).join('');

    // trigger reveal animations for newly added cards
    grid.querySelectorAll('.svc-card').forEach(el => {
      if (window.observeReveal) window.observeReveal(el);
    });

  } catch (err) {
    console.error('[services]', err);
    grid.innerHTML = '<p style="color:var(--muted);grid-column:1/-1">Neizdevās ielādēt pakalpojumus.</p>';
  }
})();
