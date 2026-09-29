'use strict';

/* =========================================================
   Undangan Pernikahan Online — Frontend
   ========================================================= */

const $ = (sel) => document.querySelector(sel);

/* Slug undangan diambil dari server (window.__ACCOUNT__) atau dari URL /u/<slug>. */
const ACCOUNT_SLUG = (() => {
  if (window.__ACCOUNT__ && window.__ACCOUNT__.slug) return window.__ACCOUNT__.slug;
  const m = location.pathname.match(/^\/u\/([^/]+)/);
  return m ? decodeURIComponent(m[1]) : '';
})();

const api = async (url, opts = {}) => {
  const headers = Object.assign({}, opts.headers || {});
  if (ACCOUNT_SLUG) headers['x-account'] = ACCOUNT_SLUG;
  const res = await fetch(url, Object.assign({}, opts, { headers }));
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan.');
  return data;
};

const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const DAYS = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];

let STATE = { data: null, guest: null, targetDate: null };

const THEMES = ['botanical', 'midnight', 'blush', 'javanese', 'minimal', 'baroque'];

/** Warna theme-color (address bar browser) per tema. */
const THEME_COLORS = {
  botanical: '#7d8f6d',
  midnight: '#14131a',
  blush: '#c98a86',
  javanese: '#8a6d3b',
  minimal: '#3f3f46',
  baroque: '#6d4b6b',
};

/**
 * Terapkan tema ke <body>.
 * @param {string} theme   - nama preset (botanical | midnight | ...) atau slug tema kustom
 * @param {object} [tokens] - override CSS variable dari tema kustom ({'--sage':'#...', ...})
 * @param {string} [base]  - preset dasar yang dipakai saat tema kustom (agar token lain tetap)
 */
function applyTheme(theme, tokens, base) {
  const body = document.body;
  const isPreset = THEMES.includes(theme);
  // Untuk tema kustom: pakai preset `base` lalu timpa dengan token.
  const effective = isPreset ? theme : (THEMES.includes(base) ? base : 'botanical');

  THEMES.forEach((name) => body.classList.toggle('theme-' + name, name === effective));
  body.dataset.theme = theme;

  // Bersihkan override sebelumnya lalu terapkan token kustom.
  if (body._customThemeKeys) {
    body._customThemeKeys.forEach((k) => body.style.removeProperty(k));
  }
  const keys = [];
  if (tokens && typeof tokens === 'object') {
    for (const [k, v] of Object.entries(tokens)) {
      if (!k.startsWith('--')) continue;
      body.style.setProperty(k, v);
      keys.push(k);
    }
  }
  body._customThemeKeys = keys;

  // selaraskan warna address-bar browser dengan tema
  const meta = document.querySelector('meta[name="theme-color"]');
  const color = (tokens && tokens['--cream']) || THEME_COLORS[effective];
  if (meta && color) meta.setAttribute('content', color);
}

/**
 * Terapkan latar kustom (desktop + mobile) dari setelan admin.
 * Nilai kosong = pakai gambar bawaan tema (lihat :root di style.css).
 * Menggunakan url("...") agar CSS tetap aman (nilai sudah disaring server).
 */
function applyBackground(settings) {
  const body = document.body;
  const s = settings || {};
  const img = (u) => (u ? `url("${String(u).replace(/["()]/g, '')}")` : '');

  const set = (k, v) => {
    if (v) body.style.setProperty(k, v);
    else body.style.removeProperty(k);
  };

  const heroUrl = img(s.background_image);
  const heroMob = img(s.background_image_mobile);
  set('--bg-hero', heroUrl || null);
  set('--bg-cover', heroUrl || null);
  set('--bg-hero-mobile', heroMob || heroUrl || null);
  set('--bg-cover-mobile', heroMob || heroUrl || null);

  const op = Number(s.background_overlay_opacity);
  if (s.background_overlay && Number.isFinite(op) && op > 0) {
    const hex = String(s.background_overlay).trim();
    // Ubah hex → rgba agar opacity terpisah dari warna solid.
    const m = /^#?([0-9a-f]{6})$/i.exec(hex);
    const rgb = m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : null;
    body.style.setProperty('--bg-overlay', rgb ? `rgba(${rgb.join(',')},${op})` : hex);
  } else {
    body.style.removeProperty('--bg-overlay');
  }

  set('--bg-position', s.background_position || null);
  set('--bg-size', s.background_size || null);
  set('--bg-repeat', s.background_repeat || null);
  set('--bg-attachment', s.background_attachment || null);
}

