'use strict';

/* =========================================================
   Undangan Pernikahan Online — Frontend
   ========================================================= */

const $ = (sel) => document.querySelector(sel);
const api = async (url, opts) => {
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan.');
  return data;
};

const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const DAYS = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];

let STATE = { data: null, guest: null, targetDate: null };

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
      STATE.guest = await api(`/api/guest/${encodeURIComponent(toSlug)}`);
    } catch { /* slug tidak dikenal -> tamu umum */ }
  }

  render();
  startCountdown();
  observeReveal();
}

/* ---------- render ---------- */
function render() {
  const { couple, events, gallery, gifts, wishes, settings } = STATE.data;
  const c = couple || {};

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

  // prefill nama tamu
  if (STATE.guest) {
    $('#rsvpName').value = STATE.guest.name;
    $('#wishName').value = STATE.guest.name;
    const q = STATE.guest.quota;
    if (q) { $('#rsvpPax').max = Math.max(q, 1); $('#rsvpPax').value = 1; }
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
  });

  // musik
  const audio = $('#bgMusic');
  const btn = $('#musicBtn');
  btn.addEventListener('click', () => playMusic(audio.paused));

  // tampil/sembunyi jumlah orang
  document.querySelectorAll('input[name="attendance"]').forEach((r) => {
    r.addEventListener('change', () => {
      const att = document.querySelector('input[name="attendance"]:checked').value;
      $('#paxField').style.display = att === 'hadir' ? '' : 'none';
    });
  });

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
