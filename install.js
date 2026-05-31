/**
 * W.H. Academy — PWA Install Handler v3
 * Fixes: buttons always work, proper fallbacks for all cases
 */
(function () {
  'use strict';

  var ua           = navigator.userAgent || '';
  var isIOS        = /iphone|ipad|ipod/i.test(ua);
  var isIPadOS     = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  var isSafari     = /safari/i.test(ua) && !/chrome|crios|fxios/i.test(ua);
  var isAndroid    = /android/i.test(ua);
  var isChrome     = /chrome|chromium/i.test(ua) && !/edge/i.test(ua);
  var isEdge       = /edg\//i.test(ua);
  var isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                     window.navigator.standalone === true;

  var deferredPrompt = null;

  /* ── Service Worker ───────────────────────────────────── */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./service-worker.js', { scope: './' })
        .then(function (r) { console.log('[SW] Registered:', r.scope); })
        .catch(function (e) { console.warn('[SW] Failed:', e); });
    });
  }

  /* ── Capture install prompt ───────────────────────────── */
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    console.log('[PWA] Install prompt captured');
    // Visually mark the button as ready
    var btns = document.querySelectorAll('[data-pwa-install="android"], [data-pwa-install="desktop"]');
    btns.forEach(function (b) {
      b.classList.add('pwa-btn--ready');
      b.disabled = false;
    });
  });

  window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    var s = document.getElementById('pwa-install-section');
    if (s) s.style.display = 'none';
    var fb = document.getElementById('pwa-install-success');
    if (fb) { fb.style.display = 'flex'; setTimeout(function(){ fb.style.display='none'; }, 6000); }
  });

  /* ── Public API (called by onclick in HTML) ───────────── */
  window.WHAcademyPWA = {

    triggerInstall: function (type) {
      if (type === 'ios' || isIOS || isIPadOS) {
        showIOSModal();
        return;
      }

      if (deferredPrompt) {
        // Native install prompt available — use it
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function (r) {
          console.log('[PWA] User choice:', r.outcome);
          deferredPrompt = null;
        });
        return;
      }

      // Prompt not available yet — guide user manually
      var isDesktop = !isAndroid && !isIOS && !isIPadOS;
      if (isAndroid) {
        showAndroidGuide();
      } else if (isDesktop && (isChrome || isEdge)) {
        showDesktopGuide();
      } else {
        showGenericGuide();
      }
    },

    dismissModal: function () {
      var m = document.getElementById('pwa-guide-modal');
      if (m) { m.classList.remove('pwa-modal--open'); setTimeout(function(){ m.remove(); }, 350); }
    }
  };

  /* ── Init on DOM ready ────────────────────────────────── */
  function init() {
    if (isStandalone) {
      var s = document.getElementById('pwa-install-section');
      if (s) s.style.display = 'none';
      return;
    }
    // Section is always visible in HTML — just highlight the right card
    var platform = (isIOS || isIPadOS) ? 'ios' : isAndroid ? 'android' : 'desktop';
    var card = document.querySelector('[data-pwa-platform="' + platform + '"]');
    if (card) card.classList.add('pwa-card--active');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ── iOS Modal ────────────────────────────────────────── */
  function showIOSModal() {
    openModal(
      'Install on iPhone / iPad',
      'No App Store needed. Takes 10 seconds!',
      [
        { icon: '⎋', text: 'Tap the <strong>Share</strong> button at the bottom of Safari' },
        { icon: '⊕', text: 'Tap <strong>Add to Home Screen</strong>' },
        { icon: '✓', text: 'Tap <strong>Add</strong> — done!' }
      ],
      null
    );
  }

  /* ── Android Guide (when prompt not yet fired) ─────────── */
  function showAndroidGuide() {
    openModal(
      'Install on Android',
      'Make sure you are using Chrome browser, then:',
      [
        { icon: '⋮', text: 'Tap the <strong>3-dot menu</strong> (top right of Chrome)' },
        { icon: '⊕', text: 'Tap <strong>Add to Home screen</strong> or <strong>Install app</strong>' },
        { icon: '✓', text: 'Tap <strong>Install</strong> — done!' }
      ],
      null
    );
  }

  /* ── Desktop Guide ────────────────────────────────────── */
  function showDesktopGuide() {
    openModal(
      'Install on Desktop',
      'Look for the install icon in your address bar:',
      [
        { icon: '🌐', text: 'In Chrome/Edge, look for the <strong>⊕ install icon</strong> at the right of the address bar' },
        { icon: '🖱', text: 'Click it and select <strong>Install</strong>' },
        { icon: '✓', text: 'The app will open in its own window!' }
      ],
      'If you do not see the icon, try refreshing the page once.'
    );
  }

  function showGenericGuide() {
    openModal(
      'Install WH Academy',
      'Use Chrome or Edge browser to install this app:',
      [
        { icon: '🌐', text: 'Open this page in <strong>Chrome</strong> or <strong>Edge</strong>' },
        { icon: '⊕', text: 'Look for <strong>Install app</strong> in the browser menu' },
        { icon: '✓', text: 'Tap Install and enjoy!' }
      ],
      null
    );
  }

  /* ── Modal Builder ────────────────────────────────────── */
  function openModal(title, subtitle, steps, note) {
    // Remove any existing modal
    var old = document.getElementById('pwa-guide-modal');
    if (old) old.remove();

    injectModalStyles();

    var stepsHTML = steps.map(function (s) {
      return '<li><span class="pgm-step-icon">' + s.icon + '</span><span>' + s.text + '</span></li>';
    }).join('');

    var noteHTML = note ? '<p class="pgm-note">' + note + '</p>' : '';

    var modal = document.createElement('div');
    modal.id = 'pwa-guide-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML =
      '<div class="pgm-backdrop" onclick="WHAcademyPWA.dismissModal()"></div>' +
      '<div class="pgm-box">' +
        '<button class="pgm-close" onclick="WHAcademyPWA.dismissModal()" aria-label="Close">✕</button>' +
        '<img class="pgm-logo" src="icons/icon-192x192.png" alt="WH Academy">' +
        '<h2 class="pgm-title">' + title + '</h2>' +
        '<p class="pgm-subtitle">' + subtitle + '</p>' +
        '<ol class="pgm-steps">' + stepsHTML + '</ol>' +
        noteHTML +
        '<button class="pgm-done" onclick="WHAcademyPWA.dismissModal()">Got it!</button>' +
      '</div>';

    document.body.appendChild(modal);
    // Force reflow then animate in
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        modal.classList.add('pwa-modal--open');
      });
    });
  }

  function injectModalStyles() {
    if (document.getElementById('pwa-modal-css')) return;
    var s = document.createElement('style');
    s.id = 'pwa-modal-css';
    s.textContent = [
      '#pwa-guide-modal{position:fixed;inset:0;z-index:99999;display:flex;align-items:flex-end;',
        'justify-content:center;opacity:0;pointer-events:none;',
        'transition:opacity .28s ease;}',
      '#pwa-guide-modal.pwa-modal--open{opacity:1;pointer-events:auto;}',
      '.pgm-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.65);backdrop-filter:blur(5px);}',
      '.pgm-box{position:relative;z-index:1;width:100%;max-width:460px;',
        'background:#fff;border-radius:28px 28px 0 0;padding:36px 26px 48px;',
        'box-shadow:0 -6px 40px rgba(0,0,0,.28);',
        'transform:translateY(60px);transition:transform .32s cubic-bezier(.22,1,.36,1);',
        'font-family:system-ui,-apple-system,sans-serif;}',
      '#pwa-guide-modal.pwa-modal--open .pgm-box{transform:translateY(0);}',
      '.pgm-close{position:absolute;top:14px;right:16px;width:30px;height:30px;',
        'border:none;border-radius:50%;background:#f0f0f0;cursor:pointer;',
        'font-size:14px;color:#555;display:flex;align-items:center;justify-content:center;}',
      '.pgm-logo{display:block;width:72px;height:72px;border-radius:18px;',
        'box-shadow:0 4px 18px rgba(0,0,0,.22);margin:0 auto 16px;}',
      '.pgm-title{font-size:1.2rem;font-weight:800;color:#1a1a2e;text-align:center;margin:0 0 6px;}',
      '.pgm-subtitle{font-size:.88rem;color:#555;text-align:center;margin:0 0 22px;line-height:1.5;}',
      '.pgm-steps{list-style:none;padding:0;margin:0 0 22px;display:flex;flex-direction:column;gap:10px;}',
      '.pgm-steps li{display:flex;align-items:center;gap:14px;',
        'background:#f7f5ff;border-radius:14px;padding:13px 15px;',
        'font-size:.88rem;color:#333;line-height:1.4;}',
      '.pgm-step-icon{font-size:1.3rem;width:32px;text-align:center;flex-shrink:0;',
        'font-weight:700;color:#4f46e5;}',
      '.pgm-note{font-size:.8rem;color:#888;text-align:center;margin:-10px 0 18px;font-style:italic;}',
      '.pgm-done{width:100%;padding:14px;border:none;border-radius:14px;',
        'background:linear-gradient(135deg,#b8860b,#d4af37);',
        'color:#0a0820;font-size:.95rem;font-weight:800;cursor:pointer;',
        'box-shadow:0 4px 14px rgba(212,175,55,.35);transition:opacity .2s;}',
      '.pgm-done:hover{opacity:.88;}'
    ].join('');
    document.head.appendChild(s);
  }

})();
