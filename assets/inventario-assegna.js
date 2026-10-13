(function () {
  'use strict';

  window.InventarioModuli = window.InventarioModuli || {};

  /* Assegnazione dei prodotti ai fornitori, riservata al titolare. Si
     trascina un prodotto (o tutti quelli selezionati) sul fornitore; in
     alternativa si selezionano i prodotti e si preme "Assegna qui". Il
     trascinamento usa gli eventi del puntatore, quindi funziona con mouse e
     dito; chi non trascina ha comunque il percorso con la selezione. */
  window.InventarioModuli.assegna = function (ctx) {
    var $ = ctx.$;
    var el = ctx.el;
    var txt = ctx.txt;

    var SENZA = '__nessuno';
    var prodotti = [];
    var fornitori = [];
    var selezione = {};
    var filtri = { ricerca: '', categoria: '', fornitore: '' };
    var occupato = false;

    function normalizza(testo) {
      return String(testo || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    }

    function plurale(n, singolare, plur) { return n + ' ' + (n === 1 ? singolare : plur); }

    function opzione(valore, testo) {
      var o = document.createElement('option');
      o.value = valore;
      o.textContent = testo;
      return o;
    }

    /* ---------- apertura e dati ---------- */
    function apri() {
      $('#forElenco').hidden = true;
      $('#forForm').hidden = true;
      $('#forAssegna').hidden = false;
      txt($('#errAssegna'), '');
      selezione = {};
      filtri = { ricerca: '', categoria: '', fornitore: '' };
      $('#assCerca').value = '';
      $('#assLista').textContent = 'Caricamento…';
      window.scrollTo(0, 0);
      return Promise.all([DB.inventarioCatalogo(), DB.inventarioFornitori()]).then(function (r) {
        prodotti = (r[0] || []).filter(function (p) { return p.attivo; });
        fornitori = r[1] || [];
        popolaFiltri();
        disegna();
      }).catch(function (errore) {
        $('#assLista').textContent = '';
        txt($('#errAssegna'), ctx.messaggio(errore, 'Impossibile caricare i dati. Riprova.'));
      });
    }

    function chiudi() {
      $('#forAssegna').hidden = true;
      return ctx.moduli.catalogo.apriFornitori();
    }

    function popolaFiltri() {
      var categorie = {};
      prodotti.forEach(function (p) { if (p.categoria_id) categorie[p.categoria_id] = p.categoria; });
      var selCategoria = $('#assCategoria');
      selCategoria.textContent = '';
      selCategoria.appendChild(opzione('', 'Tutte le categorie'));
      selCategoria.appendChild(opzione(SENZA, 'Senza categoria'));
      Object.keys(categorie).sort(function (a, b) { return categorie[a].localeCompare(categorie[b], 'it'); })
        .forEach(function (id) { selCategoria.appendChild(opzione(id, categorie[id])); });
      selCategoria.value = filtri.categoria;

      var selFornitore = $('#assFiltroFor');
      selFornitore.textContent = '';
      selFornitore.appendChild(opzione('', 'Tutti i fornitori'));
      selFornitore.appendChild(opzione(SENZA, 'Senza fornitore'));
      fornitori.forEach(function (f) { selFornitore.appendChild(opzione(f.id, f.nome)); });
      selFornitore.value = filtri.fornitore;
    }

    function visibile(p) {
      if (filtri.categoria) {
        if (filtri.categoria === SENZA ? !!p.categoria_id : p.categoria_id !== filtri.categoria) return false;
      }
      if (filtri.fornitore) {
        if (filtri.fornitore === SENZA ? !!p.fornitore_id : p.fornitore_id !== filtri.fornitore) return false;
      }
      if (filtri.ricerca && normalizza(p.nome).indexOf(filtri.ricerca) === -1) return false;
      return true;
    }

    /* ---------- disegno ---------- */
    function disegna() {
      var scorrimento = window.scrollY;
      disegnaProdotti();
      disegnaFornitori();
      aggiornaBarra();
      window.scrollTo(0, scorrimento);
    }

    function disegnaProdotti() {
      var area = $('#assLista');
      area.textContent = '';
      var elenco = prodotti.filter(visibile);
      if (!prodotti.length) {
        area.appendChild(el('p', 'Non ci sono prodotti. Aggiungili dalla scheda «Materie prime».', 'vuoto'));
        return;
      }
      if (!elenco.length) { area.appendChild(el('p', 'Nessun prodotto trovato.', 'vuoto')); return; }
      elenco.forEach(function (p) { area.appendChild(creaRiga(p)); });
    }

    function creaRiga(p) {
      var riga = el('div', null, 'voce ass-riga' + (selezione[p.id] ? ' sel' : ''));
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'cb';
      cb.checked = !!selezione[p.id];
      cb.setAttribute('aria-label', 'Seleziona ' + p.nome);
      var nome = el('span', null, 'nm');
      nome.appendChild(document.createTextNode(p.nome));
      nome.appendChild(el('small', (p.categoria || 'Senza categoria') + ' · ' + (p.fornitore_nome || 'nessun fornitore')));
      var grip = el('span', '⠿', 'grip');
      grip.setAttribute('aria-hidden', 'true');
      grip.title = 'Trascina su un fornitore';
      riga.appendChild(cb); riga.appendChild(nome); riga.appendChild(grip);

      function imposta(valore) {
        if (valore) selezione[p.id] = true; else delete selezione[p.id];
        cb.checked = valore;
        riga.classList.toggle('sel', valore);
        aggiornaBarra();
      }
      cb.addEventListener('change', function () { imposta(cb.checked); });
      riga.addEventListener('click', function (evento) {
        if (evento.target === cb || evento.target === grip) return;
        imposta(!cb.checked);
      });
      grip.addEventListener('click', function (evento) { evento.stopPropagation(); });
      grip.addEventListener('pointerdown', function (evento) { avviaTrascinamento(evento, p); });
      return riga;
    }

    function disegnaFornitori() {
      var area = $('#assFornitori');
      area.textContent = '';
      area.appendChild(creaZona(null));
      fornitori.forEach(function (f) { area.appendChild(creaZona(f)); });
    }

    function creaZona(f) {
      var id = f ? f.id : SENZA;
      var quanti = prodotti.filter(function (p) { return f ? p.fornitore_id === f.id : !p.fornitore_id; }).length;
      var zona = el('div', null, 'ass-zona');
      zona.dataset.drop = id;
      var testa = el('div', null, 'az-z');
      var nome = el('div');
      nome.appendChild(el('strong', f ? f.nome : 'Nessun fornitore'));
      var dettaglio = plurale(quanti, 'prodotto', 'prodotti');
      if (f && f.email) dettaglio += ' · ' + f.email;
      else if (f && f.telefono) dettaglio += ' · ' + f.telefono;
      nome.appendChild(el('small', dettaglio));
      testa.appendChild(nome);
      var assegnaQui = el('button', 'Assegna qui', 'btn-s');
      assegnaQui.type = 'button';
      assegnaQui.dataset.assegna = id;
      assegnaQui.addEventListener('click', function () { assegna(Object.keys(selezione), id); });
      testa.appendChild(assegnaQui);
      zona.appendChild(testa);
      return zona;
    }

    function aggiornaBarra() {
      var n = Object.keys(selezione).length;
      txt($('#assSelezionati'), plurale(n, 'selezionato', 'selezionati'));
      var visibili = prodotti.filter(visibile);
      var tutti = visibili.length > 0 && visibili.every(function (p) { return selezione[p.id]; });
      txt($('#assSelVisibili'), tutti ? 'Deseleziona visibili' : 'Seleziona visibili');
      $('#assDeseleziona').disabled = n === 0;
      document.querySelectorAll('#assFornitori [data-assegna]').forEach(function (b) { b.disabled = n === 0 || occupato; });
    }

    /* ---------- assegnazione ---------- */
    function assegna(ids, destinazione) {
      if (occupato || !ids.length) return;
      occupato = true;
      txt($('#errAssegna'), '');
      aggiornaBarra();
      var fornitore = destinazione === SENZA ? null : fornitori.filter(function (f) { return f.id === destinazione; })[0];
      DB.inventarioProdottiAzione(ids, 'fornitore', destinazione === SENZA ? '' : destinazione).then(function (esito) {
        var coinvolti = {};
        ids.forEach(function (id) { coinvolti[id] = true; delete selezione[id]; });
        prodotti.forEach(function (p) {
          if (!coinvolti[p.id]) return;
          p.fornitore_id = fornitore ? fornitore.id : null;
          p.fornitore_nome = fornitore ? fornitore.nome : null;
        });
        occupato = false;
        disegna();
        ctx.notifica(fornitore
          ? plurale(esito.prodotti, 'prodotto assegnato', 'prodotti assegnati') + ' a ' + fornitore.nome
          : plurale(esito.prodotti, 'prodotto senza più fornitore', 'prodotti senza più fornitore'), 'success');
      }).catch(function (errore) {
        occupato = false;
        aggiornaBarra();
        txt($('#errAssegna'), ctx.messaggio(errore, 'Assegnazione non riuscita. Riprova.'));
      });
    }

    /* ---------- trascinamento ---------- */
    function avviaTrascinamento(evento, prodotto) {
      if (occupato || (evento.button !== undefined && evento.button !== 0)) return;
      var grip = evento.currentTarget;
      evento.preventDefault();   // niente selezione di testo mentre si trascina
      var ids = selezione[prodotto.id] ? Object.keys(selezione) : [prodotto.id];
      var inizio = { x: evento.clientX, y: evento.clientY };
      var attivo = false;
      var ghost = null;
      var zonaSopra = null;
      try { grip.setPointerCapture(evento.pointerId); } catch (e) { /* ignorato */ }

      function evidenzia(zona) {
        if (zona === zonaSopra) return;
        if (zonaSopra) zonaSopra.classList.remove('sopra');
        zonaSopra = zona;
        if (zonaSopra) zonaSopra.classList.add('sopra');
      }

      function muovi(ev) {
        if (!attivo) {
          if (Math.hypot(ev.clientX - inizio.x, ev.clientY - inizio.y) < 6) return;
          attivo = true;
          ghost = el('div', ids.length > 1 ? plurale(ids.length, 'prodotto', 'prodotti') : prodotto.nome, 'ass-ghost');
          document.body.appendChild(ghost);
          document.body.classList.add('ass-trascina');
        }
        ghost.style.transform = 'translate(' + (ev.clientX + 14) + 'px,' + (ev.clientY + 14) + 'px)';
        var sotto = document.elementFromPoint(ev.clientX, ev.clientY);
        evidenzia(sotto && sotto.closest ? sotto.closest('[data-drop]') : null);
        if (ev.clientY < 70) window.scrollBy(0, -14);
        else if (ev.clientY > window.innerHeight - 70) window.scrollBy(0, 14);
      }

      function pulisci() {
        grip.removeEventListener('pointermove', muovi);
        grip.removeEventListener('pointerup', fine);
        grip.removeEventListener('pointercancel', annulla);
        document.removeEventListener('keydown', tasto);
        try { grip.releasePointerCapture(evento.pointerId); } catch (e) { /* ignorato */ }
        if (ghost) ghost.remove();
        document.body.classList.remove('ass-trascina');
        evidenzia(null);
      }
      function fine() {
        var destinazione = attivo && zonaSopra ? zonaSopra.dataset.drop : null;
        pulisci();
        if (destinazione) assegna(ids, destinazione);
      }
      function annulla() { pulisci(); }
      function tasto(ev) { if (ev.key === 'Escape') annulla(); }

      grip.addEventListener('pointermove', muovi);
      grip.addEventListener('pointerup', fine);
      grip.addEventListener('pointercancel', annulla);
      document.addEventListener('keydown', tasto);
    }

    /* ---------- eventi ---------- */
    $('#btnAssegnaFor').addEventListener('click', apri);
    $('#btnAssegnaChiudi').addEventListener('click', chiudi);
    $('#assCerca').addEventListener('input', function (evento) {
      filtri.ricerca = normalizza(evento.target.value.trim());
      disegnaProdotti();
      aggiornaBarra();
    });
    $('#assCategoria').addEventListener('change', function (evento) { filtri.categoria = evento.target.value; disegnaProdotti(); aggiornaBarra(); });
    $('#assFiltroFor').addEventListener('change', function (evento) { filtri.fornitore = evento.target.value; disegnaProdotti(); aggiornaBarra(); });
    $('#assSelVisibili').addEventListener('click', function () {
      var visibili = prodotti.filter(visibile);
      var tutti = visibili.length > 0 && visibili.every(function (p) { return selezione[p.id]; });
      visibili.forEach(function (p) { if (tutti) delete selezione[p.id]; else selezione[p.id] = true; });
      disegnaProdotti();
      aggiornaBarra();
    });
    $('#assDeseleziona').addEventListener('click', function () {
      selezione = {};
      disegnaProdotti();
      aggiornaBarra();
    });

    return { apri: apri };
  };
})();