/* ---------- util ---------- */
const fmtDateLong = (iso) => {
  const d = new Date(iso);
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};
const fmtRelative = (iso) => {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'baru saja';
  if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} hari lalu`;
  return fmtDateLong(iso);
};
const esc = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/* ---------- load data ---------- */
async function load() {
  const params = new URLSearchParams(location.search);
  const toSlug = params.get('to');

  STATE.data = await api('/api/invitation');

  if (toSlug) {
    try {
      STATE.guest = await api(`/api/guest/${encodeURIComponent(toSlug)}?to=${encodeURIComponent(toSlug)}`);
    } catch { /* slug tidak dikenal -> tamu umum */ }
  }

  render();
  startCountdown();
  observeReveal();
}

/* ---------- render ---------- */
function render() {
  const { couple, events, gallery, gifts, wishes, settings, account } = STATE.data;
  const c = couple || {};

  applyTheme(
    (settings && settings.theme) || (account && account.theme),
    settings && settings.theme_tokens,
    settings && settings.theme_base
  );

  applyBackground(settings);

  const groomFull = c.groom_full || c.groom_name || 'Mempelai Pria';
  const brideFull = c.bride_full || c.bride_name || 'Mempelai Wanita';
  const shortName = (full) => String(full).split(/[,\s]/)[0];

  const coupleTitle = `${shortName(groomFull)} & ${shortName(brideFull)}`;

  document.title = `Undangan Pernikahan ${coupleTitle}`;

  // COVER
  $('#coverNames').innerHTML = `${esc(shortName(groomFull))} &amp; ${esc(shortName(brideFull))}`;
  const firstEvent = events[0];
  if (firstEvent) {
    $('#coverDate').textContent = fmtDateLong(firstEvent.date_iso);
    STATE.targetDate = new Date(firstEvent.date_iso).getTime();
  }
  $('#coverGuestName').textContent = STATE.guest ? STATE.guest.name : 'Tamu Undangan';

  // HERO
  $('#heroNames').innerHTML = `${esc(shortName(groomFull))} &amp; ${esc(shortName(brideFull))}`;
  if (firstEvent) {
    const d = new Date(firstEvent.date_iso);
    $('#heroDate').textContent = `${String(d.getDate()).padStart(2,'0')} · ${String(d.getMonth()+1).padStart(2,'0')} · ${d.getFullYear()}`;
  }
  $('#heroQuote').textContent = settings.quote || '';

  // COUPLE
  $('#groomName').textContent = groomFull;
  $('#groomParents').textContent = c.groom_parents || '';
  setPhoto($('#groomPhoto'), c.groom_photo);
  setIg($('#groomIg'), c.groom_ig);
  $('#brideName').textContent = brideFull;
  $('#brideParents').textContent = c.bride_parents || '';
  setPhoto($('#bridePhoto'), c.bride_photo);
  setIg($('#brideIg'), c.bride_ig);

  // LOVE STORY
  $('#loveStory').textContent = c.love_story || '';

  // FOOTER
  $('#footerNames').innerHTML = `${esc(shortName(groomFull))} &amp; ${esc(shortName(brideFull))}`;

  // EVENTS
  $('#eventsGrid').innerHTML = events.map((e) => `
    <article class="event-card reveal">
      <h3>${esc(e.title)}</h3>
      <p class="event-date">${esc(fmtDateLong(e.date_iso))}</p>
      <p class="event-time">${esc(e.time_text || '')}</p>
      <p class="event-venue">${esc(e.venue || '')}</p>
      <p class="event-address">${esc(e.address || '')}</p>
      ${e.maps_url ? `<a class="btn-map" href="${esc(e.maps_url)}" target="_blank" rel="noopener">Lihat Lokasi</a>` : ''}
    </article>`).join('');

  // GALLERY
  $('#galleryGrid').innerHTML = gallery.length
    ? gallery.map((g) => `
      <figure class="gallery-item reveal">
        <img src="${esc(g.url)}" alt="${esc(g.caption || 'Foto')}" loading="lazy" />
        ${g.caption ? `<span>${esc(g.caption)}</span>` : ''}
      </figure>`).join('')
    : '<p class="section-lead">Belum ada foto.</p>';

  // GIFTS
  $('#giftsGrid').innerHTML = gifts.length
    ? gifts.map((g) => `
      <div class="gift-card">
        <div class="gift-bank">${esc(g.bank_name || g.type)}</div>
        <div class="gift-no">${esc(g.account_no || '')}</div>
        <div class="gift-name">a.n. ${esc(g.account_name || '')}</div>
        <button class="btn-copy" data-copy="${esc(g.account_no || '')}">Salin Nomor</button>
      </div>`).join('')
    : '<p class="section-lead">Belum ada info amplop digital.</p>';

  // WISHES
  renderWishes(wishes);

  // MUSIC
  if (settings.music_url) {
    const audio = $('#bgMusic');
    audio.src = settings.music_url;
  } else {
    $('#musicBtn').style.display = 'none';
  }

  // navigasi antar-section
  bindSectionNav();
  trackActiveSection();

  // prefill nama tamu
  if (STATE.guest) {
    $('#rsvpName').value = STATE.guest.name;
    $('#wishName').value = STATE.guest.name;
    const q = STATE.guest.quota;
    if (q) {
      const pax = $('#rsvpPax');
      pax.max = Math.max(q, 1);
      pax.value = 1;
      const wrap = document.querySelector('[data-stepper]');
      if (wrap && wrap._refresh) wrap._refresh();
    }
  }
}

function setIg(el, handle) {
  if (!handle) { el.textContent = ''; el.removeAttribute('href'); return; }
  el.textContent = '@' + String(handle).replace(/^@/, '');
  el.href = `https://instagram.com/${String(handle).replace(/^@/, '')}`;
}

