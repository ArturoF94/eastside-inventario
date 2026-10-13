(function () {
  'use strict';

  var $ = function (selettore) { return document.querySelector(selettore); };
  var Access = window.EastsideAccess;
  var moduli = {};
  var stato = { profilo: null, titolare: false, scheda: 'conta' };

  function dataOra(valore) {
    if (!valore) return '—';
    return new Date(valore).toLocaleString('it-IT', {
      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome'
    });
  }

  function messaggio(errore, predefinito) {
    var m = errore && errore.message;
    return m && m.length < 200 ? m : predefinito;
  }

  /* Eliminazione in due tocchi: il primo tocco chiede conferma sul
     pulsante stesso, il secondo (entro 5 secondi) esegue l'azione. */
  function confermaInline(pulsante, testoConferma, azione) {
    pulsante.dataset.base = pulsante.textContent;
    pulsante.addEventListener('click', function () {
      if (pulsante.classList.contains('conferma')) {
        confermaInline.reset(pulsante);
        azione();
        return;
      }
      pulsante.classList.add('conferma');
      pulsante.textContent = typeof testoConferma === 'function' ? testoConferma() : testoConferma;
      clearTimeout(pulsante._timer);
      pulsante._timer = setTimeout(function () { confermaInline.reset(pulsante); }, 5000);
    });
  }
  confermaInline.reset = function (pulsante, testo) {
    clearTimeout(pulsante._timer);
    pulsante.classList.remove('conferma');
    pulsante.textContent = testo || pulsante.dataset.base || pulsante.textContent;
  };

  var ctx = {
    $: $,
    el: window.UI.el,
    txt: window.UI.txt,
    stato: stato,
    moduli: moduli,
    dataOra: dataOra,
    messaggio: messaggio,
    confermaInline: confermaInline,
    notifica: function (testo, tipo, opzioni) { window.UI.notifica(testo, tipo || 'info', opzioni); },
    esci: function (testo) { uscita(testo); }
  };

  moduli.conta = window.InventarioModuli.conta(ctx);
  moduli.titolare = window.InventarioModuli.titolare(ctx);
  moduli.catalogo = window.InventarioModuli.catalogo(ctx);
  moduli.utenti = window.InventarioModuli.utenti(ctx);
  moduli.assegna = window.InventarioModuli.assegna(ctx);
  moduli.fornitore = window.InventarioModuli.dettaglio(ctx, 'fornitore');
  moduli.categoria = window.InventarioModuli.dettaglio(ctx, 'categoria');

  var SCHEDE = {
    conta: { tab: '#tabConta', pannello: '#pConta', apri: function () { return moduli.conta.apri(); } },
    storico: { tab: '#tabStorico', pannello: '#pStorico', apri: function () { return moduli.titolare.apriStorico(); } },
    prodotti: { tab: '#tabProdotti', pannello: '#pProdotti', apri: function () { return moduli.catalogo.apriProdotti(); } },
    categorie: { tab: '#tabCategorie', pannello: '#pCategorie', apri: function () { return moduli.catalogo.apriCategorie(); } },
    fornitori: { tab: '#tabFornitori', pannello: '#pFornitori', apri: function () { return moduli.catalogo.apriFornitori(); } },
    utenti: { tab: '#tabUtenti', pannello: '#pUtenti', apri: function () { return moduli.utenti.apri(); } }
  };

  /* ---------- testata: i filtri fissi si agganciano sotto di essa ---------- */
  function misuraTestata() {
    var testata = $('#invTop');
    if (!testata || testata.hidden) return;
    document.documentElement.style.setProperty('--alt-testata', testata.offsetHeight + 'px');
  }
  window.addEventListener('resize', misuraTestata);
  if (window.ResizeObserver) new ResizeObserver(misuraTestata).observe($('#invTop'));

  /* ---------- tablet condiviso: nessun inventario a nome di un altro ----------
     Dopo un periodo senza tocchi la sessione si chiude; se si sta ancora
     salvando, si aspetta. Il salvataggio di un inventario chiude la sessione
     di un dipendente (vedi inventario-conta.js). */
  var INATTIVITA = { dipendente: 10 * 60 * 1000, titolare: 30 * 60 * 1000 };
  var PREAVVISO = 30 * 1000;
  var ultimoTocco = Date.now();
  var preavvisoMostrato = false;
  var guardia = null;
  var CHIAVE_MESSAGGIO = 'inventario_messaggio_uscita';

  function segnalaAttivita() { ultimoTocco = Date.now(); preavvisoMostrato = false; }
  ['pointerdown', 'keydown', 'touchstart', 'scroll'].forEach(function (tipo) {
    window.addEventListener(tipo, segnalaAttivita, { passive: true, capture: true });
  });

  function avviaGuardia() {
    segnalaAttivita();
    clearInterval(guardia);
    guardia = setInterval(function () {
      var limite = stato.titolare ? INATTIVITA.titolare : INATTIVITA.dipendente;
      var inattivo = Date.now() - ultimoTocco;
      if (inattivo >= limite) {
        if (moduli.conta && moduli.conta.inSospeso()) return;   // prima si finisce di salvare
        uscita('Disconnesso per inattività, per sicurezza. Accedi di nuovo per continuare.');
      } else if (inattivo >= limite - PREAVVISO && !preavvisoMostrato) {
        preavvisoMostrato = true;
        ctx.notifica('Per sicurezza ti disconnetto tra poco per inattività. Tocca lo schermo per restare.', 'warning', { durata: PREAVVISO });
      }
    }, 5000);
  }

  /* Chiude la sessione e torna all'accesso, con un messaggio. */
  function uscita(testo) {
    if (moduli.conta && moduli.conta.inSospeso()) {
      ctx.notifica('Sto ancora salvando le quantità: aspetta un istante e riprova.', 'warning');
      return;
    }
    clearInterval(guardia);
    DB.logout().then(function () {
      try { if (testo) sessionStorage.setItem(CHIAVE_MESSAGGIO, testo); } catch (e) { /* ignorato */ }
      location.reload();
    });
  }

  function messaggioUscita() {
    try {
      var testo = sessionStorage.getItem(CHIAVE_MESSAGGIO);
      sessionStorage.removeItem(CHIAVE_MESSAGGIO);
      return testo || '';
    } catch (e) { return ''; }
  }

  function mostraLogin(testo) {
    $('#vLogin').hidden = false;
    $('#vSchede').hidden = true;
    $('#invTop').hidden = true;
    window.UI.txt($('#errLogin'), testo || '');
  }

  function scegliScheda(nome) {
    stato.scheda = nome;
    Object.keys(SCHEDE).forEach(function (chiave) {
      $(SCHEDE[chiave].pannello).hidden = chiave !== nome;
      $(SCHEDE[chiave].tab).setAttribute('aria-selected', chiave === nome ? 'true' : 'false');
    });
    return SCHEDE[nome].apri();
  }

  function dopoLogin() {
    return DB.mioProfilo().then(function (profilo) {
      if (!Access.canUseInventory(profilo)) {
        return DB.logout().then(function () {
          mostraLogin('Il tuo account non è abilitato all\'inventario. Contatta il titolare.');
        });
      }
      stato.profilo = profilo;
      stato.titolare = Access.isOwner(profilo);
      window.UI.txt($('#whoName'), profilo.email || 'Staff');
      $('#vLogin').hidden = true;
      $('#vSchede').hidden = false;
      $('#invTop').hidden = false;
      $('#tabs').hidden = !stato.titolare;
      misuraTestata();
      avviaGuardia();
      return scegliScheda('conta');
    });
  }

  function avvia() {
    if (!window.DB || !DB.configurato) {
      mostraLogin('Database non configurato. Contatta l\'amministratore.');
      return;
    }
    DB.init().then(function (riuscita) {
      if (!riuscita) { mostraLogin('Collegamento al database non riuscito.'); return; }
      DB.sessione().then(function (utente) {
        if (utente) dopoLogin(); else mostraLogin(messaggioUscita());
      });
    });
  }

  $('#formLogin').addEventListener('submit', function (evento) {
    evento.preventDefault();
    var pulsante = $('#btnLogin');
    if (pulsante.disabled) return;
    window.UI.txt($('#errLogin'), '');
    pulsante.disabled = true;
    DB.login($('#email').value.trim(), $('#pw').value).then(function (risultato) {
      if (risultato.error) {
        pulsante.disabled = false;
        window.UI.txt($('#errLogin'), 'Email o password non validi.');
        return;
      }
      return dopoLogin().then(function () {
        pulsante.disabled = false;
        $('#pw').value = '';
      });
    }).catch(function () {
      pulsante.disabled = false;
      window.UI.txt($('#errLogin'), 'Errore di collegamento. Riprova.');
    });
  });

  $('#btnEsci').addEventListener('click', function () { uscita(''); });

  Object.keys(SCHEDE).forEach(function (nome) {
    $(SCHEDE[nome].tab).addEventListener('click', function () { scegliScheda(nome); });
  });

  function aggiornaRete() {
    $('#bannerOffline').hidden = navigator.onLine !== false;
  }
  window.addEventListener('offline', aggiornaRete);
  window.addEventListener('online', function () {
    aggiornaRete();
    moduli.conta.riprovaErrori();
  });
  aggiornaRete();

  avvia();
})();
