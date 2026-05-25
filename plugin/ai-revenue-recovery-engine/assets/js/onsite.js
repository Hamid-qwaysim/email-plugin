/**
 * AI Revenue Recovery Engine — on-site renderer. Renders popups / top bars /
 * exit-intent offers with client-side frequency caps. Tiny and dependency-free.
 */
(function () {
  'use strict';
  var cfg = window.ARRE_ONSITE;
  if (!cfg || !Array.isArray(cfg.elements) || !cfg.elements.length) return;

  var shown = false;

  // Page-load eligible elements (top bar, popup, slide-in).
  cfg.elements.forEach(function (el) {
    if (el.kind === 'top_bar' || el.kind === 'popup' || el.kind === 'slide_in') {
      if (eligible(el)) maybeRender(el);
    }
  });

  // Exit-intent (desktop).
  var exitEl = cfg.elements.find(function (e) { return e.kind === 'exit_intent'; });
  if (exitEl) {
    document.addEventListener('mouseout', function (e) {
      if (e.clientY <= 0 && !e.relatedTarget && eligible(exitEl)) maybeRender(exitEl);
    });
  }

  function eligible(el) {
    var f = el.frequency || {};
    if (f.perSession && count('s', el.id) >= f.perSession) return false;
    if (f.perDay && count('d', el.id) >= f.perDay) return false;
    if (f.cooldownMinutes) {
      var last = parseInt(localStorage.getItem('arre_seen_' + el.id) || '0', 10);
      if (last && Date.now() - last < f.cooldownMinutes * 60000) return false;
    }
    return true;
  }

  function maybeRender(el) {
    if (shown) return; // one element per page view
    shown = true;
    render(el);
    bump('s', el.id);
    bump('d', el.id);
    localStorage.setItem('arre_seen_' + el.id, String(Date.now()));
  }

  function render(el) {
    var c = el.content || {};
    var d = el.design || {};
    var color = d.color || '#4f46e5';

    if (el.kind === 'top_bar') {
      var bar = div('position:fixed;top:0;left:0;right:0;z-index:99999;background:' + color + ';color:#fff;padding:10px 16px;text-align:center;font:14px sans-serif');
      bar.textContent = safe(c.message || 'Special offer inside!');
      document.body.appendChild(bar);
      return;
    }

    // Modal-style popup / slide-in / exit-intent.
    var overlay = div('position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center');
    var box = div('background:#fff;max-width:420px;width:90%;border-radius:12px;padding:24px;font:15px sans-serif;position:relative');
    var close = div('position:absolute;top:10px;right:14px;cursor:pointer;font-size:20px;color:#999');
    close.textContent = '×';
    close.onclick = function () { document.body.removeChild(overlay); };
    var h = document.createElement('h3'); h.style.margin = '0 0 8px'; h.textContent = safe(c.title || 'Wait!');
    var p = document.createElement('p'); p.style.color = '#555'; p.textContent = safe(c.body || 'Complete your order and save.');
    box.appendChild(close); box.appendChild(h); box.appendChild(p);

    if (c.code) {
      var coupon = div('border:2px dashed ' + color + ';border-radius:8px;padding:10px;text-align:center;font-weight:bold;margin-top:10px');
      coupon.textContent = safe(c.code);
      box.appendChild(coupon);
    }
    overlay.appendChild(box);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) document.body.removeChild(overlay); });
    document.body.appendChild(overlay);
  }

  function div(style) { var d = document.createElement('div'); d.style.cssText = style; return d; }
  function safe(s) { return String(s == null ? '' : s); }
  function count(scope, id) {
    if (scope === 's') return parseInt(sessionStorage.getItem('arre_c_' + id) || '0', 10);
    var key = 'arre_d_' + id + '_' + new Date().toDateString();
    return parseInt(localStorage.getItem(key) || '0', 10);
  }
  function bump(scope, id) {
    if (scope === 's') { sessionStorage.setItem('arre_c_' + id, String(count('s', id) + 1)); return; }
    var key = 'arre_d_' + id + '_' + new Date().toDateString();
    localStorage.setItem(key, String(count('d', id) + 1));
  }
})();