function setPhoto(el, url) {
  if (url) {
    el.style.backgroundImage = `url('${String(url).replace(/'/g, "%27")}')`;
  } else {
    el.classList.add('no-photo');
  }
}

function renderWishes(list) {
  $('#wishCount').textContent = `${list.length} ucapan`;
  $('#wishesList').innerHTML = list.length
    ? list.map((w) => `
      <div class="wish">
        <div class="wish-head">
          <span class="wish-name">${esc(w.name)}</span>
          <span class="wish-badge ${esc(w.attending || 'hadir')}">${
            w.attending === 'tidak_hadir' ? 'Tidak Hadir' : w.attending === 'ragu' ? 'Ragu' : 'Hadir'
          }</span>
        </div>
        <p class="wish-msg">${esc(w.message)}</p>
        <p class="wish-time">${esc(fmtRelative(w.created_at))}</p>
      </div>`).join('')
    : '<p class="section-lead">Jadilah yang pertama memberi ucapan 🤍</p>';
}

/* ---------- countdown ---------- */
let cdTimer = null;
function startCountdown() {
  if (!STATE.targetDate) return;
  const tick = () => {
    const diff = STATE.targetDate - Date.now();
    if (diff <= 0) {
      if (cdTimer) { clearInterval(cdTimer); cdTimer = null; }
      const el = document.getElementById('countdown');
      if (el) el.innerHTML = '<p class="cd-done">Alhamdulillah, acara telah berlangsung 🤍</p>';
      return;
    }
    const s = Math.floor(diff / 1000);
    $('#cdDays').textContent = Math.floor(s / 86400);
    $('#cdHours').textContent = Math.floor((s % 86400) / 3600);
    $('#cdMins').textContent = Math.floor((s % 3600) / 60);
    $('#cdSecs').textContent = s % 60;
  };
  tick();
  cdTimer = setInterval(tick, 1000);
}

