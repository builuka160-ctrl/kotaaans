require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');
const path      = require('path');
const fs        = require('fs');
const crypto    = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const app  = express();
const PORT = process.env.PORT || 3000;

const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_KEY'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length) {
  console.error('Missing required env vars:', missing.join(', '));
  process.exit(1);
}
if (process.env.NODE_ENV === 'production' && !process.env.ALLOWED_ORIGIN) {
  console.error('ALLOWED_ORIGIN must be set in production');
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_PORTFOLIO_BYTES = 15 * 1024 * 1024;
const ALLOWED_IMAGE_EXT = new Set(['jpeg', 'jpg', 'png', 'webp', 'gif']);

function sanitise(s, maxLen = 1000) {
  return String(s ?? '')
    .replace(/\0/g, '')
    .replace(/[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
    .slice(0, maxLen);
}

function sanitiseUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(String(url).trim());
    return u.protocol === 'https:' ? u.href : null;
  } catch { return null; }
}

function parseId(s) {
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}


async function uploadImage(base64, maxBytes = MAX_IMAGE_BYTES) {
  if (!base64 || typeof base64 !== 'string') return null;
  const match = base64.match(/^data:image\/([a-zA-Z0-9]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  let ext = match[1].toLowerCase();
  if (ext === 'jpg') ext = 'jpeg';
  if (!ALLOWED_IMAGE_EXT.has(ext)) return null;
  let buf;
  try { buf = Buffer.from(match[2], 'base64'); } catch { return null; }
  if (!buf.length || buf.length > maxBytes) return null;

  const sigs = {
    jpeg: [0xFF, 0xD8, 0xFF],
    png:  [0x89, 0x50, 0x4E, 0x47],
    gif:  [0x47, 0x49, 0x46, 0x38],
    webp: null, 
  };
  const sig = sigs[ext];
  if (sig && !sig.every((b, i) => buf[i] === b)) return null;
  if (ext === 'webp' && !(buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP')) return null;

  const fileName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ext}`;
  const { error } = await supabaseAdmin.storage
    .from('product-images')
    .upload(fileName, buf, { contentType: `image/${ext}`, upsert: false });
  if (error) {
    console.error('Upload error:', error.message);
    return null;
  }
  const { data: { publicUrl } } = supabaseAdmin.storage
    .from('product-images')
    .getPublicUrl(fileName);
  return publicUrl;
}

function sendHtmlWithNonce(res, filePath) {
  try {
    const html    = fs.readFileSync(filePath, 'utf8');
    const nonce   = res.locals.cspNonce || '';
    const out     = html.replace(/%%NONCE%%/g, nonce);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(out);
  } catch (e) {
    console.error('HTML serve error:', e.message);
    res.status(500).send('Internal server error');
  }
}

app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use((req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
});

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:   ["'self'"],
      scriptSrc:    ["'self'", (req, res) => `'nonce-${res.locals.cspNonce}'`],
      scriptSrcAttr:["'none'"],
      styleSrc:     ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
      fontSrc:      ["'self'", "https://fonts.gstatic.com"],
      imgSrc:       ["'self'", "data:", "https:", "blob:"],
      connectSrc:   ["'self'", "https://*.supabase.co"],
      objectSrc:    ["'none'"],
      baseUri:      ["'self'"],
      formAction:   ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  crossOriginEmbedderPolicy: false,
  xFrameOptions: { action: 'deny' },
}));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';
app.use(cors({
  origin: (origin, cb) => {
    const allowed = [ALLOWED_ORIGIN];
    if (process.env.NODE_ENV !== 'production') {
      allowed.push('http://localhost:3000', 'http://127.0.0.1:3000');
    }
    if (!origin || allowed.includes(origin)) return cb(null, true);
    cb(null, false);
  },
  credentials: false,
}));

const jsonSmall = express.json({ limit: '50kb' });
const jsonLarge = express.json({ limit: '30mb' });
app.use((req, res, next) => {
  const bigRoutes = ['/api/portfolio', '/api/services'];
  const isBig = bigRoutes.some(r => req.path === r || req.path.startsWith(r + '/'));
  if (isBig && ['POST', 'PATCH'].includes(req.method)) {
    return jsonLarge(req, res, next);
  }
  return jsonSmall(req, res, next);
});

app.use((req, res, next) => {
  if (req.body == null) req.body = {};
  next();
});

app.use((err, req, res, next) => {
  if (err.status === 413 || err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Payload too large (max ~30 MB).' });
  }
  if (err instanceof SyntaxError && err.status === 400) {
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  next(err);
});

app.use((req, res, next) => {
  try { decodeURIComponent(req.path); next(); }
  catch { res.status(400).end(); }
});

const apiLimiter = rateLimit({
  windowMs: 60_000, max: 60,
  standardHeaders: true, legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ error: 'Too many requests.' }),
});
app.use('/api/', apiLimiter);

const loginLimiter = rateLimit({
  windowMs: 15 * 60_000, max: 5,
  skipSuccessfulRequests: true,
  handler: (req, res) => res.status(429).json({ error: 'Too many login attempts. Try again in 15 minutes.' }),
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60_000, max: 30,
  handler: (req, res) => res.status(429).json({ error: 'Too many refresh attempts.' }),
});

async function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No auth token' });
  }
  const token = auth.split(' ')[1];
  if (!token || token.length < 20 || token.split('.').length !== 3) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  const ADMIN_EMAILS = new Set(
    (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
  );
  const role  = data.user.app_metadata?.role;
  const email = (data.user.email || '').toLowerCase();
  const isAdmin = role === 'admin' || (ADMIN_EMAILS.size > 0 && ADMIN_EMAILS.has(email));
  if (!isAdmin) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  req.user = data.user;
  next();
}

app.get('/healthz', (req, res) => res.json({ ok: true }));

app.get(['/admin', '/admin/'], (req, res) => {
  sendHtmlWithNonce(res, path.join(__dirname, 'views', 'admin.html'));
});

app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  if (email.length > 320 || password.length > 200) {
    return res.status(400).json({ error: 'Invalid input' });
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return res.status(401).json({ error: 'Invalid email or password' });
  res.json({
    token:         data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_in:    data.session.expires_in,
  });
});

app.post('/api/auth/refresh', refreshLimiter, async (req, res) => {
  const { refresh_token } = req.body || {};
  if (typeof refresh_token !== 'string' || !refresh_token) {
    return res.status(400).json({ error: 'refresh_token required' });
  }
  const { data, error } = await supabase.auth.refreshSession({ refresh_token });
  if (error) return res.status(401).json({ error: 'Session expired' });
  res.json({
    token:         data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_in:    data.session.expires_in,
  });
});

app.get('/api/portfolio', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('portfolio_photos')
      .select('id, img_url, sort_order')
      .order('sort_order', { ascending: true });
    if (error) {
      console.error('[portfolio GET]', error.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
    res.json(data || []);
  } catch (e) {
    console.error('[portfolio GET crash]', e.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/portfolio', requireAuth, async (req, res) => {
  const { img_url, img_base64 } = req.body;
  let safeUrl;
  if (img_base64) {
    safeUrl = await uploadImage(img_base64, MAX_PORTFOLIO_BYTES);
    if (!safeUrl) return res.status(400).json({ error: 'Invalid or oversized image' });
  } else {
    safeUrl = sanitiseUrl(img_url);
    if (!safeUrl) return res.status(400).json({ error: 'Invalid URL' });
  }
  const { data: last } = await supabaseAdmin
    .from('portfolio_photos').select('sort_order').order('sort_order', { ascending: false }).limit(1);
  const nextOrder = last?.length ? last[0].sort_order + 1 : 0;
  const { data, error } = await supabaseAdmin
    .from('portfolio_photos').insert([{ img_url: safeUrl, sort_order: nextOrder }]).select().single();
  if (error) {
    console.error(error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
  res.status(201).json(data);
});

app.patch('/api/portfolio/reorder', requireAuth, async (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array' });
  if (order.length > 500) return res.status(400).json({ error: 'Too many items' });
  for (const item of order) {
    if (!item || typeof item !== 'object') continue;
    const id = parseId(item.id);
    if (!id) continue;
    const so = parseInt(item.sort_order, 10);
    await supabaseAdmin.from('portfolio_photos')
      .update({ sort_order: Number.isFinite(so) ? so : 0 }).eq('id', id);
  }
  res.json({ success: true });
});

app.patch('/api/portfolio/:id', requireAuth, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid ID' });
  const { img_url, img_base64 } = req.body;
  let safeUrl;
  if (img_base64) {
    safeUrl = await uploadImage(img_base64, MAX_PORTFOLIO_BYTES);
    if (!safeUrl) return res.status(400).json({ error: 'Invalid or oversized image' });
  } else {
    safeUrl = sanitiseUrl(img_url);
    if (!safeUrl) return res.status(400).json({ error: 'Invalid URL' });
  }
  const { data, error } = await supabaseAdmin
    .from('portfolio_photos').update({ img_url: safeUrl }).eq('id', id).select().single();
  if (error) {
    console.error(error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
  res.json(data);
});

app.delete('/api/portfolio/:id', requireAuth, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid ID' });
  const { error } = await supabaseAdmin.from('portfolio_photos').delete().eq('id', id);
  if (error) {
    console.error(error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
  res.json({ success: true });
});

app.get('/api/services', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('services')
      .select('id, name, description, time_label, price, category, sort_order, img_url')
      .order('category').order('sort_order').order('created_at');
    if (error) {
      console.error('[services GET]', error.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
    res.json(data || []);
  } catch (e) {
    console.error('[services GET crash]', e.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/services', requireAuth, async (req, res) => {
  const { name, description, time_label, price, category, img_url, img_base64 } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const parsedPrice = price ? parseFloat(price) : 0;
  if (!Number.isFinite(parsedPrice) || parsedPrice < 0 || parsedPrice > 100000) {
    return res.status(400).json({ error: 'Invalid price' });
  }
  const CATS = ['hair', 'beard', 'extra'];
  let finalImgUrl = sanitiseUrl(img_url) || null;
  if (img_base64) {
    const uploaded = await uploadImage(img_base64);
    if (uploaded) finalImgUrl = uploaded;
  }
  const { data, error } = await supabaseAdmin.from('services').insert([{
    name: sanitise(name, 200),
    description: sanitise(description || '', 500),
    time_label: sanitise(time_label || '', 50),
    price: parsedPrice,
    category: CATS.includes(category) ? category : 'hair',
    img_url: finalImgUrl,
  }]).select().single();
  if (error) {
    console.error('[services POST]', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
  res.status(201).json(data);
});

app.patch('/api/services/:id', requireAuth, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid ID' });
  const { name, description, time_label, price, category, sort_order, img_url, img_base64 } = req.body;
  const CATS = ['hair', 'beard', 'extra'];
  const updates = {};
  if (name !== undefined)        updates.name        = sanitise(name, 200);
  if (description !== undefined) updates.description = sanitise(description, 500);
  if (time_label !== undefined)  updates.time_label  = sanitise(time_label, 50);
  if (category !== undefined)    updates.category    = CATS.includes(category) ? category : 'hair';
  if (price !== undefined) {
    const p = parseFloat(price);
    if (!Number.isFinite(p) || p < 0 || p > 100000) return res.status(400).json({ error: 'Invalid price' });
    updates.price = p;
  }
  if (sort_order !== undefined) {
    const s = parseInt(sort_order, 10);
    if (Number.isFinite(s)) updates.sort_order = s;
  }
  if (img_base64) {
    const uploaded = await uploadImage(img_base64);
    if (uploaded) updates.img_url = uploaded;
  } else if (img_url !== undefined) {
    updates.img_url = sanitiseUrl(img_url) || null;
  }
  const { data, error } = await supabaseAdmin.from('services').update(updates).eq('id', id).select().single();
  if (error) {
    console.error('[services PATCH]', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
  res.json(data);
});

app.delete('/api/services/:id', requireAuth, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid ID' });
  const { error } = await supabaseAdmin.from('services').delete().eq('id', id);
  if (error) {
    console.error('[services DELETE]', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
  res.json({ success: true });
});

app.use(express.static(path.join(__dirname, 'public'), {
  index: false,
  dotfiles: 'deny',
}));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  if (/\.[a-zA-Z0-9]{1,8}$/.test(req.path)) return res.status(404).end();
  sendHtmlWithNonce(res, path.join(__dirname, 'views', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err && err.message);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(PORT, () => {
  console.log(`Kotaaans server running on port ${PORT}`);
});

function shutdown(sig) {
  console.log(`${sig} received, shutting down`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
