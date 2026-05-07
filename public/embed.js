/* GrowLocal 360 — Job Snaps Embed v1
 *
 * Drop a styled Job Snaps gallery onto any website with one script tag.
 * No framework required — vanilla JS, ~6KB unminified.
 *
 * Usage:
 *   <div id="jobsnaps-gallery"></div>
 *   <script
 *     src="https://admin.goleadflow.com/embed.js"
 *     data-api-key="js_live_xxx"
 *     data-target="#jobsnaps-gallery"
 *     data-limit="20"
 *   ></script>
 */
(function () {
  'use strict';

  // Pick up our own <script> tag — currentScript is reliable while the
  // outer <script> is still executing (i.e. before async deferred work).
  var script = document.currentScript;
  if (!script) {
    // Fallback: find by src signature
    var all = document.getElementsByTagName('script');
    for (var i = all.length - 1; i >= 0; i--) {
      if (all[i].src && all[i].src.indexOf('/embed.js') !== -1) {
        script = all[i];
        break;
      }
    }
  }
  if (!script) {
    console.error('[JobSnaps] could not find embed script tag');
    return;
  }

  var apiKey = script.getAttribute('data-api-key');
  var targetSelector = script.getAttribute('data-target') || '#jobsnaps-gallery';
  var limit = parseInt(script.getAttribute('data-limit') || '20', 10) || 20;
  var theme = script.getAttribute('data-theme') || 'light';

  if (!apiKey) {
    console.error('[JobSnaps] missing data-api-key on embed script tag');
    return;
  }

  // Derive the API host from the script's src so the embed works in
  // dev/staging/prod without hardcoding a domain.
  var scriptUrl = new URL(script.src);
  var apiBase = scriptUrl.protocol + '//' + scriptUrl.host;

  // ── Find target ────────────────────────────────────────────────────────
  function findTarget() {
    var el = document.querySelector(targetSelector);
    if (!el) {
      console.error('[JobSnaps] target element not found: ' + targetSelector);
    }
    return el;
  }

  // ── Inject scoped styles once ──────────────────────────────────────────
  var STYLE_ID = 'jobsnaps-embed-styles';
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent =
      '.jobsnaps-gallery{display:grid;gap:1.25rem;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#111}' +
      '.jobsnaps-card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;display:flex;flex-direction:column;transition:transform .15s ease, box-shadow .15s ease}' +
      '.jobsnaps-card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.08)}' +
      '.jobsnaps-card__img{aspect-ratio:4/3;width:100%;background:#f3f4f6;object-fit:cover;display:block}' +
      '.jobsnaps-card__body{padding:1rem 1.125rem 1.25rem;display:flex;flex-direction:column;gap:.5rem}' +
      '.jobsnaps-card__title{font-size:1rem;font-weight:600;line-height:1.35;margin:0;color:#111}' +
      '.jobsnaps-card__desc{font-size:.875rem;line-height:1.5;color:#4b5563;margin:0;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}' +
      '.jobsnaps-card__loc{font-size:.75rem;color:#6b7280;margin-top:.25rem;display:flex;align-items:center;gap:.25rem}' +
      '.jobsnaps-card__loc svg{width:12px;height:12px;flex-shrink:0}' +
      '.jobsnaps-empty{padding:2.5rem 1rem;text-align:center;color:#6b7280;border:1px dashed #d1d5db;border-radius:12px}' +
      '.jobsnaps-error{padding:1rem;text-align:center;color:#b91c1c;background:#fef2f2;border:1px solid #fecaca;border-radius:12px}' +
      '.jobsnaps-loading{padding:2rem;text-align:center;color:#6b7280}' +
      '.jobsnaps-attrib{margin-top:1rem;font-size:.7rem;color:#9ca3af;text-align:center}' +
      '.jobsnaps-attrib a{color:#6b7280;text-decoration:none}' +
      '.jobsnaps-attrib a:hover{text-decoration:underline}' +
      (theme === 'dark'
        ? '.jobsnaps-card{background:#111827;border-color:#1f2937}.jobsnaps-card__title{color:#f9fafb}.jobsnaps-card__desc{color:#9ca3af}.jobsnaps-card__loc{color:#6b7280}'
        : '');
    document.head.appendChild(style);
  }

  // ── Escape helper to prevent XSS ───────────────────────────────────────
  function escapeHTML(str) {
    if (str == null) return '';
    var div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  // ── Render a single snap card ──────────────────────────────────────────
  function renderCard(snap) {
    var media = (snap.media && snap.media[0]) || null;
    var imgUrl = media && media.url;
    var imgAlt = (media && media.alt) || snap.title || 'Job photo';
    var title = snap.title || '';
    var desc = snap.description || '';
    var loc = snap.location || {};
    var locText = [loc.city, loc.state].filter(Boolean).join(', ');

    return (
      '<article class="jobsnaps-card">' +
      (imgUrl
        ? '<img class="jobsnaps-card__img" src="' +
          escapeHTML(imgUrl) +
          '" alt="' +
          escapeHTML(imgAlt) +
          '" loading="lazy" />'
        : '<div class="jobsnaps-card__img"></div>') +
      '<div class="jobsnaps-card__body">' +
      '<h3 class="jobsnaps-card__title">' +
      escapeHTML(title) +
      '</h3>' +
      (desc ? '<p class="jobsnaps-card__desc">' + escapeHTML(desc) + '</p>' : '') +
      (locText
        ? '<div class="jobsnaps-card__loc">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s-8-7.5-8-13a8 8 0 1 1 16 0c0 5.5-8 13-8 13z"/><circle cx="12" cy="9" r="3"/></svg>' +
          escapeHTML(locText) +
          '</div>'
        : '') +
      '</div>' +
      '</article>'
    );
  }

  // ── Render gallery ─────────────────────────────────────────────────────
  function render(target, snaps) {
    if (!snaps || !snaps.length) {
      target.innerHTML =
        '<div class="jobsnaps-empty">No work to display yet — check back soon.</div>' +
        attribution();
      return;
    }
    target.innerHTML =
      '<div class="jobsnaps-gallery">' +
      snaps.map(renderCard).join('') +
      '</div>' +
      attribution();
  }

  function renderError(target, message) {
    target.innerHTML =
      '<div class="jobsnaps-error">' + escapeHTML(message) + '</div>';
  }

  function attribution() {
    return (
      '<div class="jobsnaps-attrib">Powered by ' +
      '<a href="https://growlocal360.com" target="_blank" rel="noopener noreferrer">GrowLocal 360</a>' +
      '</div>'
    );
  }

  // ── Boot ───────────────────────────────────────────────────────────────
  function init() {
    var target = findTarget();
    if (!target) return;

    injectStyles();
    target.innerHTML =
      '<div class="jobsnaps-loading">Loading recent work…</div>';

    fetch(apiBase + '/api/v1/job-snaps?limit=' + encodeURIComponent(limit), {
      headers: { 'X-API-Key': apiKey },
    })
      .then(function (res) {
        if (!res.ok) {
          return res.json().then(
            function (j) {
              throw new Error(j.error || 'HTTP ' + res.status);
            },
            function () {
              throw new Error('HTTP ' + res.status);
            }
          );
        }
        return res.json();
      })
      .then(function (json) {
        render(target, json.data || []);
      })
      .catch(function (err) {
        console.error('[JobSnaps] failed to load:', err);
        renderError(target, 'Unable to load work right now. Please try again later.');
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
