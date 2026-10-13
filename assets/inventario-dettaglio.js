(function () {
  'use strict';

  window.InventarioModuli = window.InventarioModuli || {};

  /* Scheda di dettaglio, riservata al titolare, per un fornitore o per una
     categoria: i prodotti assegnati (che si possono togliere) e un pannello
     per aggiungerne altri. La modifica dei dati apre il modulo di modifica e
     poi torna qui. Fornitori e categorie hanno lo stesso comportamento: cambia
     solo la configurazione. */
  window.InventarioModuli.dettaglio = function (ctx, tipo) {
    var $ = ctx.$;
    var el = ctx.el;
    var txt = ctx.txt;
    var SENZA = '__nessuna';

    var CONFIG = {
      fornitore: {
        prefisso: 'forDet', errore: '#errForDet', vista: '#forDettaglio',
        altreViste: ['#forElenco', '#forForm', '#forAssegna'],
        campoId: 'fornitore_id', campoNome: 'fornitore_nome', azione: 'fornitore',
        altro: { id: 'categoria_id', nome: 'categoria', tutti: 'Tutte le categorie', senza: 'Senza categoria' },
        carica: function () { return DB.inventarioFornitori(); },
        torna: function () { return ctx.moduli.catalogo.apriFornitori(); },
        modifica: function (entita, ritorno) { ctx.moduli.catalogo.modificaFornitore(entita, ritorno); },
        titolo: 'Prodotti di questo fornitore',
        vuoto: 'Nessun prodotto assegnato. Premi «+ Aggiungi prodotti».',
        tuttiGia: 'Tutti i prodotti sono già di questo fornitore.',
        avviso: ['prodotto è di un altro fornitore e verrà spostato', 'prodotti sono di altri fornitori e verranno spostati'],
        riga: function (p) { return (p.categoria || 'Senza categoria') + ' · ' + p.unita; },
        candidato: function (p) { return (p.categoria || 'Senza categoria') + ' · ' + (p.fornitore_nome ? 'ora di ' + p.fornitore_nome : 'nessun fornitore'); },
        sottotitolo: function (area, entita) {
          var presenti = false;
          if (entita.telefono) {
            var tel = el('a', entita.telefono);
            tel.href = 'tel:' + entita.telefono.replace(/[^+\d]/g, '');
            area.appendChild(tel);
            presenti = true;
          }
          if (entita.email) {
            if (presenti) area.appendChild(document.createTextNode(' · '));
            var posta = el('a', entita.email);
            posta.href = 'mailto:' + entita.email;
            area.appendChild(posta);
            presenti = true;
          }
          if (!presenti) area.textContent = 'Nessun contatto: aggiungili con «Modifica».';
        }
      },
      categoria: {
        prefisso: 'catDet', errore: '#errCatDet', vista: '#catDettaglio',
        altreViste: ['#catElenco', '#catForm'],
        campoId: 'categoria_id', campoNome: 'categoria', azione: 'categoria',
        altro: { id: 'fornitore_id', nome: 'fornitore_nome', tutti: 'Tutti i fornitori', senza: 'Senza fornitore' },
        carica: function () { return DB.inventarioCategorie(); },
        torna: function () { return ctx.moduli.catalogo.apriCategorie(); },
        modifica: function (entita, ritorno) { ctx.moduli.catalogo.modificaCategoria(entita, ritorno); },
        titolo: 'Prodotti di questa categoria',
        vuoto: 'Nessun prodotto in questa categoria. Premi «+ Aggiungi prodotti».',
        tuttiGia: 'Tutti i prodotti sono già in questa categoria.',
        avviso: ['prodotto è in un’altra categoria e verrà spostato', 'prodotti sono in altre categorie e verranno spostati'],
        riga: function (p) { return (p.fornitore_nome || 'nessun fornitore') + ' · ' + p.unita; },
        candidato: function (p) { return (p.fornitore_nome || 'nessun fornitore') + ' · ' + (p.categoria ? 'ora in ' + p.categoria : 'senza categoria'); },
        sottotitolo: function (area) {
          area.textContent = 'I prodotti di una categoria si trovano insieme durante la conta.';
        }
      }
    };

    var c = CONFIG[tipo];
    var entita = null;
    var tutti = [];            // catalogo completo
    var pannelloAperto = false;
    var selezione = {};
    var occupato = false;
    var filtri = { assegnati: '', candidati: '', altro: '' };

    function q(suffisso) { return $('#' + c.prefisso + suffisso); }

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
      c.altreViste.forEach(function (id) { $(id).hidden = true; });
      $(c.vista).hidden = false;
      window.scrollTo(0, 0);
    }

    /* ---------- apertura ---------- */
    function apri(id) {
      mostra();
      txt($(c.errore), '');
      q('Prodotti').textContent = 'Caricamento…';
      pannelloAperto = false;
      selezione = {};
      filtri = { assegnati: '', candidati: '', altro: '' };
      q('CercaAss').value = '';
      q('Cerca').value = '';
      return Promise.all([c.carica(), DB.inventarioCatalogo()]).then(function (r) {
        entita = (r[0] || []).filter(function (e) { return e.id === id; })[0];
        if (!entita) return c.torna();
        tutti = r[1] || [];
        disegna();
      }).catch(function (errore) {
        q('Prodotti').textContent = '';
        txt($(c.errore), ctx.messaggio(errore, 'Impossibile caricare la scheda. Riprova.'));
      });
    }

    function assegnati() {
      return tutti.filter(function (p) { return p[c.campoId] === entita.id; });
    }

    /* ---------- disegno ---------- */
    function disegna() {
      var scorrimento = window.scrollY;
      txt(q('Titolo'), entita.nome);
      var sottotitolo = q('Contatti');
      sottotitolo.textContent = '';
      c.sottotitolo(sottotitolo, entita);
      var mie = assegnati();
      txt(q('Conteggio'), c.titolo + ' (' + mie.length + ')');
      disegnaAssegnati(mie);
      q('Pannello').hidden = !pannelloAperto;
      q('Aggiungi').setAttribute('aria-expanded', pannelloAperto ? 'true' : 'false');
      txt(q('Aggiungi'), pannelloAperto ? 'Chiudi' : '+ Aggiungi prodotti');
      if (pannelloAperto) disegnaCandidati();
      window.scrollTo(0, scorrimento);
    }

    function disegnaAssegnati(mie) {
      var area = q('Prodotti');
      area.textContent = '';
      q('CercaAss').hidden = mie.length < 8;
      if (!mie.length) { area.appendChild(el('p', c.vuoto, 'vuoto')); return; }
      var visibili = mie.filter(function (p) {
        return !filtri.assegnati || normalizza(p.nome).indexOf(filtri.assegnati) !== -1;
      });
      if (!visibili.length) { area.appendChild(el('p', 'Nessun prodotto trovato.', 'vuoto')); return; }
      visibili.forEach(function (p) {
        var riga = el('div', null, 'voce' + (p.attivo ? '' : ' arch'));
        var nome = el('span', null, 'nm');
        nome.appendChild(document.createTextNode(p.nome));
        nome.appendChild(el('small', c.riga(p) + (p.attivo ? '' : ' · non incluso')));
        riga.appendChild(nome);
        var rimuovi = el('button', 'Rimuovi', 'btn-d');
        rimuovi.type = 'button';
        rimuovi.disabled = occupato;
        rimuovi.setAttribute('aria-label', 'Rimuovi ' + p.nome + ' da ' + entita.nome);
        rimuovi.addEventListener('click', function () { rimuoviProdotti([p.id]); });
        riga.appendChild(rimuovi);
        area.appendChild(riga);
      });
    }

    /* ---------- pannello: aggiungere prodotti ---------- */
    function candidati() {
      return tutti.filter(function (p) { return p.attivo && p[c.campoId] !== entita.id; });
    }

    function candidatoVisibile(p) {
      if (filtri.altro) {
        if (filtri.altro === SENZA ? !!p[c.altro.id] : p[c.altro.id] !== filtri.altro) return false;
      }
      return !filtri.candidati || normalizza(p.nome).indexOf(filtri.candidati) !== -1;
    }

    function popolaAltro() {
      var voci = {};
      candidati().forEach(function (p) { if (p[c.altro.id]) voci[p[c.altro.id]] = p[c.altro.nome]; });
      var sel = q('Altro');
      sel.textContent = '';
      sel.appendChild(opzione('', c.altro.tutti));
      sel.appendChild(opzione(SENZA, c.altro.senza));
      Object.keys(voci).sort(function (a, b) { return voci[a].localeCompare(voci[b], 'it'); })
        .forEach(function (id) { sel.appendChild(opzione(id, voci[id])); });
      sel.value = filtri.altro;
    }

    function disegnaCandidati() {
      popolaAltro();
      var area = q('Candidati');
      area.textContent = '';
      var elenco = candidati().filter(candidatoVisibile);
      if (!elenco.length) {
        area.appendChild(el('p', candidati().length ? 'Nessun prodotto trovato.' : c.tuttiGia, 'vuoto'));
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
      nome.appendChild(el('small', c.candidato(p)));
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
      txt(q('Sel'), plurale(ids.length, 'selezionato', 'selezionati'));
      var visibili = candidati().filter(candidatoVisibile);
      var tutteSel = visibili.length > 0 && visibili.every(function (p) { return selezione[p.id]; });
      txt(q('SelVis'), tutteSel ? 'Deseleziona visibili' : 'Seleziona visibili');
      var daAltri = tutti.filter(function (p) { return selezione[p.id] && p[c.campoId]; }).length;
      txt(q('Avviso'), daAltri ? plurale(daAltri, c.avviso[0], c.avviso[1]) + '.' : '');
      var conferma = q('Conferma');
      conferma.disabled = !ids.length || occupato;
      txt(conferma, ids.length ? 'Aggiungi ' + plurale(ids.length, 'prodotto', 'prodotti') : 'Aggiungi');
    }

    /* ---------- aggiungere e rimuovere ---------- */
    function applica(ids, destinazione, messaggio) {
      if (occupato || !ids.length) return;
      occupato = true;
      txt($(c.errore), '');
      disegna();
      DB.inventarioProdottiAzione(ids, c.azione, destinazione ? destinazione.id : '').then(function (esito) {
        var coinvolti = {};
        ids.forEach(function (id) { coinvolti[id] = true; delete selezione[id]; });
        tutti.forEach(function (p) {
          if (!coinvolti[p.id]) return;
          p[c.campoId] = destinazione ? destinazione.id : null;
          p[c.campoNome] = destinazione ? destinazione.nome : null;
        });
        entita.prodotti = assegnati().length;
        occupato = false;
        disegna();
        ctx.notifica(messaggio(esito.prodotti), 'success');
      }).catch(function (errore) {
        occupato = false;
        disegna();
        txt($(c.errore), ctx.messaggio(errore, 'Operazione non riuscita. Riprova.'));
      });
    }

    function rimuoviProdotti(ids) {
      applica(ids, null, function (n) { return plurale(n, 'prodotto rimosso', 'prodotti rimossi') + ' da ' + entita.nome; });
    }

    function aggiungiSelezionati() {
      applica(Object.keys(selezione), entita, function (n) {
        return plurale(n, 'prodotto aggiunto', 'prodotti aggiunti') + ' a ' + entita.nome;
      });
    }

    /* ---------- eventi ---------- */
    q('Indietro').addEventListener('click', function () { c.torna(); });
    q('Modifica').addEventListener('click', function () {
      c.modifica(entita, function (id) { return apri(id); });
    });
    q('Aggiungi').addEventListener('click', function () {
      pannelloAperto = !pannelloAperto;
      selezione = {};
      filtri.candidati = '';
      filtri.altro = '';
      q('Cerca').value = '';
      disegna();
      if (pannelloAperto) q('Cerca').focus();
    });
    q('CercaAss').addEventListener('input', function (evento) {
      filtri.assegnati = normalizza(evento.target.value.trim());
      disegnaAssegnati(assegnati());
    });
    q('Cerca').addEventListener('input', function (evento) {
      filtri.candidati = normalizza(evento.target.value.trim());
      disegnaCandidati();
    });
    q('Altro').addEventListener('change', function (evento) {
      filtri.altro = evento.target.value;
      disegnaCandidati();
    });
    q('SelVis').addEventListener('click', function () {
      var visibili = candidati().filter(candidatoVisibile);
      var tutteSel = visibili.length > 0 && visibili.every(function (p) { return selezione[p.id]; });
      visibili.forEach(function (p) { if (tutteSel) delete selezione[p.id]; else selezione[p.id] = true; });
      disegnaCandidati();
    });
    q('Conferma').addEventListener('click', aggiungiSelezionati);

    return { apri: apri };
  };
})();
