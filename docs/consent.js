'use strict';

(() => {
  const CONSENT_KEY = 'turboimap-consent';
  const CONSENT_VERSION = 1;
  const MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;

  const isPortuguese = document.documentElement.lang.toLowerCase().startsWith('pt');
  const adsClient = document.querySelector('meta[name="turbo-ads"]')?.content || '';
  const analyticsId =
    document.querySelector('meta[name="turbo-analytics"]')?.content || '';

  const copy = isPortuguese
    ? {
        title: 'Cookies e privacidade',
        base: 'Usamos armazenamento local essencial para lembrar sua escolha.',
        analytics:
          ' Com seu consentimento, também usamos Google Analytics para medir o tráfego.',
        ads: ' Com seu consentimento, também usamos Google AdSense para exibir anúncios.',
        both:
          ' Com seu consentimento, também usamos Google Analytics e Google AdSense para medir o tráfego e exibir anúncios.',
        privacy: 'Ler a política de privacidade e cookies',
        privacyUrl: 'https://emileite.github.io/privacy.pt.html',
        accept: 'Aceitar todos',
        decline: 'Recusar não essenciais'
      }
    : {
        title: 'Cookies and privacy',
        base: 'We use essential local storage to remember your choice.',
        analytics:
          ' With your consent, we also use Google Analytics to measure traffic.',
        ads: ' With your consent, we also use Google AdSense to show ads.',
        both:
          ' With your consent, we also use Google Analytics and Google AdSense to measure traffic and show ads.',
        privacy: 'Read the privacy and cookies policy',
        privacyUrl: 'https://emileite.github.io/privacy.html',
        accept: 'Accept all',
        decline: 'Reject non-essential'
      };

  let activated = false;

  function safeRemoveConsent() {
    try {
      localStorage.removeItem(CONSENT_KEY);
    } catch {
      /* Storage may be unavailable in private browsing mode. */
    }
  }

  function readConsent() {
    try {
      const raw = localStorage.getItem(CONSENT_KEY);
      if (!raw) return null;

      const stored = JSON.parse(raw);
      const validChoice =
        stored?.version === CONSENT_VERSION &&
        (stored.choice === 'accepted' || stored.choice === 'declined') &&
        Number.isFinite(stored.ts);

      if (!validChoice || Date.now() - stored.ts > MAX_AGE_MS) {
        safeRemoveConsent();
        return null;
      }

      return stored;
    } catch {
      return null;
    }
  }

  function saveConsent(choice) {
    try {
      localStorage.setItem(
        CONSENT_KEY,
        JSON.stringify({
          version: CONSENT_VERSION,
          choice,
          ts: Date.now()
        })
      );
    } catch {
      /* The choice will still apply for the current page load. */
    }
  }

  function hasScript(srcPart) {
    return [...document.scripts].some(
      (script) => script.src && script.src.includes(srcPart)
    );
  }

  function loadAnalytics() {
    if (!analyticsId || hasScript('gtag/js')) {
      return;
    }

    window.dataLayer = window.dataLayer || [];
    window.gtag =
      window.gtag ||
      function gtag() {
        window.dataLayer.push(arguments);
      };

    window.gtag('js', new Date());
    window.gtag('config', analyticsId);

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(
      analyticsId
    )}`;
    document.head.appendChild(script);
  }

  function loadAdSense() {
    if (!adsClient || hasScript('adsbygoogle.js')) {
      return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(
      adsClient
    )}`;
    script.crossOrigin = 'anonymous';
    document.head.appendChild(script);
  }

  function activateConsentedServices() {
    if (activated) return;
    activated = true;
    loadAnalytics();
    loadAdSense();
  }

  function bannerText() {
    if (analyticsId && adsClient) return copy.base + copy.both;
    if (analyticsId) return copy.base + copy.analytics;
    if (adsClient) return copy.base + copy.ads;
    return copy.base;
  }

  function hideBanner(banner) {
    banner?.remove();
    document.body.classList.remove('has-cookie-banner');
  }

  function choose(choice, banner) {
    saveConsent(choice);
    hideBanner(banner);
    if (choice === 'accepted') activateConsentedServices();
  }

  function showBanner() {
    if (
      document.body.dataset.consentBanner === 'false' ||
      document.querySelector('[data-cookie-banner]')
    ) {
      return;
    }

    const banner = document.createElement('section');
    banner.className = 'cookie-banner';
    banner.dataset.cookieBanner = 'true';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-modal', 'false');
    banner.setAttribute('aria-labelledby', 'cookie-banner-title');
    banner.setAttribute('aria-describedby', 'cookie-banner-text');

    banner.innerHTML = `
      <div class="cookie-banner__inner">
        <div>
          <h2 id="cookie-banner-title">${copy.title}</h2>
          <p id="cookie-banner-text">
            ${bannerText()}
            <a href="${copy.privacyUrl}">${copy.privacy}</a>.
          </p>
        </div>
        <div class="cookie-banner__actions">
          <button type="button" class="cookie-banner__button" data-consent-choice="declined">
            ${copy.decline}
          </button>
          <button type="button" class="cookie-banner__button cookie-banner__button--primary" data-consent-choice="accepted">
            ${copy.accept}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(banner);
    document.body.classList.add('has-cookie-banner');

    banner
      .querySelector('[data-consent-choice="declined"]')
      ?.addEventListener('click', () => choose('declined', banner));

    banner
      .querySelector('[data-consent-choice="accepted"]')
      ?.addEventListener('click', () => choose('accepted', banner));
  }

  function resetFromSettings() {
    safeRemoveConsent();
    window.location.reload();
  }

  function handleCookieSettingsButtons() {
    document.querySelectorAll('[data-cookie-settings]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        resetFromSettings();
      });
    });
  }

  function handleSettingsQuery() {
    const url = new URL(window.location.href);

    if (!url.searchParams.has('cookie-settings')) return;

    safeRemoveConsent();
    url.searchParams.delete('cookie-settings');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }

  function init() {
    handleSettingsQuery();
    handleCookieSettingsButtons();

    const consent = readConsent();

    if (consent?.choice === 'accepted') {
      activateConsentedServices();
      return;
    }

    if (!consent) showBanner();
  }

  window.turboConsent = {
    show: showBanner,
    reset: resetFromSettings
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
