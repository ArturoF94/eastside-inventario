(function () {
  'use strict';

  window.InventarioModuli = window.InventarioModuli || {};

  /* Catalogo gestito dal titolare: prodotti (anche piu insieme), categorie
     e fornitori. Le categorie e i fornitori si possono creare al volo dalla
     scheda di un prodotto. */
  window.InventarioModuli.catalogo = function (ctx) {
    var $ = ctx.$;
    var el = ctx.el;
    var txt = ctx.txt;

    var SENZA = '__nessuno';
    var NUOVA = '__nuova';
    var UNITA = [
      ['pz', 'Pezzi'], ['bottiglie', 'Bottiglie'], ['fusti', 'Fusti'], ['confezioni', 'Confezioni'],
      ['scatole', 'Scatole'], ['porzione', 'Porzioni'], ['kg', 'Kg'], ['g', 'Grammi'], ['l', 'Litri'], ['ml', 'Millilitri']
    ];

    var catalogo = [];
    var categorie = [];
    var fornitori = [];
    var filtri = { ricerca: '', categoria: null, fornitore: null };
    var selezionando = false;
    var selezione = {};
    var prodottoInModifica = null;
    var categoriaInModifica = null;
    var ritornoCategoria = null;   // se la modifica parte dal dettaglio, ci si torna dopo
    var fornitoreInModifica = null;
    var ritornoFornitore = null;   // se la modifica parte dal dettaglio, ci si torna dopo

    function normalizza(testo) {
      return String(testo || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    }

    function numero(valore) {
      return Number(valore).toLocaleString('it-IT', { maximumFractionDigits: 3 });
    }

    function plurale(n, singolare, plur) { return n + ' ' + (n === 1 ? singolare : plur); }

    function caricaTutto() {
      return Promise.all([DB.inventarioCatalogo(), DB.inventarioCategorie(), DB.inventarioFornitori()]).then(function (r) {
        catalogo = r[0] || [];
        categorie = r[1] || [];
        fornitori = r[2] || [];
      });
    }

    function opzione(valore, testo) {
      var o = document.createElement('option');
      o.value = valore;
      o.textContent = testo;
      return o;
    }

    function chiudiVista(elenco, form) { $(form).hidden = true; $(elenco).hidden = false; window.scrollTo(0, 0); }
    function apriVista(elenco, form) { $(elenco).hidden = true; $(form).hidden = false; window.scrollTo(0, 0); }

    /* ============================================================
       PRODOTTI
       ============================================================ */
    function apriProdotti() {
      chiudiVista('#prodElenco', '#prodForm');
      txt($('#errProd'), '');
      $('#prodLista').textContent = 'Caricamento…';
      return caricaTutto().then(function () {
        selezione = {};
        disegnaProdotti();
      }).catch(function (errore) {
        $('#prodLista').textContent = '';
        txt($('#errProd'), ctx.messaggio(errore, 'Impossibile caricare i prodotti. Riprova.'));
      });
    }

    function prodottoVisibile(p) {
      if (filtri.categoria !== null) {
        if (filtri.categoria === SENZA ? !!p.categoria_id : p.categoria_id !== filtri.categoria) return false;
      }
      if (filtri.fornitore !== null) {
        if (filtri.fornitore === SENZA ? !!p.fornitore_id : p.fornitore_id !== filtri.fornitore) return false;
      }
      if (filtri.ricerca && normalizza(p.nome).indexOf(filtri.ricerca) === -1) return false;
      return true;
    }

    function chips(contenitore, etichettaTutti, voci, campoId, selezionato, alScegliere, etichettaSenza) {
      var scorrimento = contenitore.scrollLeft;
      contenitore.textContent = '';
      var elenco = [{ chiave: null, testo: etichettaTutti, n: catalogo.length }];
      voci.forEach(function (v) {
        elenco.push({
          chiave: v.id, testo: v.nome,
          n: catalogo.filter(function (p) { return p[campoId] === v.id; }).length
        });
      });
      var senza = catalogo.filter(function (p) { return !p[campoId]; }).length;
      if (senza) elenco.push({ chiave: SENZA, testo: etichettaSenza, n: senza });
      elenco.forEach(function (voce) {
        var b = el('button');
        b.type = 'button';
        b.setAttribute('aria-pressed', selezionato === voce.chiave ? 'true' : 'false');
        b.appendChild(document.createTextNode(voce.testo));
        b.appendChild(el('span', String(voce.n), 'n'));
        b.addEventListener('click', function () { alScegliere(selezionato === voce.chiave ? null : voce.chiave); });
        contenitore.appendChild(b);
      });
      contenitore.scrollLeft = scorrimento;
    }

    function disegnaProdotti() {
      chips($('#prodChipCategorie'), 'Tutte', categorie, 'categoria_id', filtri.categoria,
        function (valore) { filtri.categoria = valore; disegnaProdotti(); }, 'Senza categoria');
      chips($('#prodChipFornitori'), 'Tutti', fornitori, 'fornitore_id', filtri.fornitore,
        function (valore) { filtri.fornitore = valore; disegnaProdotti(); }, 'Senza fornitore');

      var area = $('#prodLista');
      area.textContent = '';
      if (!catalogo.length) {
        area.appendChild(el('p', 'Non ci sono materie prime. Aggiungine con «+ Nuovo prodotto».', 'vuoto'));
        aggiornaBarra();
        return;
      }

      var visibili = catalogo.filter(prodottoVisibile);
      if (!visibili.length) area.appendChild(el('p', 'Nessun prodotto trovato.', 'vuoto'));
      var corrente;
      visibili.forEach(function (p) {
        var gruppo = p.attivo ? (p.categoria || 'Senza categoria') : 'Non inclusi nell\'inventario';
        if (gruppo !== corrente) { corrente = gruppo; area.appendChild(el('h3', gruppo, 'gruppo-h')); }
        area.appendChild(cartaProdotto(p));
      });
      aggiornaBarra();
    }

    function cartaProdotto(p) {
      var b = el('button', null, 'voce' + (p.attivo ? '' : ' arch') + (selezione[p.id] ? ' sel' : ''));
      b.type = 'button';
      if (selezionando) {
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'cb';
        cb.tabIndex = -1;
        cb.checked = !!selezione[p.id];
        cb.setAttribute('aria-label', 'Seleziona ' + p.nome);
        b.appendChild(cb);
      }
      var nome = el('span', null, 'nm');
      nome.appendChild(document.createTextNode(p.nome));
      nome.appendChild(el('small', p.unita + ' · soglia ' + (p.scorta_minima > 0 ? numero(p.scorta_minima) : 'non impostata') +
        ' · ' + (p.fornitore_nome || 'nessun fornitore')));
      b.appendChild(nome);
      b.addEventListener('click', function () {
        if (!selezionando) { apriFormProdotto(p); return; }
        if (selezione[p.id]) delete selezione[p.id]; else selezione[p.id] = true;
        b.classList.toggle('sel', !!selezione[p.id]);
        b.querySelector('.cb').checked = !!selezione[p.id];
        aggiornaBarra();
      });
      return b;
    }

    function idSelezionati() { return Object.keys(selezione); }

    function aggiornaBarra() {
      $('#prodBarra').hidden = !selezionando;
      var n = idSelezionati().length;
      txt($('#prodBarraTesto'), plurale(n, 'selezionato', 'selezionati'));
      var visibili = catalogo.filter(prodottoVisibile);
      var tuttiSel = visibili.length > 0 && visibili.every(function (p) { return selezione[p.id]; });
      txt($('#btnSelTutti'), tuttiSel ? 'Deseleziona visibili' : 'Tutti quelli visibili');
      $('#btnBulkApplica').disabled = n === 0;
      $('#btnBulkElimina').disabled = n === 0;
      ctx.confermaInline.reset($('#btnBulkElimina'), 'Elimina');
      $('#btnSeleziona').setAttribute('aria-pressed', selezionando ? 'true' : 'false');
      txt($('#btnSeleziona'), selezionando ? 'Fine selezione' : 'Seleziona');
    }

    function popolaValoriBulk() {
      var sel = $('#bulkValore');
      sel.textContent = '';
      var tipo = $('#bulkTipo').value;
      if (tipo === 'categoria') {
        sel.appendChild(opzione('', 'Senza categoria'));
        categorie.forEach(function (c) { sel.appendChild(opzione(c.id, c.nome)); });
      } else if (tipo === 'fornitore') {
        sel.appendChild(opzione('', 'Senza fornitore'));
        fornitori.forEach(function (f) { sel.appendChild(opzione(f.id, f.nome)); });
      } else {
        UNITA.forEach(function (u) { sel.appendChild(opzione(u[0], u[1])); });
      }
    }

    function messaggioEsito(esito) {
      var parti = [];
      if (esito.eliminati) parti.push(plurale(esito.eliminati, 'prodotto eliminato', 'prodotti eliminati'));
      if (esito.archiviati) {
        parti.push(plurale(esito.archiviati, 'prodotto escluso', 'prodotti esclusi') +
          ' dall\'inventario perché già presenti in inventari o ricette');
      }
      return parti.join(' · ');
    }

    function applicaBulk(azione, valore) {
      var ids = idSelezionati();
      if (!ids.length) return;
      txt($('#errProd'), '');
      var pulsanti = [$('#btnBulkApplica'), $('#btnBulkElimina')];
      pulsanti.forEach(function (b) { b.disabled = true; });
      DB.inventarioProdottiAzione(ids, azione, valore).then(function (esito) {
        selezione = {};
        ctx.notifica(azione === 'elimina' ? (messaggioEsito(esito) || 'Fatto') :
          plurale(esito.prodotti, 'prodotto aggiornato', 'prodotti aggiornati'), 'success');
        return apriProdotti();
      }).catch(function (errore) {
        txt($('#errProd'), ctx.messaggio(errore, 'Operazione non riuscita. Riprova.'));
        aggiornaBarra();
      });
    }

    /* ---------- scheda prodotto ---------- */
    function riempiSceltaOpzionale(sel, voci, vuoto, nuovo, selezionato) {
      sel.textContent = '';
      sel.appendChild(opzione('', vuoto));
      voci.forEach(function (v) { sel.appendChild(opzione(v.id, v.nome)); });
      sel.appendChild(opzione(NUOVA, nuovo));
      sel.value = selezionato || '';
    }

    function aggiornaNuovi() {
      $('#pCategoriaNuovaBox').hidden = $('#pCategoria').value !== NUOVA;
      $('#pFornitoreNuovoBox').hidden = $('#pFornitore').value !== NUOVA;
    }

    function apriFormProdotto(prodotto) {
      prodottoInModifica = prodotto || null;
      txt($('#errProdForm'), '');
      txt($('#prodFormTitolo'), prodotto ? 'Modifica prodotto' : 'Nuovo prodotto');
      $('#pNome').value = prodotto ? prodotto.nome : '';
      $('#pUnita').value = prodotto ? prodotto.unita : 'pz';
      $('#pSoglia').value = prodotto && prodotto.scorta_minima > 0 ? String(prodotto.scorta_minima).replace('.', ',') : '';
      $('#pAttivo').checked = prodotto ? prodotto.attivo : true;
      $('#pCategoriaNuova').value = '';
      $('#pFornitoreNuovo').value = '';
      riempiSceltaOpzionale($('#pCategoria'), categorie, 'Senza categoria', '+ Nuova categoria…', prodotto && prodotto.categoria_id);
      riempiSceltaOpzionale($('#pFornitore'), fornitori, 'Nessun fornitore', '+ Nuovo fornitore…', prodotto && prodotto.fornitore_id);
      aggiornaNuovi();
      var elimina = $('#btnProdElimina');
      elimina.hidden = !prodotto;
      resetConferma(elimina, 'Elimina');
      apriVista('#prodElenco', '#prodForm');
      $('#pNome').focus();
    }

    function salvaProdotto() {
      var nome = $('#pNome').value.trim();
      var sogliaTesto = $('#pSoglia').value.trim().replace(',', '.');
      var categoria = $('#pCategoria').value;
      var fornitore = $('#pFornitore').value;
      var categoriaNuova = categoria === NUOVA ? $('#pCategoriaNuova').value.trim() : '';
      var fornitoreNuovo = fornitore === NUOVA ? $('#pFornitoreNuovo').value.trim() : '';
      if (!nome) { txt($('#errProdForm'), 'Scrivi il nome del prodotto.'); return; }
      if (sogliaTesto !== '' && !/^\d+(\.\d{1,3})?$/.test(sogliaTesto)) {
        txt($('#errProdForm'), 'La soglia minima deve essere un numero (es. 6 o 2,5).'); return;
      }
      if (categoria === NUOVA && !categoriaNuova) { txt($('#errProdForm'), 'Scrivi il nome della nuova categoria o scegline una.'); return; }
      if (fornitore === NUOVA && !fornitoreNuovo) { txt($('#errProdForm'), 'Scrivi il nome del nuovo fornitore o scegline uno.'); return; }
      txt($('#errProdForm'), '');
      var pulsanti = [$('#btnProdSalva'), $('#btnProdElimina'), $('#btnProdAnnulla')];
      pulsanti.forEach(function (b) { b.disabled = true; });
      DB.inventarioProdottoSalva({
        id: prodottoInModifica ? prodottoInModifica.id : null,
        nome: nome,
        unita: $('#pUnita').value,
        categoria_id: categoria && categoria !== NUOVA ? categoria : null,
        categoria_nuova: categoriaNuova,
        scorta_minima: sogliaTesto === '' ? 0 : Number(sogliaTesto),
        fornitore_id: fornitore && fornitore !== NUOVA ? fornitore : null,
        fornitore_nuovo: fornitoreNuovo,
        attivo: $('#pAttivo').checked
      }).then(function () {
        pulsanti.forEach(function (b) { b.disabled = false; });
        ctx.notifica('Prodotto salvato', 'success');
        return apriProdotti();
      }).catch(function (errore) {
        pulsanti.forEach(function (b) { b.disabled = false; });
        txt($('#errProdForm'), ctx.messaggio(errore, 'Salvataggio non riuscito. Riprova.'));
      });
    }

    function eliminaProdotto() {
      if (!prodottoInModifica) return;
      DB.inventarioProdottiAzione([prodottoInModifica.id], 'elimina').then(function (esito) {
        ctx.notifica(messaggioEsito(esito) || 'Fatto', 'success');
        return apriProdotti();
      }).catch(function (errore) {
        txt($('#errProdForm'), ctx.messaggio(errore, 'Eliminazione non riuscita. Riprova.'));
      });
    }

    /* ============================================================
       CATEGORIE
       ============================================================ */
    function apriCategorie() {
      $('#catDettaglio').hidden = true;
      ritornoCategoria = null;
      chiudiVista('#catElenco', '#catForm');
      txt($('#errCat'), '');
      $('#catLista').textContent = 'Caricamento…';
      return DB.inventarioCategorie().then(function (elenco) {
        categorie = elenco || [];
        disegnaCategorie();
      }).catch(function (errore) {
        $('#catLista').textContent = '';
        txt($('#errCat'), ctx.messaggio(errore, 'Impossibile caricare le categorie. Riprova.'));
      });
    }

    function disegnaCategorie() {
      var area = $('#catLista');
      area.textContent = '';
      if (!categorie.length) {
        area.appendChild(el('p', 'Nessuna categoria. Creane una (per esempio bar, cella, dispensa, cucina) oppure importa i prodotti dal menù.', 'vuoto'));
        return;
      }
      categorie.forEach(function (c) {
        var b = el('button', null, 'voce');
        b.type = 'button';
        b.appendChild(el('span', c.nome, 'nm'));
        b.appendChild(el('span', plurale(c.prodotti, 'prodotto', 'prodotti'), 'dx'));
        b.addEventListener('click', function () { ctx.moduli.categoria.apri(c.id); });
        area.appendChild(b);
      });
    }

    function apriFormCategoria(categoria, ritorno) {
      categoriaInModifica = categoria || null;
      ritornoCategoria = ritorno || null;
      $('#catDettaglio').hidden = true;
      txt($('#errCatForm'), '');
      txt($('#catFormTitolo'), categoria ? 'Modifica categoria' : 'Nuova categoria');
      $('#cNome').value = categoria ? categoria.nome : '';
      var elimina = $('#btnCatElimina');
      elimina.hidden = !categoria;
      resetConferma(elimina, 'Elimina');
      apriVista('#catElenco', '#catForm');
      $('#cNome').focus();
    }

    function salvaCategoria() {
      var nome = $('#cNome').value.trim();
      if (!nome) { txt($('#errCatForm'), 'Scrivi il nome della categoria.'); return; }
      txt($('#errCatForm'), '');
      var pulsante = $('#btnCatSalva');
      pulsante.disabled = true;
      DB.inventarioCategoriaSalva({ id: categoriaInModifica && categoriaInModifica.id, nome: nome }).then(function (esito) {
        pulsante.disabled = false;
        ctx.notifica('Categoria salvata', 'success');
        if (ritornoCategoria) {
          var torna = ritornoCategoria;
          ritornoCategoria = null;
          return torna(esito && esito.categoria ? esito.categoria : categoriaInModifica.id);
        }
        return apriCategorie();
      }).catch(function (errore) {
        pulsante.disabled = false;
        txt($('#errCatForm'), ctx.messaggio(errore, 'Salvataggio non riuscito. Riprova.'));
      });
    }

    function eliminaCategoria() {
      if (!categoriaInModifica) return;
      DB.inventarioCategoriaElimina(categoriaInModifica.id).then(function (esito) {
        ctx.notifica('Categoria eliminata' + (esito.prodotti_liberati ? ' · ' + plurale(esito.prodotti_liberati, 'prodotto resta', 'prodotti restano') + ' senza categoria' : ''), 'success');
        if (filtri.categoria === categoriaInModifica.id) filtri.categoria = null;
        ritornoCategoria = null;
        return apriCategorie();
      }).catch(function (errore) {
        txt($('#errCatForm'), ctx.messaggio(errore, 'Eliminazione non riuscita. Riprova.'));
      });
    }

    /* ============================================================
       FORNITORI
       ============================================================ */
    function apriFornitori() {
      $('#forAssegna').hidden = true;
      $('#forDettaglio').hidden = true;
      ritornoFornitore = null;
      chiudiVista('#forElenco', '#forForm');
      txt($('#errFor'), '');
      $('#forLista').textContent = 'Caricamento…';
      return DB.inventarioFornitori().then(function (elenco) {
        fornitori = elenco || [];
        disegnaFornitori();
      }).catch(function (errore) {
        $('#forLista').textContent = '';
        txt($('#errFor'), ctx.messaggio(errore, 'Impossibile caricare i fornitori. Riprova.'));
      });
    }

    function disegnaFornitori() {
      var area = $('#forLista');
      area.textContent = '';
      if (!fornitori.length) {
        area.appendChild(el('p', 'Nessun fornitore. Aggiungine uno per sapere da chi riordinare i prodotti.', 'vuoto'));
        return;
      }
      fornitori.forEach(function (f) {
        var b = el('button', null, 'voce');
        b.type = 'button';
        var nome = el('span', null, 'nm');
        nome.appendChild(document.createTextNode(f.nome));
        var contatti = [f.telefono, f.email].filter(Boolean).join(' · ');
        if (contatti) nome.appendChild(el('small', contatti));
        b.appendChild(nome);
        b.appendChild(el('span', plurale(f.prodotti, 'prodotto', 'prodotti'), 'dx'));
        b.addEventListener('click', function () { ctx.moduli.fornitore.apri(f.id); });
        area.appendChild(b);
      });
    }

    function apriFormFornitore(fornitore, ritorno) {
      fornitoreInModifica = fornitore || null;
      ritornoFornitore = ritorno || null;
      $('#forDettaglio').hidden = true;
      $('#forAssegna').hidden = true;
      txt($('#errForForm'), '');
      txt($('#forFormTitolo'), fornitore ? 'Modifica fornitore' : 'Nuovo fornitore');
      $('#fNome').value = fornitore ? fornitore.nome : '';
      $('#fTel').value = fornitore && fornitore.telefono ? fornitore.telefono : '';
      $('#fEmail').value = fornitore && fornitore.email ? fornitore.email : '';
      var elimina = $('#btnForElimina');
      elimina.hidden = !fornitore;
      resetConferma(elimina, 'Elimina');
      apriVista('#forElenco', '#forForm');
      $('#fNome').focus();
    }

    function salvaFornitore() {
      var nome = $('#fNome').value.trim();
      var email = $('#fEmail').value.trim();
      if (!nome) { txt($('#errForForm'), 'Scrivi il nome del fornitore.'); return; }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        txt($('#errForForm'), 'L\'email non è valida (esempio: ordini@fornitore.it).'); return;
      }
      txt($('#errForForm'), '');
      var pulsante = $('#btnForSalva');
      pulsante.disabled = true;
      DB.inventarioFornitoreSalva({
        id: fornitoreInModifica && fornitoreInModifica.id, nome: nome, telefono: $('#fTel').value.trim(), email: email
      }).then(function (esito) {
        pulsante.disabled = false;
        ctx.notifica('Fornitore salvato', 'success');
        if (ritornoFornitore) {
          var torna = ritornoFornitore;
          ritornoFornitore = null;
          return torna(esito && esito.fornitore ? esito.fornitore : fornitoreInModifica.id);
        }
        return apriFornitori();
      }).catch(function (errore) {
        pulsante.disabled = false;
        txt($('#errForForm'), ctx.messaggio(errore, 'Salvataggio non riuscito. Riprova.'));
      });
    }

    function eliminaFornitore() {
      if (!fornitoreInModifica) return;
      DB.inventarioFornitoreElimina(fornitoreInModifica.id).then(function (esito) {
        ctx.notifica('Fornitore eliminato' + (esito.prodotti_liberati ? ' · ' + plurale(esito.prodotti_liberati, 'prodotto resta', 'prodotti restano') + ' senza fornitore' : ''), 'success');
        if (filtri.fornitore === fornitoreInModifica.id) filtri.fornitore = null;
        ritornoFornitore = null;
        return apriFornitori();
      }).catch(function (errore) {
        txt($('#errForForm'), ctx.messaggio(errore, 'Eliminazione non riuscita. Riprova.'));
      });
    }

    /* ---------- conferma in due tocchi per le eliminazioni ---------- */
    function resetConferma(pulsante, testo) {
      ctx.confermaInline.reset(pulsante, testo);
    }

    /* ---------- eventi ---------- */
    $('#btnNuovoProd').addEventListener('click', function () { apriFormProdotto(null); });
    $('#btnSeleziona').addEventListener('click', function () {
      selezionando = !selezionando;
      selezione = {};
      if (selezionando) popolaValoriBulk();
      disegnaProdotti();
    });
    $('#prodCerca').addEventListener('input', function (evento) {
      filtri.ricerca = normalizza(evento.target.value.trim());
      disegnaProdotti();
    });
    $('#btnSelTutti').addEventListener('click', function () {
      var visibili = catalogo.filter(prodottoVisibile);
      var tuttiSel = visibili.length > 0 && visibili.every(function (p) { return selezione[p.id]; });
      visibili.forEach(function (p) { if (tuttiSel) delete selezione[p.id]; else selezione[p.id] = true; });
      disegnaProdotti();
    });
    $('#bulkTipo').addEventListener('change', popolaValoriBulk);
    $('#btnBulkApplica').addEventListener('click', function () {
      applicaBulk($('#bulkTipo').value, $('#bulkValore').value);
    });
    ctx.confermaInline($('#btnBulkElimina'), function () {
      return 'Elimina ' + plurale(idSelezionati().length, 'prodotto', 'prodotti') + '?';
    }, function () { applicaBulk('elimina', null); });
    $('#pCategoria').addEventListener('change', aggiornaNuovi);
    $('#pFornitore').addEventListener('change', aggiornaNuovi);
    $('#btnProdAnnulla').addEventListener('click', function () { chiudiVista('#prodElenco', '#prodForm'); });
    $('#btnProdSalva').addEventListener('click', salvaProdotto);
    ctx.confermaInline($('#btnProdElimina'), function () { return 'Conferma eliminazione'; }, eliminaProdotto);

    $('#btnNuovaCat').addEventListener('click', function () { apriFormCategoria(null); });
    $('#btnCatAnnulla').addEventListener('click', function () {
      if (ritornoCategoria && categoriaInModifica) {
        var torna = ritornoCategoria;
        ritornoCategoria = null;
        torna(categoriaInModifica.id);
        return;
      }
      chiudiVista('#catElenco', '#catForm');
    });
    $('#btnCatSalva').addEventListener('click', salvaCategoria);
    ctx.confermaInline($('#btnCatElimina'), function () {
      var n = categoriaInModifica ? categoriaInModifica.prodotti : 0;
      return n ? 'Conferma (' + plurale(n, 'prodotto resta', 'prodotti restano') + ' senza categoria)' : 'Conferma eliminazione';
    }, eliminaCategoria);

    $('#btnNuovoFor').addEventListener('click', function () { apriFormFornitore(null); });
    $('#btnForAnnulla').addEventListener('click', function () {
      if (ritornoFornitore && fornitoreInModifica) {
        var torna = ritornoFornitore;
        ritornoFornitore = null;
        torna(fornitoreInModifica.id);
        return;
      }
      chiudiVista('#forElenco', '#forForm');
    });
    $('#btnForSalva').addEventListener('click', salvaFornitore);
    ctx.confermaInline($('#btnForElimina'), function () {
      var n = fornitoreInModifica ? fornitoreInModifica.prodotti : 0;
      return n ? 'Conferma (' + plurale(n, 'prodotto resta', 'prodotti restano') + ' senza fornitore)' : 'Conferma eliminazione';
    }, eliminaFornitore);

    return {
      apriProdotti: apriProdotti, apriCategorie: apriCategorie, apriFornitori: apriFornitori,
      modificaFornitore: function (fornitore, ritorno) { apriFormFornitore(fornitore, ritorno); },
      modificaCategoria: function (categoria, ritorno) { apriFormCategoria(categoria, ritorno); }
    };
  };
})();
