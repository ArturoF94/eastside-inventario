/* FILE GENERATO: non modificare manualmente.
 * Fonte: shared/ui/core.js; comando: npm run frontend:generate.
 */

(function (root, factory) {
  'use strict';

  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.UI = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function txt(nodo, testo) {
    if (nodo) nodo.textContent = testo == null ? '' : String(testo);
    return nodo;
  }

  function el(tag, testo, classi) {
    var nodo = document.createElement(tag);
    if (classi) nodo.className = classi;
    if (testo != null) nodo.textContent = String(testo);
    return nodo;
  }

  function focusabili(root) {
    return [].slice.call(root.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
      'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter(function (nodo) {
      return nodo.offsetParent !== null && nodo.getAttribute('aria-hidden') !== 'true';
    });
  }

  var precedente = null;
  var listenerDialoghiCollegato = false;

  function radiceDialogo(contenitore) {
    return contenitore.querySelector('[role="dialog"]') || contenitore;
  }

  function dialogoAperto() {
    return document.querySelector('.sheet.is-open, .overlay.is-open');
  }

  function apriDialog(contenitore, radice) {
    if (!contenitore) return;
    precedente = document.activeElement;
    contenitore.removeAttribute('inert');
    contenitore.classList.add('is-open');
    contenitore.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    var area = radice || radiceDialogo(contenitore);
    if (!area.hasAttribute('tabindex')) area.setAttribute('tabindex', '-1');
    var elementi = focusabili(area);
    setTimeout(function () {
      (elementi[0] || area).focus();
    }, 60);
  }

  function chiudiDialog(contenitore) {
    if (!contenitore) return;
    contenitore.classList.remove('is-open');
    contenitore.setAttribute('aria-hidden', 'true');
    contenitore.setAttribute('inert', '');
    if (!dialogoAperto()) document.body.style.overflow = '';
    if (precedente && precedente.focus) precedente.focus();
    precedente = null;
  }

  function apri(selettore) {
    var sheet = typeof selettore === 'string' ? document.querySelector(selettore) : selettore;
    if (!sheet) return;
    document.querySelectorAll('.sheet.is-open').forEach(function (aperta) {
      chiudiDialog(aperta);
    });
    apriDialog(sheet, sheet);
  }

  function chiudiTutto() {
    document.querySelectorAll('.sheet.is-open, .overlay.is-open').forEach(function (dialogo) {
      dialogo.classList.remove('is-open');
      dialogo.setAttribute('aria-hidden', 'true');
      dialogo.setAttribute('inert', '');
    });
    document.body.style.overflow = '';
    if (precedente && precedente.focus) precedente.focus();
    precedente = null;
  }

  function collegaSheet() {
    document.querySelectorAll('[data-chiudi]').forEach(function (bottone) {
      if (bottone.dataset.uiCloseReady) return;
      bottone.dataset.uiCloseReady = '1';
      bottone.addEventListener('click', chiudiTutto);
    });
    document.querySelectorAll('.sheet').forEach(function (sheet) {
      if (!sheet.hasAttribute('role')) sheet.setAttribute('role', 'dialog');
      sheet.setAttribute('aria-modal', 'true');
      sheet.setAttribute('aria-hidden', sheet.classList.contains('is-open') ? 'false' : 'true');
      if (sheet.classList.contains('is-open')) sheet.removeAttribute('inert');
      else sheet.setAttribute('inert', '');
      if (sheet.dataset.uiSheetReady) return;
      sheet.dataset.uiSheetReady = '1';
      sheet.addEventListener('click', function (evento) {
        if (evento.target === sheet) chiudiDialog(sheet);
      });
    });
    if (listenerDialoghiCollegato) return;
    listenerDialoghiCollegato = true;
    document.addEventListener('keydown', function (evento) {
      var contenitore = dialogoAperto();
      if (!contenitore) return;
      if (evento.key === 'Escape') {
        evento.preventDefault();
        chiudiDialog(contenitore);
        return;
      }
      if (evento.key !== 'Tab') return;
      var area = radiceDialogo(contenitore);
      var elementi = focusabili(area);
      if (!elementi.length) {
        evento.preventDefault();
        area.focus();
        return;
      }
      var primo = elementi[0];
      var ultimo = elementi[elementi.length - 1];
      if (evento.shiftKey && document.activeElement === primo) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primo.focus();
      }
    });
  }

  function preparaNotifiche() {
    var regione = document.getElementById('uiNoticeRegion');
    if (regione) return regione;
    var stile = document.createElement('style');
    stile.id = 'uiNoticeStyle';
    stile.textContent =
      '.ui-notice-region{position:fixed;z-index:10000;right:16px;top:16px;display:grid;gap:10px;' +
      'width:min(390px,calc(100vw - 32px));pointer-events:none}' +
      '.ui-notice{pointer-events:auto;display:grid;grid-template-columns:1fr auto;gap:12px;align-items:start;' +
      'padding:13px 14px;border-radius:10px;background:#171916;color:#f5f4ed;border:1px solid #596057;' +
      'box-shadow:0 10px 30px rgba(0,0,0,.28);font:500 14px/1.45 Inter,system-ui,sans-serif}' +
      '.ui-notice[data-type="success"]{border-color:#3fb950}' +
      '.ui-notice[data-type="error"]{border-color:#ff6b57}' +
      '.ui-notice[data-type="warning"]{border-color:#e9c46a}' +
      '.ui-notice button{border:0;background:transparent;color:inherit;font-size:20px;line-height:1;cursor:pointer}' +
      '@media(max-width:600px){.ui-notice-region{left:16px;right:16px;width:auto}}';
    document.head.appendChild(stile);
    regione = document.createElement('div');
    regione.id = 'uiNoticeRegion';
    regione.className = 'ui-notice-region';
    regione.setAttribute('aria-label', 'Notifiche');
    document.body.appendChild(regione);
    return regione;
  }

  function notifica(messaggio, tipo, opzioni) {
    if (!messaggio) return null;
    tipo = tipo || 'info';
    opzioni = opzioni || {};
    var regione = preparaNotifiche();
    var avviso = document.createElement('div');
    avviso.className = 'ui-notice';
    avviso.dataset.type = tipo;
    avviso.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
    avviso.setAttribute('aria-live', tipo === 'error' ? 'assertive' : 'polite');
    avviso.appendChild(el('span', messaggio));
    var chiudi = el('button', '×');
    chiudi.type = 'button';
    chiudi.setAttribute('aria-label', 'Chiudi notifica');
    chiudi.addEventListener('click', function () { avviso.remove(); });
    avviso.appendChild(chiudi);
    regione.appendChild(avviso);
    var durata = opzioni.durata != null ? opzioni.durata : (tipo === 'error' ? 6500 : 3200);
    if (durata > 0) setTimeout(function () { if (avviso.parentNode) avviso.remove(); }, durata);
    return avviso;
  }

  function allineaBarre(selSopra, selSotto) {
    var sopra = document.querySelector(selSopra);
    var sotto = document.querySelector(selSotto);
    if (!sopra || !sotto) return;
    function calcola() {
      sotto.style.top = sopra.offsetHeight + 'px';
    }
    calcola();
    window.addEventListener('resize', calcola);
    if (window.ResizeObserver) new ResizeObserver(calcola).observe(sopra);
  }

  return {
    txt: txt,
    el: el,
    apri: apri,
    apriDialog: apriDialog,
    chiudiDialog: chiudiDialog,
    chiudiTutto: chiudiTutto,
    collegaSheet: collegaSheet,
    allineaBarre: allineaBarre,
    focusabili: focusabili,
    notifica: notifica
  };
});