/* ---------- section navigation ---------- */
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- stepper jumlah orang ---------- */
function bindStepper() {
  const input = document.getElementById('rsvpPax');
  const wrap = document.querySelector('[data-stepper]');
  if (!input || !wrap) return;

  const min = () => parseInt(input.min, 10) || 1;
  const max = () => parseInt(input.max, 10) || 20;

  const clamp = (n) => Math.max(min(), Math.min(max(), n));

  const refresh = () => {
    const v = clamp(parseInt(input.value, 10) || min());
    input.value = v;
    const btnMinus = wrap.querySelector('[data-step="-1"]');
    const btnPlus = wrap.querySelector('[data-step="1"]');
    if (btnMinus) btnMinus.disabled = v <= min();
    if (btnPlus) btnPlus.disabled = v >= max();
  };

  wrap.addEventListener('click', (e) => {
    const b = e.target.closest('[data-step]');
    if (!b || b.disabled) return;
    const step = parseInt(b.dataset.step, 10) || 0;
    input.value = clamp((parseInt(input.value, 10) || min()) + step);
    refresh();
  });

  input.addEventListener('input', refresh);
  input.addEventListener('blur', refresh);
  wrap._refresh = refresh; // agar bisa dipanggil ulang saat kuota tamu berubah
  refresh();
}

// State internal navigasi (dibungkus agar tidak bocor ke global scope lain).
const NavState = {
  bound: false,
  btns: [],
  items: [], // { section, btn }
  ticking: false,
  current: null,
  pendingUntil: 0, // saat program-scroll berlangsung, tahan scroll-spy agar tidak "berkedip"
  footerView: null, // elemen opsional yang menandai akhir konten
};

/** Tinggi bagian bawah layar yang "tertutup" (nav bawah + safe area) saat mobile. */
function navReservedBottom() {
  const nav = document.getElementById('sectionNav');
  if (!nav || nav.hidden || getComputedStyle(nav).display === 'none') return 0;
  return nav.offsetHeight || 0;
}

/** Kumpulkan tombol nav + pasangan section-nya. Aman bila elemen belum ada. */
function collectNavItems() {
  const nav = document.getElementById('sectionNav');
  if (!nav) return [];
  const btns = Array.from(nav.querySelectorAll('.nav-btn'));
  return btns
    .map((btn) => {
      const section = btn.dataset.target ? document.getElementById(btn.dataset.target) : null;
      return section ? { section, btn } : null;
    })
    .filter(Boolean);
}

/** Offset tinggi area bawah yang menutupi konten (nav bawah + sedikit jeda). */
function navOffsetBottom() {
  return navReservedBottom() + 8;
}

/**
 * Tentukan section yang sedang aktif berdasarkan posisi scroll.
 *
 * Memakai getBoundingClientRect (bukan offsetTop) supaya tetap akurat walau ada
 * ancestor ber-position/ber-transform. "Garis baca" ditaruh sedikit di bawah
 * tengah viewport; bila belum ada section yang melewatinya (mis. masih di hero),
 * section pertama dianggap aktif.
 */
function computeActiveButton() {
  const { items } = NavState;
  if (!items.length) return null;

  const vh = window.innerHeight || document.documentElement.clientHeight;
  const line = vh * 0.42 + navOffsetBottom() * 0.5;
  let active = null;
  let bestTop = -Infinity;

  for (const item of items) {
    const top = item.section.getBoundingClientRect().top;
    if (top <= line && top > bestTop) {
      bestTop = top;
      active = item;
    }
  }
  if (!active) active = items[0]; // sebelum section pertama melewati garis baca

  // Bila sudah mentok paling bawah, tandai section terakhir sebagai aktif.
  const doc = document.documentElement;
  const atBottom =
    window.innerHeight + window.scrollY >= (doc ? doc.scrollHeight : document.body.scrollHeight) - 4;
  if (atBottom) active = items[items.length - 1];

  return active;
}

/** Geser indikator pil ke tombol yang aktif. */
function moveIndicator(btn, animate = true) {
  const ind = document.querySelector('#sectionNav .nav-ind');
  if (!ind || !btn || !btn.offsetWidth) return;
  ind.style.transition = animate && !reduceMotion() ? '' : 'none';
  ind.style.width = btn.offsetWidth + 'px';
  ind.style.transform = 'translateX(' + btn.offsetLeft + 'px)';
  ind.classList.add('show');
}

/** Set kelas .active pada satu tombol (tanpa menyentuh NavState). */
function paintActive(btn, animate = true) {
  NavState.btns.forEach((b) => b.classList.toggle('active', b === btn));
  moveIndicator(btn, animate);
}

