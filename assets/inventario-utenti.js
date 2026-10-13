(function () {
  'use strict';

  window.InventarioModuli = window.InventarioModuli || {};

  /* Utenti dell'inventario, riservato al titolare: crea gli account dei
     dipendenti con il permesso "inventario", ne cambia nome e permesso,
     li elimina. Creazione ed eliminazione passano dalla Edge Function
     gestisci-utenti (solo titolare). */
  window.InventarioModuli.utenti = function (ctx) {
    var $ = ctx.$;
    var el = ctx.el;
    var txt = ctx.txt;

    var utenti = [];
    var inModifica = null;   // null = nuovo utente

    function nomeVisibile(u) {
      if (u.nome) return u.nome;
      var locale = String(u.email || '').split('@')[0].replace(/[._]+/g, ' ').trim();
      return locale ? locale.replace(/\b\w/g, function (c) { return c.toUpperCase(); }) : 'Utente';
    }

    function apri() {
      $('#utForm').hidden = true;
      $('#utElenco').hidden = false;
      txt($('#errUt'), '');
      $('#utLista').textContent = 'Caricamento…';
      return DB.inventarioUtenti().then(function (elenco) {
        utenti = (elenco || []).filter(function (u) { return u.ruolo !== 'titolare'; });
        disegna();
      }).catch(function (errore) {
        $('#utLista').textContent = '';
        txt($('#errUt'), ctx.messaggio(errore, 'Impossibile caricare gli utenti. Riprova.'));
      });
    }

    function disegna() {
      var area = $('#utLista');
      area.textContent = '';
      if (!utenti.length) {
        area.appendChild(el('p', 'Nessun utente. Crea un account per ogni dipendente che deve fare l\'inventario.', 'vuoto'));
        return;
      }
      utenti.forEach(function (u) {
        var b = el('button', null, 'voce' + (u.attivo ? '' : ' arch'));
        b.type = 'button';
        var nome = el('span', null, 'nm');
        nome.appendChild(document.createTextNode(nomeVisibile(u)));
        nome.appendChild(el('small', u.email || ''));
        b.appendChild(nome);
        var abilitato = u.permessi && u.permessi.inventario === true;
        b.appendChild(el('span', u.attivo ? (abilitato ? 'Inventario' : 'Senza permesso inventario') : 'Disattivato',
          'badge ' + (u.attivo && abilitato ? 'verde' : 'grigio')));
        b.addEventListener('click', function () { apriForm(u); });
        area.appendChild(b);
      });
    }

    function apriForm(utente) {
      inModifica = utente || null;
      txt($('#errUtForm'), '');
      txt($('#utFormTitolo'), utente ? 'Modifica utente' : 'Nuovo utente');
      $('#uNome').value = utente ? (utente.nome || '') : '';
      $('#uNome').placeholder = utente ? nomeVisibile({ email: utente.email }) : 'Es. Mario Rossi';
      $('#uEmail').value = '';
      $('#uPw').value = '';
      $('#uPw').type = 'password';
      $('#uPwMostra').checked = false;
      $('#uEmailBox').hidden = !!utente;
      $('#uPwBox').hidden = !!utente;
      $('#uInventario').checked = utente ? !!(utente.permessi && utente.permessi.inventario === true) : true;
      var elimina = $('#btnUtElimina');
      elimina.hidden = !utente;
      ctx.confermaInline.reset(elimina, 'Elimina utente');
      $('#utElenco').hidden = true;
      $('#utForm').hidden = false;
      window.scrollTo(0, 0);
      (utente ? $('#uNome') : $('#uEmail')).focus();
    }

    function chiudiForm() {
      $('#utForm').hidden = true;
      $('#utElenco').hidden = false;
      window.scrollTo(0, 0);
    }

    function salva() {
      var nome = $('#uNome').value.trim();
      txt($('#errUtForm'), '');
      var pulsanti = [$('#btnUtSalva'), $('#btnUtElimina'), $('#btnUtAnnulla')];
      function blocca(si) { pulsanti.forEach(function (b) { b.disabled = si; }); }
      function errore(testo) { blocca(false); txt($('#errUtForm'), testo); }

      if (inModifica) {
        blocca(true);
        var permessi = Object.assign({}, inModifica.permessi || {});
        if ($('#uInventario').checked) permessi.inventario = true; else delete permessi.inventario;
        var passi = [];
        if (nome !== (inModifica.nome || '')) passi.push(DB.inventarioUtenteNome(inModifica.id, nome));
        if ($('#uInventario').checked !== (inModifica.permessi && inModifica.permessi.inventario === true)) {
          passi.push(DB.aggiornaPermessi(inModifica.id, permessi).then(function (esito) {
            if (esito && esito.ok === false) throw new Error(esito.errore || 'Permesso non aggiornato.');
          }));
        }
        Promise.all(passi).then(function () {
          blocca(false);
          ctx.notifica('Utente aggiornato', 'success');
          return apri();
        }).catch(function (e) { errore(ctx.messaggio(e, 'Salvataggio non riuscito. Riprova.')); });
        return;
      }

      var email = $('#uEmail').value.trim().toLowerCase();
      var password = $('#uPw').value;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { errore('Scrivi un\'email valida.'); return; }
      if (password.length < 8) { errore('La password deve avere almeno 8 caratteri.'); return; }
      blocca(true);
      DB.creaUtente({ email: email, password: password, permessi: $('#uInventario').checked ? { inventario: true } : {} })
        .then(function (esito) {
          if (!esito || esito.ok === false) throw new Error((esito && esito.errore) || 'Creazione non riuscita.');
          if (!nome) return null;
          return DB.inventarioUtenteNome(esito.id, nome);
        }).then(function () {
          blocca(false);
          ctx.notifica('Utente creato: comunica email e password al dipendente', 'success');
          return apri();
        }).catch(function (e) { errore(ctx.messaggio(e, 'Creazione non riuscita. Riprova.')); });
    }

    function elimina() {
      if (!inModifica) return;
      DB.eliminaUtente(inModifica.id).then(function (esito) {
        if (!esito || esito.ok === false) throw new Error((esito && esito.errore) || 'Eliminazione non riuscita.');
        ctx.notifica('Utente eliminato. Gli inventari che ha fatto restano nello storico.', 'success');
        return apri();
      }).catch(function (e) { txt($('#errUtForm'), ctx.messaggio(e, 'Eliminazione non riuscita. Riprova.')); });
    }

    $('#btnNuovoUt').addEventListener('click', function () { apriForm(null); });
    $('#btnUtAnnulla').addEventListener('click', chiudiForm);
    $('#btnUtSalva').addEventListener('click', salva);
    $('#uPwMostra').addEventListener('change', function () {
      $('#uPw').type = $('#uPwMostra').checked ? 'text' : 'password';
    });
    ctx.confermaInline($('#btnUtElimina'), function () { return 'Conferma eliminazione'; }, elimina);

    return { apri: apri };
  };
})();
