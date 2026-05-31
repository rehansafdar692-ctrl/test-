/**
 * W.H. Academy — PWA Install Handler v2
 * Always shows install buttons on landing page.
 * Hides after installation. No update banner.
 */
(function () {
  'use strict';

  /* ── Service Worker Registration ─────────────────────── */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./service-worker.js', { scope: './' })
        .then(function (reg) {
          console.log('[PWA] SW registered:', reg.scope);
        })
        .catch(function (err) {
          console.warn('[PWA] SW failed:', err);
        });
    });
  }

  /* ── Device Detection ─────────────────────────────────── */
  var ua           = navigator.userAgent || '';
  var isIOS        = /iphone|ipad|ipod/i.test(ua);
  var isSafari     = /^((?!chrome|android).)*safari/i.test(ua);
  var isAndroid    = /android/i.test(ua);
  var isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                     (window.navigator.standalone === true);

  /* ── Public API ───────────────────────────────────────── */
  window.WHAcademyPWA = {
    _deferredPrompt: null,

    triggerInstall: function (type) {
      if (type === 'ios') {
        showIOSModal();
      } else if (this._deferredPrompt) {
        var p = this._deferredPrompt;
        p.prompt();
        p.userChoice.then(function (choice) {
          if (choice.outcome === 'accepted') {
            hideSection();
            showSuccess();
          }
          window.WHAcademyPWA._deferredPrompt = null;
        });
      } else {
        // Prompt not available yet — show a friendly message
        var btn = document.querySelector('[data-pwa-install="android"], [data-pwa-install="desktop"]');
        if (btn) {
          btn.textContent = 'Use Chrome to install';
          btn.disabled = true;
          setTimeout(function () {
            btn.textContent = btn.getAttribute('data-original-text') || 'Install App';
            btn.disabled = false;
          }, 3000);
        }
      }
    },

    dismissIOSModal: function () {
      var m = document.getElementById('pwa-ios-modal');
      if (m) m.classList.remove('pwa-modal--visible');
    }
  };

  /* ── beforeinstallprompt (Android + Desktop) ──────────── */
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    window.WHAcademyPWA._deferredPrompt = e;
    // Enable the button now that prompt is ready
    var btns = document.querySelectorAll('[data-pwa-install="android"], [data-pwa-install="desktop"]');
    btns.forEach(function (b) { b.disabled = false; });
  });

  window.addEventListener('appinstalled', function () {
    window.WHAcademyPWA._deferredPrompt = null;
    hideSection();
    showSuccess();
  });

  /* ── DOM Ready: Show the correct cards ────────────────── */
  function init() {
    var section = document.getElementById('pwa-install-section');
    if (!section) return;

    // Already running as installed app → hide everything
    if (isStandalone) {
      section.style.display = 'none';
      return;
    }

    // Show the section
    section.removeAttribute('hidden');
    section.style.display = '';

    if (isIOS && isSafari) {
      showCard('ios');
    } else if (isAndroid) {
      showCard('android');
    } else {
      showCard('desktop');
    }
  }

  function showCard(platform) {
    var card = document.querySelector('[data-pwa-platform="' + platform + '"]');
    if (card) { card.style.display = 'flex'; card.removeAttribute('hidden'); }
    var btn = document.querySelector('[data-pwa-install="' + platform + '"]');
    if (btn) { btn.removeAttribute('hidden'); btn.style.display = ''; }
  }

  function hideSection() {
    var s = document.getElementById('pwa-install-section');
    if (s) s.style.display = 'none';
  }

  function showSuccess() {
    var fb = document.getElementById('pwa-install-success');
    if (fb) {
      fb.removeAttribute('hidden');
      fb.style.display = 'flex';
      setTimeout(function () { fb.style.display = 'none'; }, 5000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ── iOS Modal ────────────────────────────────────────── */
  function showIOSModal() {
    var modal = document.getElementById('pwa-ios-modal');
    if (!modal) {
      modal = buildIOSModal();
      document.body.appendChild(modal);
    }
    modal.offsetHeight; // reflow
    modal.classList.add('pwa-modal--visible');
  }

  function buildIOSModal() {
    var modal = document.createElement('div');
    modal.id = 'pwa-ios-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML =
      '<div class="pwa-modal__backdrop" onclick="WHAcademyPWA.dismissIOSModal()"></div>' +
      '<div class="pwa-modal__box">' +
        '<button class="pwa-modal__close" onclick="WHAcademyPWA.dismissIOSModal()" aria-label="Close">&#x2715;</button>' +
        '<div class="pwa-modal__icon"><img src="icons/icon-192x192.png" alt="WH Academy" width="80" height="80"></div>' +
        '<h2 class="pwa-modal__title">Install WH Academy on iPhone</h2>' +
        '<p class="pwa-modal__subtitle">No App Store needed! Add directly to your Home Screen.</p>' +
        '<ol class="pwa-modal__steps">' +
          '<li><span class="pwa-step-num">1</span><span>Tap the <strong>Share</strong> button <span style="font-size:1.2em">⎋</span> at the bottom of Safari</span></li>' +
          '<li><span class="pwa-step-num">2</span><span>Scroll and tap <strong>Add to Home Screen</strong> <span style="font-size:1.1em">＋</span></span></li>' +
          '<li><span class="pwa-step-num">3</span><span>Tap <strong>Add</strong> in the top-right corner</span></li>' +
        '</ol>' +
        '<button class="pwa-modal__done" onclick="WHAcademyPWA.dismissIOSModal()">Got it!</button>' +
      '</div>';

    if (!document.getElementById('pwa-modal-styles')) {
      var s = document.createElement('style');
      s.id = 'pwa-modal-styles';
      s.textContent = [
        '#pwa-ios-modal{position:fixed;inset:0;z-index:99999;display:flex;align-items:flex-end;justify-content:center;opacity:0;pointer-events:none;transition:opacity .3s}',
        '#pwa-ios-modal.pwa-modal--visible{opacity:1;pointer-events:auto}',
        '.pwa-modal__backdrop{position:absolute;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(4px)}',
        '.pwa-modal__box{position:relative;z-index:1;background:#fff;border-radius:28px 28px 0 0;padding:36px 28px 44px;width:100%;max-width:460px;box-shadow:0 -8px 40px rgba(0,0,0,.2);transform:translateY(50px);transition:transform .35s cubic-bezier(.34,1.56,.64,1);font-family:system-ui,sans-serif}',
        '#pwa-ios-modal.pwa-modal--visible .pwa-modal__box{transform:translateY(0)}',
        '.pwa-modal__close{position:absolute;top:16px;right:18px;background:#f1f1f1;border:none;border-radius:50%;width:32px;height:32px;font-size:15px;cursor:pointer;color:#555;display:flex;align-items:center;justify-content:center}',
        '.pwa-modal__icon{display:flex;justify-content:center;margin-bottom:18px}',
        '.pwa-modal__icon img{border-radius:20px;box-shadow:0 4px 20px rgba(0,0,0,.25)}',
        '.pwa-modal__title{font-size:1.25rem;font-weight:800;color:#1e1b4b;text-align:center;margin:0 0 8px}',
        '.pwa-modal__subtitle{font-size:.9rem;color:#6b7280;text-align:center;margin:0 0 24px}',
        '.pwa-modal__steps{list-style:none;padding:0;margin:0 0 28px;display:flex;flex-direction:column;gap:12px}',
        '.pwa-modal__steps li{display:flex;align-items:center;gap:14px;background:#f9f7ff;border-radius:14px;padding:14px 16px;font-size:.9rem;color:#374151}',
        '.pwa-step-num{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:.85rem;font-weight:700;flex-shrink:0}',
        '.pwa-modal__done{width:100%;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;border:none;border-radius:14px;padding:15px;font-size:1rem;font-weight:700;cursor:pointer;transition:opacity .2s}',
        '.pwa-modal__done:hover{opacity:.88}'
      ].join('');
      document.head.appendChild(s);
    }
    return modal;
  }

})();
