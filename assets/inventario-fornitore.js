(function () {
  'use strict';

  window.InventarioModuli = window.InventarioModuli || {};

  /* Scheda di dettaglio di un fornitore, riservata al titolare: contatti,
     prodotti assegnati (che si possono togliere) e un pannello per
     aggiungerne altri. La modifica dei dati del fornitore apre il modulo
     di modifica e poi torna qui. */
  window.InventarioModuli.fornitore = function (ctx) {
    var $ = ctx.$;
    var el = ctx.el;
    var txt = ctx.txt;

    var fornitore = null;
    var tutti = [];            // catalogo completo
    var pannelloAperto = false;
    var selezione = {};
    var occupato = false;
    var filtri = { assegnati: '', candidati: '', categoria: '' };
    var SENZA = '__nessuna';

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

    function mostra() {
      ['#forElenco', '#forForm', '#forAssegna'].forEach(function (id) { $(id).hidden = true; });
      $('#forDettaglio').hidden = false;
      window.scrollTo(0, 0);
    }

    /* ---------- apertura ---------- */
    function apri(id) {
      mostra();
      txt($('#errForDet'), '');
      $('#forDetProdotti').textContent = 'Caricamento…';
      pannelloAperto = false;
      selezione = {};
      filtri = { assegnati: '', candidati: '', categoria: '' };
      $('#forDetCercaAss').value = '';
      $('#forDetCerca').value = '';
      return Promise.all([DB.inventarioFornitori(), DB.inventarioCatalogo()]).then(function (r) {
        fornitore = (r[0] || []).filter(function (f) { return f.id === id; })[0];
        if (!fornitore) return ctx.moduli.catalogo.apriFornitori();
        tutti = r[1] || [];
        disegna();
      }).catch(function (errore) {
        $('#forDetProdotti').textContent = '';
        txt($('#errForDet'), ctx.messaggio(errore, 'Impossibile caricare il fornitore. Riprova.'));
      });
    }

    function assegnati() {
      return tutti.filter(function (p) { return p.fornitore_id === fornitore.id; });
    }

    /* ---------- disegno ---------- */
    function disegna() {
      var scorrimento = window.scrollY;
      txt($('#forDetTitolo'), fornitore.nome);
      disegnaContatti();
      var mie = assegnati();
      txt($('#forDetConteggio'), 'Prodotti di questo fornitore (' + mie.length + ')');
      disegnaAssegnati(mie);
      $('#forDetPannello').hidden = !pannelloAperto;
      $('#forDetAggiungi').setAttribute('aria-expanded', pannelloAperto ? 'true' : 'false');
      txt($('#forDetAggiungi'), pannelloAperto ? 'Chiudi' : '+ Aggiungi prodotti');
      if (pannelloAperto) disegnaCandidati();
      window.scrollTo(0, scorrimento);
    }

    function disegnaContatti() {
      var area = $('#forDetContatti');
      area.textContent = '';
      var presenti = false;
      if (fornitore.telefono) {
        var tel = el('a', fornitore.telefono);
        tel.href = 'tel:' + fornitore.telefono.replace(/[^+\d]/g, '');
        area.appendChild(tel);
        presenti = true;
      }
      if (fornitore.email) {
        if (presenti) area.appendChild(document.createTextNode(' · '));
        var posta = el('a', fornitore.email);
        posta.href = 'mailto:' + fornitore.email;
        area.appendChild(posta);
        presenti = true;
      }
      if (!presenti) area.textContent = 'Nessun contatto: aggiungili con «Modifica».';
    }

    function disegnaAssegnati(mie) {
      var area = $('#forDetProdotti');
      area.textContent = '';
      $('#forDetCercaAss').hidden = mie.length < 8;
      if (!mie.length) {
        area.appendChild(el('p', 'Nessun prodotto assegnato. Premi «+ Aggiungi prodotti».', 'vuoto'));
        return;
      }
      var visibili = mie.filter(function (p) {
        return !filtri.assegnati || normalizza(p.nome).indexOf(filtri.assegnati) !== -1;
      });
      if (!visibili.length) { area.appendChild(el('p', 'Nessun prodotto trovato.', 'vuoto')); return; }
      visibili.forEach(function (p) {
        var riga = el('div', null, 'voce' + (p.attivo ? '' : ' arch'));
        var nome = el('span', null, 'nm');
        nome.appendChild(document.createTextNode(p.nome));
        nome.appendChild(el('small', (p.categoria || 'Senza categoria') + ' · ' + p.unita + (p.attivo ? '' : ' · non incluso')));
        riga.appendChild(nome);
        var rimuovi = el('button', 'Rimuovi', 'btn-d');
        rimuovi.type = 'button';
        rimuovi.disabled = occupato;
        rimuovi.setAttribute('aria-label', 'Rimuovi ' + p.nome + ' da ' + fornitore.nome);
        rimuovi.addEventListener('click', function () { rimuoviProdotti([p.id]); });
        riga.appendChild(rimuovi);
        area.appendChild(riga);
      });
    }

    /* ---------- pannello: aggiungere prodotti ---------- */
    function candidati() {
      return tutti.filter(function (p) { return p.attivo && p.fornitore_id !== fornitore.id; });
    }

    function candidatoVisibile(p) {
      if (filtri.categoria) {
        if (filtri.categoria === SENZA ? !!p.categoria_id : p.categoria_id !== filtri.categoria) return false;
      }
      return !filtri.candidati || normalizza(p.nome).indexOf(filtri.candidati) !== -1;
    }

    function popolaCategorie() {
      var categorie = {};
      candidati().forEach(function (p) { if (p.categoria_id) categorie[p.categoria_id] = p.categoria; });
      var sel = $('#forDetCategoria');
      sel.textContent = '';
      sel.appendChild(opzione('', 'Tutte le categorie'));
      sel.appendChild(opzione(SENZA, 'Senza categoria'));
      Object.keys(categorie).sort(function (a, b) { return categorie[a].localeCompare(categorie[b], 'it'); })
        .forEach(function (id) { sel.appendChild(opzione(id, categorie[id])); });
      sel.value = filtri.categoria;
    }

    function disegnaCandidati() {
      popolaCategorie();
      var area = $('#forDetCandidati');
      area.textContent = '';
      var elenco = candidati().filter(candidatoVisibile);
      if (!elenco.length) {
        area.appendChild(el('p', candidati().length ? 'Nessun prodotto trovato.' : 'Tutti i prodotti sono già di questo fornitore.', 'vuoto'));
      }
      elenco.forEach(function (p) { area.appendChild(creaCandidato(p)); });
      aggiornaBarra();
    }

    function creaCandidato(p) {
      var riga = el('div', null, 'voce' + (selezione[p.id] ? ' sel' : ''));
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'cb';
      cb.checked = !!selezione[p.id];
      cb.setAttribute('aria-label', 'Seleziona ' + p.nome);
      var nome = el('span', null, 'nm');
      nome.appendChild(document.createTextNode(p.nome));
      nome.appendChild(el('small', (p.categoria || 'Senza categoria') + ' · ' +
        (p.fornitore_nome ? 'ora di ' + p.fornitore_nome : 'nessun fornitore')));
      riga.appendChild(cb); riga.appendChild(nome);
      function imposta(valore) {
        if (valore) selezione[p.id] = true; else delete selezione[p.id];
        cb.checked = valore;
        riga.classList.toggle('sel', valore);
        aggiornaBarra();
      }
      cb.addEventListener('change', function () { imposta(cb.checked); });
      riga.addEventListener('click', function (evento) { if (evento.target !== cb) imposta(!cb.checked); });
      return riga;
    }

    function aggiornaBarra() {
      var ids = Object.keys(selezione);
      txt($('#forDetSel'), plurale(ids.length, 'selezionato', 'selezionati'));
      var visibili = candidati().filter(candidatoVisibile);
      var tutteSel = visibili.length > 0 && visibili.every(function (p) { return selezione[p.id]; });
      txt($('#forDetSelVis'), tutteSel ? 'Deseleziona visibili' : 'Seleziona visibili');
      var daAltri = tutti.filter(function (p) { return selezione[p.id] && p.fornitore_id; }).length;
      txt($('#forDetAvviso'), daAltri ? plurale(daAltri, 'prodotto è di un altro fornitore e verrà spostato', 'prodotti sono di altri fornitori e verranno spostati') + '.' : '');
      var conferma = $('#forDetConferma');
      conferma.disabled = !ids.length || occupato;
      txt(conferma, ids.length ? 'Aggiungi ' + plurale(ids.length, 'prodotto', 'prodotti') : 'Aggiungi');
    }

    /* ---------- aggiungere e rimuovere ---------- */
    function applica(ids, nuovoFornitore, messaggio) {
      if (occupato || !ids.length) return;
      occupato = true;
      txt($('#errForDet'), '');
      disegna();
      DB.inventarioProdottiAzione(ids, 'fornitore', nuovoFornitore ? nuovoFornitore.id : '').then(function (esito) {
        var coinvolti = {};
        ids.forEach(function (id) { coinvolti[id] = true; delete selezione[id]; });
        tutti.forEach(function (p) {
          if (!coinvolti[p.id]) return;
          p.fornitore_id = nuovoFornitore ? nuovoFornitore.id : null;
          p.fornitore_nome = nuovoFornitore ? nuovoFornitore.nome : null;
        });
        fornitore.prodotti = assegnati().length;
        occupato = false;
        disegna();
        ctx.notifica(messaggio(esito.prodotti), 'success');
      }).catch(function (errore) {
        occupato = false;
        disegna();
        txt($('#errForDet'), ctx.messaggio(errore, 'Operazione non riuscita. Riprova.'));
      });
    }

    function rimuoviProdotti(ids) {
      applica(ids, null, function (n) { return plurale(n, 'prodotto rimosso', 'prodotti rimossi') + ' da ' + fornitore.nome; });
    }

    function aggiungiSelezionati() {
      var ids = Object.keys(selezione);
      applica(ids, fornitore, function (n) { return plurale(n, 'prodotto aggiunto', 'prodotti aggiunti') + ' a ' + fornitore.nome; });
    }

    /* ---------- eventi ---------- */
    $('#forDetIndietro').addEventListener('click', function () { ctx.moduli.catalogo.apriFornitori(); });
    $('#forDetModifica').addEventListener('click', function () {
      ctx.moduli.catalogo.modificaFornitore(fornitore, function (id) { return apri(id); });
    });
    $('#forDetAggiungi').addEventListener('click', function () {
      pannelloAperto = !pannelloAperto;
      selezione = {};
      filtri.candidati = '';
      filtri.categoria = '';
      $('#forDetCerca').value = '';
      disegna();
      if (pannelloAperto) $('#forDetCerca').focus();
    });
    $('#forDetCercaAss').addEventListener('input', function (evento) {
      filtri.assegnati = normalizza(evento.target.value.trim());
      disegnaAssegnati(assegnati());
    });
    $('#forDetCerca').addEventListener('input', function (evento) {
      filtri.candidati = normalizza(evento.target.value.trim());
      disegnaCandidati();
    });
    $('#forDetCategoria').addEventListener('change', function (evento) {
      filtri.categoria = evento.target.value;
      disegnaCandidati();
    });
    $('#forDetSelVis').addEventListener('click', function () {
      var visibili = candidati().filter(candidatoVisibile);
      var tutteSel = visibili.length > 0 && visibili.every(function (p) { return selezione[p.id]; });
      visibili.forEach(function (p) { if (tutteSel) delete selezione[p.id]; else selezione[p.id] = true; });
      disegnaCandidati();
    });
    $('#forDetConferma').addEventListener('click', aggiungiSelezionati);

    return { apri: apri };
  };
})();
