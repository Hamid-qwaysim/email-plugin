/**
 * AI Revenue Recovery Engine — lightweight async tracker.
 *
 * Design goals: never block rendering, batch events, retry safely, respect
 * consent, and stay tiny. Sends batches to the plugin's same-origin REST
 * endpoint, which forwards them (signed) to the SaaS.
 */
(function () {
  'use strict';

  var cfg = window.ARRE_TRACK;
  if (!cfg || !cfg.endpoint) return;

  // Honor explicit consent mode: if the site requires opt-in, wait for it.
  if (cfg.consentMode === 'explicit' && !readConsent()) {
    // A site integration can call window.arreGrantConsent() later.
    window.arreGrantConsent = function () {
      writeConsent();
      start();
    };
    return;
  }

  start();

  function start() {
    var visitorId = getOrCreate('arre_vid', 60 * 60 * 24 * 365);
    var sessionId = getOrCreate('arre_sid', 60 * 30); // 30 min session
    var queue = [];
    var timer = null;
    var BATCH_MS = cfg.batchMs || 4000;

    function enqueue(type, props) {
      queue.push({
        type: type,
        ts: Date.now(),
        visitorId: visitorId,
        sessionId: sessionId,
        cartToken: readCookie('woocommerce_cart_hash') || undefined,
        props: props || {},
        page: { url: location.href, referrer: document.referrer, title: document.title },
      });
      schedule();
    }

    function schedule() {
      if (timer) return;
      timer = setTimeout(flush, BATCH_MS);
    }

    function flush(useBeacon) {
      if (timer) { clearTimeout(timer); timer = null; }
      if (!queue.length) return;
      var batch = queue.splice(0, 100);
      var body = JSON.stringify({ storeId: cfg.storeId, events: batch });

      if (useBeacon && navigator.sendBeacon) {
        navigator.sendBeacon(cfg.endpoint, new Blob([body], { type: 'application/json' }));
        return;
      }

      fetch(cfg.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': cfg.nonce },
        body: body,
        keepalive: true,
        credentials: 'same-origin',
      }).catch(function () {
        // Re-queue on failure so the next flush retries.
        queue = batch.concat(queue);
      });
    }

    // Page view.
    enqueue('page_view');

    // Heuristic product/category detection from body classes.
    var bc = document.body ? document.body.className : '';
    if (/single-product/.test(bc)) {
      enqueue('product_view', { productId: findProductId() });
    } else if (/(product-category|tax-product_cat)/.test(bc)) {
      enqueue('category_view');
    }

    // Add-to-cart clicks (WooCommerce default markup).
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (t && t.closest && t.closest('.add_to_cart_button, .single_add_to_cart_button')) {
        enqueue('add_to_cart', { productId: findProductId(t) });
      }
    }, { passive: true });

    // Scroll depth (25/50/75/100).
    var marks = { 25: false, 50: false, 75: false, 100: false };
    window.addEventListener('scroll', throttle(function () {
      var h = document.documentElement;
      var pct = Math.round(((h.scrollTop + window.innerHeight) / h.scrollHeight) * 100);
      [25, 50, 75, 100].forEach(function (m) {
        if (!marks[m] && pct >= m) { marks[m] = true; enqueue('scroll_depth', { depth: m }); }
      });
    }, 500), { passive: true });

    // Desktop exit intent.
    document.addEventListener('mouseout', function (e) {
      if (e.clientY <= 0 && !e.relatedTarget) enqueue('exit_intent');
    });

    // Flush remaining events on page hide.
    window.addEventListener('pagehide', function () { flush(true); });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') flush(true);
    });
  }

  /* ---------------- helpers ---------------- */
  function findProductId(el) {
    var node = (el && el.closest && el.closest('[data-product_id]')) ||
      document.querySelector('[data-product_id], button[name="add-to-cart"]');
    if (node) return node.getAttribute('data-product_id') || node.value || null;
    var m = document.body.className.match(/postid-(\d+)/);
    return m ? m[1] : null;
  }
  function getOrCreate(name, maxAge) {
    var v = readCookie(name);
    if (!v) { v = rand(); writeCookie(name, v, maxAge); }
    return v;
  }
  function rand() {
    return (Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
  }
  function readCookie(name) {
    var m = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
    return m ? decodeURIComponent(m.pop()) : '';
  }
  function writeCookie(name, value, maxAge) {
    document.cookie = name + '=' + encodeURIComponent(value) + ';path=/;max-age=' + maxAge + ';SameSite=Lax';
  }
  function readConsent() { return readCookie('arre_consent') === '1'; }
  function writeConsent() { writeCookie('arre_consent', '1', 60 * 60 * 24 * 180); }
  function throttle(fn, ms) {
    var last = 0;
    return function () {
      var now = Date.now();
      if (now - last >= ms) { last = now; fn.apply(this, arguments); }
    };
  }
})();