/** Perbarui kelas .active pada tombol nav (hanya bila berubah). */
function updateActiveNav() {
  // Saat program-scroll sedang berjalan, jangan biarkan spy menggeser highlight
  // (mencegah indikator "loncat-loncat" tak responsif di tengah animasi).
  if (performance.now() < NavState.pendingUntil) return;
  const active = computeActiveButton();
  if (!active) return;
  if (NavState.current === active.btn) {
    // Tombol aktif belum berubah, tapi posisi/ukuran bisa berubah (resize/font) —
    // tetap perbarui indikator agar selalu selaras.
    moveIndicator(active.btn, false);
    return;
  }
  NavState.current = active.btn;
  paintActive(active.btn);
}

/** Throttle update via requestAnimationFrame agar tidak berat saat scroll. */
function onScrollUpdateNav() {
  if (NavState.ticking) return;
  NavState.ticking = true;
  requestAnimationFrame(() => {
    updateActiveNav();
    NavState.ticking = false;
  });
}

/** Klik tombol nav -> gulir ke section (dibind sekali; delegasi event). */
function bindSectionNav() {
  const nav = document.getElementById('sectionNav');
  if (!nav || NavState.bound) return;
  NavState.bound = true;

  nav.addEventListener('click', (e) => {
    const btn = e.target.closest('.nav-btn');
    if (!btn || !nav.contains(btn)) return;
    const target = btn.dataset.target;
    if (!target) return;
    const section = document.getElementById(target);
    if (!section) return;

    // Respons instan: nyalakan highlight segera, dan tahan spy sejenak.
    NavState.current = btn;
    paintActive(btn);
    NavState.pendingUntil = performance.now() + (reduceMotion() ? 60 : 700);

    // Kompensasi tinggi nav bawah agar section tidak tertutup (khusus mobile).
    // Section digulir sedikit di atas tepi atas viewport bila ada nav bawah.
    const rect = section.getBoundingClientRect();
    const top = Math.max(0, rect.top + window.scrollY - 4);
    window.scrollTo({ top, behavior: reduceMotion() ? 'auto' : 'smooth' });

    // Setelah animasi selesai, sinkronkan ulang agar status final pasti tepat.
    clearTimeout(NavState.syncTimer);
    NavState.syncTimer = setTimeout(() => {
      const a = computeActiveButton();
      if (a) {
        NavState.current = a.btn;
        paintActive(a.btn);
      }
    }, reduceMotion() ? 80 : 780);
  });
}

/** Siapkan scroll-spy (hanya sekali). Aman dipanggil berkali-kali. */
function trackActiveSection() {
  const items = collectNavItems();
  if (!items.length) return; // elemen belum siap; akan dicoba lagi nanti

  NavState.items = items;
  NavState.btns = items.map((it) => it.btn);

  // Reset lebar indikator (kalau belum ada tombol aktif, sembunyikan).
  const ind = document.querySelector('#sectionNav .nav-ind');
  if (ind && !NavState.current) ind.classList.remove('show');

  if (!NavState.spyBound) {
    NavState.spyBound = true;
    window.addEventListener('scroll', onScrollUpdateNav, { passive: true });
    window.addEventListener('resize', onScrollUpdateNav, { passive: true });
    window.addEventListener('orientationchange', onScrollUpdateNav, { passive: true });
    // Scroll berakhir (mis. smooth-scroll / inersia) -> sinkronkan indikator.
    window.addEventListener('scrollend', () => {
      NavState.pendingUntil = 0;
      updateActiveNav();
    }, { passive: true });
  }
  updateActiveNav();
}

/* ---------- reveal on scroll ---------- */
function observeReveal() {
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }),
    { threshold: 0.12 }
  );
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
}

