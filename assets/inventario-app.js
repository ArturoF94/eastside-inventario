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
    notifica: function (testo, tipo) { window.UI.notifica(testo, tipo || 'info'); }
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
        if (utente) dopoLogin(); else mostraLogin('');
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

  $('#btnEsci').addEventListener('click', function () {
    DB.logout().then(function () { location.reload(); });
  });

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
