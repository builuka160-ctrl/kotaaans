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

// ── i18n ───────────────────────────────────────────────────────────
const _t = {
  lv: {
    skip:            'Pāriet uz saturu',
    'nav.services':  'Preces',
    'nav.works':     'Darbi',
    'nav.about':     'Par mums',
    'nav.contact':   'Pieraksts',
    'nav.cta':       'Pierakstīties',
    'hero.desc':     'Precīzi griezumi. Tīras līnijas.<br>Rēzeknē kopš pirmās dienas.',
    'hero.cta':      'Pierakstīties WhatsApp',
    'hero.ghost':    'Skatīt darbus',
    'hero.stat1':    'Google ★',
    'hero.stat2':    'Atsauksmes',
    'hero.stat3':    'Pieraksts',
    'services.label':'Preces',
    'services.title':'Mūsu<br>pakalpojumi.',
    'works.label':   'Mūsu darbi',
    'works.title':   'Mūsu darbi.',
    'works.more':    'Rādīt vairāk ↓',
    'works.less':    'Rādīt mazāk ↑',
    'works.instagram':'Visi darbi Instagram ↗',
    'about.label':   'Par mums',
    'about.title':   'Valters<br>un Jānis.',
    'about.body1':   'Divi brāļi ar vienu kopīgu vīziju — mēs izveidojām modernu barbershop ar atmosfēru, kas jūtas svaiga, laipna un patiesi patīkama. Kopš atvēršanas 2025. gada decembrī mēs esam koncentrējušies uz mums vissvarīgākajām vērtībām: kvalitāti, konsekvenci, uzmanību detaļām un patiesu cieņu pret katru klientu, kurš ienāk pie mums.',
    'about.body2':   'Kā jaunas paaudzes frizieri mēs vēlamies radīt Rēzeknē citādu atmosfēru — personiskāku, relaksētāku, veidotu ap cilvēkiem, kuri patiesi bauda laiku krēslā.',
    'about.stat1':   'Google vērtējums',
    'about.stat2':   'Atsauksmes',
    'about.stat3':   'Pieraksts',
    'reviews.label': 'Atsauksmes',
    'reviews.title': 'Par mums saka',
    'booking.label': 'Pieraksts',
    'booking.title': 'Piesaki savu<br>griezumu tūlīt!',
    'booking.sub':   'Pierakstīties var WhatsApp vai izsaucot. Strādājam 24/7 pēc pieraksta.',
    'booking.addr':  '📍 Dārzu iela 22, Rēzekne',
    'booking.hours': '🕐 24/7 pēc pieraksta',
    'footer.nav':    'Navigācija',
    'footer.contacts':'Kontakti',
  },
  en: {
    skip:            'Skip to content',
    'nav.services':  'Services',
    'nav.works':     'Work',
    'nav.about':     'About',
    'nav.contact':   'Book',
    'nav.cta':       'Book Now',
    'hero.desc':     'Precise cuts. Clean lines.<br>In Rēzekne from day one.',
    'hero.cta':      'Book via WhatsApp',
    'hero.ghost':    'View Our Work',
    'hero.stat1':    'Google ★',
    'hero.stat2':    'Reviews',
    'hero.stat3':    'Booking',
    'services.label':'Services',
    'services.title':'Our<br>services.',
    'works.label':   'Our Work',
    'works.title':   'Our work.',
    'works.more':    'Show more ↓',
    'works.less':    'Show less ↑',
    'works.instagram':'All work on Instagram ↗',
    'about.label':   'About Us',
    'about.title':   'Valters<br>&amp; Jānis.',
    'about.body1':   'Started by two brothers with one shared vision, we created a modern barbershop with an atmosphere that feels fresh, welcoming, and genuinely enjoyable to be part of. Since opening in December 2025, we\'ve stayed focused on the values that matter most to us: quality, consistency, attention to detail, and real respect for every client who walks through our doors.',
    'about.body2':   'As a new generation of barbers, we want to bring a different kind of atmosphere to Rēzekne that feels more personal, more relaxed, and built around people actually enjoying their time in the chair.',
    'about.stat1':   'Google rating',
    'about.stat2':   'Reviews',
    'about.stat3':   'Booking',
    'reviews.label': 'Reviews',
    'reviews.title': 'What they say',
    'booking.label': 'Book Now',
    'booking.title': 'Book your<br>haircut now!',
    'booking.sub':   'Book via WhatsApp or by calling. We work 24/7 by appointment.',
    'booking.addr':  '📍 Dārzu iela 22, Rēzekne',
    'booking.hours': '🕐 24/7 by appointment',
    'footer.nav':    'Navigation',
    'footer.contacts':'Contacts',
  },
};

let _lang = localStorage.getItem('lang') || 'lv';

function applyLang(lang) {
  _lang = lang;
  localStorage.setItem('lang', lang);
  document.documentElement.lang = lang;

  const t = _t[lang] || _t.lv;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (key in t) el.innerHTML = t[key];
  });

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });

  const toggle = document.getElementById('galleryToggle');
  if (toggle) {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.innerHTML = expanded ? t['works.less'] : t['works.more'];
  }
}

document.querySelectorAll('.lang-btn').forEach(btn => {
  btn.addEventListener('click', () => applyLang(btn.dataset.lang));
});

applyLang(_lang);

// ── Nav ────────────────────────────────────────────────────────────
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

// ── Gallery expand / collapse ──────────────────────────────────────
(function () {
  const toggle = document.getElementById('galleryToggle');
  const masonry = document.getElementById('masonry');
  if (!toggle || !masonry) return;

  toggle.addEventListener('click', () => {
    const expanded = masonry.classList.toggle('expanded');
    toggle.setAttribute('aria-expanded', expanded);
    const t = _t[_lang] || _t.lv;
    toggle.innerHTML = expanded ? t['works.less'] : t['works.more'];
    if (!expanded) {
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

    grid.querySelectorAll('.svc-card').forEach(el => {
      if (window.observeReveal) window.observeReveal(el);
    });

  } catch (err) {
    console.error('[services]', err);
    grid.innerHTML = '<p style="color:var(--muted);grid-column:1/-1">Neizdevās ielādēt pakalpojumus.</p>';
  }
})();