/* ---------- events / interactions ---------- */
function bindUI() {
  // buka undangan
  $('#openBtn').addEventListener('click', () => {
    $('#cover').classList.add('closed');
    $('#main').classList.remove('hidden');
    $('#musicBtn').classList.add('visible');
    window.scrollTo({ top: 0 });
    playMusic(true);
    observeReveal();

    // tampilkan navigasi antar-section
    const nav = document.getElementById('sectionNav');
    if (nav) {
      nav.removeAttribute('hidden');
      requestAnimationFrame(() => nav.classList.add('show'));
    }
    // pastikan scroll-spy aktif & status awal benar setelah konten terlihat
    trackActiveSection();
    updateActiveNav();

    // Layout bergeser setelah gambar/font selesai dimuat (umum di HP), jadi
    // sinkronkan ulang indikator agar tidak "nyangkut" di section yang salah.
    const resync = () => {
      NavState.pendingUntil = 0;
      updateActiveNav();
      // gambar ulang indikator tanpa animasi agar selalu pas
      if (NavState.current) moveIndicator(NavState.current, false);
    };
    window.addEventListener('load', resync, { once: true });
    setTimeout(resync, 350);
    setTimeout(resync, 1200);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(resync).catch(() => {});
  });

  // musik
  const audio = $('#bgMusic');
  const btn = $('#musicBtn');
  btn.addEventListener('click', () => playMusic(audio.paused));

  // tampil/sembunyi jumlah orang + kelola pilihan konfirmasi
  const syncPaxVisibility = () => {
    const checked = document.querySelector('input[name="attendance"]:checked');
    const att = checked ? checked.value : 'hadir';
    const paxField = $('#paxField');
    if (!paxField) return;
    const show = att === 'hadir';
    paxField.hidden = !show;
    paxField.style.display = show ? '' : 'none';
  };
  document.querySelectorAll('input[name="attendance"]').forEach((r) => {
    r.addEventListener('change', syncPaxVisibility);
  });
  syncPaxVisibility();

  // stepper jumlah orang (- / +)
  bindStepper();

  // salin nomor rekening
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('.btn-copy');
    if (!b) return;
    try {
      await navigator.clipboard.writeText(b.dataset.copy);
      const old = b.textContent;
      b.textContent = 'Tersalin ✓';
      setTimeout(() => (b.textContent = old), 1600);
    } catch {
      alert('Nomor: ' + b.dataset.copy);
    }
  });

  // RSVP submit
  $('#rsvpForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const note = $('#rsvpNote');
    btn.disabled = true;
    note.textContent = '';
    try {
      const attendance = document.querySelector('input[name="attendance"]:checked').value;
      await api('/api/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: $('#rsvpName').value,
          attendance,
          pax: attendance === 'hadir' ? $('#rsvpPax').value : 0,
          message: $('#rsvpMsg').value,
          slug: STATE.guest ? STATE.guest.slug : null,
        }),
      });
      note.textContent = 'Terima kasih! Konfirmasi Anda sudah kami terima. 🤍';
      note.className = 'form-note ok';
      e.target.reset();
      if (STATE.guest) $('#rsvpName').value = STATE.guest.name;
    } catch (err) {
      note.textContent = err.message;
      note.className = 'form-note err';
    } finally {
      btn.disabled = false;
    }
  });

  // WISH submit
  $('#wishForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      const attendance = document.querySelector('input[name="attendance"]:checked')?.value || 'hadir';
      const res = await api('/api/wishes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: $('#wishName').value,
          message: $('#wishMsg').value,
          attending: attendance,
          slug: STATE.guest ? STATE.guest.slug : null,
        }),
      });
      // prepend ucapan baru
      STATE.data.wishes.unshift(res.wish);
      renderWishes(STATE.data.wishes);
      e.target.reset();
      if (STATE.guest) $('#wishName').value = STATE.guest.name;
    } catch (err) {
      alert(err.message);
    } finally {
      btn.disabled = false;
    }
  });
}

function playMusic(play) {
  const audio = $('#bgMusic');
  const btn = $('#musicBtn');
  if (!audio.src) return;
  if (play) {
    audio.play().then(() => btn.classList.add('playing')).catch(() => btn.classList.remove('playing'));
  } else {
    audio.pause();
    btn.classList.remove('playing');
  }
}

/* ---------- init ---------- */
document.addEventListener('DOMContentLoaded', () => {
  bindUI();
  load().catch((err) => {
    console.error(err);
    document.body.innerHTML = '<p style="padding:40px;text-align:center;font-family:sans-serif">Gagal memuat undangan: ' + esc(err.message) + '</p>';
  });
});
