(function () {
  'use strict';

  window.InventarioModuli = window.InventarioModuli || {};

  /* Conta dei prodotti da tablet. Ogni quantita viene salvata sul server
     (RPC inventario_tablet_conta) pochi istanti dopo l'ultima modifica;
     "Salva inventario" e possibile solo quando tutte le righe sono contate
     e confermate dal server. */
  window.InventarioModuli.conta = function (ctx) {
    var $ = ctx.$;
    var el = ctx.el;
    var txt = ctx.txt;

    var SCHERMATE = ['contaPartenza', 'contaElenco', 'contaRiepilogo', 'contaFatto'];
    var ATTESA_SALVATAGGIO = 450;                 // ms dall'ultimo tocco su + o -
    var PASSO = { kg: 0.5, l: 0.5, g: 100, ml: 100 };   // le altre unita: 1
    var SENZA_FORNITORE = '__nessuno';

    var inv = null;          // { id, iniziato_il, operatore_nome }
    var righe = [];          // { id, nome, unita, categoria, fornitore, contata, valore, stato, ... }
    var filtri = { categoria: null, fornitore: null, ricerca: '', soloDaContare: false };
    var contatori = [];      // { span, fn } per aggiornare i numeri sui filtri senza ridisegnarli

    function mostraSchermata(id) {
      SCHERMATE.forEach(function (s) { $('#' + s).hidden = s !== id; });
      window.scrollTo(0, 0);
    }

    function messaggio(errore, predefinito) {
      var m = errore && errore.message;
      return m && m.length < 160 ? m : predefinito;
    }

    function normalizza(testo) {
      return String(testo || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    }

    function arrotonda(valore) { return Math.round(valore * 1000) / 1000; }
    function formatta(valore) { return valore == null ? '' : String(valore).replace('.', ','); }
    function passo(unita) { return PASSO[unita] || 1; }

    function analizza(testo) {
      var pulito = String(testo == null ? '' : testo).trim().replace(',', '.');
      if (pulito === '') return { vuoto: true };
      if (!/^\d+(\.\d{1,3})?$/.test(pulito)) return { errore: true };
      var valore = Number(pulito);
      if (!(valore >= 0) || valore > 1000000) return { errore: true };
      return { valore: valore };
    }

    /* ---------- avvio ---------- */
    function apri() {
      txt($('#errAvvia'), '');
      return DB.inventarioTabletStato().then(function (esito) {
        if (!esito || !esito.inventario) {
          inv = null; righe = [];
          txt($('#contaPartenzaTesto'), 'Nessun inventario in corso. Quando inizi, vedrai tutti i prodotti da contare.');
          mostraSchermata('contaPartenza');
          return;
        }
        applicaStato(esito);
        mostraSchermata('contaElenco');
        disegna();
      }).catch(function (errore) {
        mostraSchermata('contaPartenza');
        txt($('#errAvvia'), messaggio(errore, 'Impossibile leggere l\'inventario. Riprova.'));
      });
    }

    function applicaStato(esito) {
      var locali = {};
      righe.forEach(function (r) { if (r.stato === 'salvataggio' || r.stato === 'errore') locali[r.id] = r; });
      if (!inv || inv.id !== esito.inventario.id) {
        filtri = { categoria: null, fornitore: null, ricerca: '', soloDaContare: false };
        $('#cerca').value = '';
        locali = {};
      }
      inv = esito.inventario;
      righe = (esito.righe || []).map(function (r) {
        if (locali[r.id]) return locali[r.id];
        var contata = r.contata == null ? null : Number(r.contata);
        return {
          id: r.id, nome: r.nome, unita: r.unita,
          categoria: r.categoria || 'Senza categoria', fornitore: r.fornitore || null,
          cerca: normalizza(r.nome),
          contata: contata, valore: contata, stato: contata == null ? 'vuoto' : 'ok',
          coda: Promise.resolve(), timer: null
        };
      });
    }

    function avvia() {
      var pulsante = $('#btnAvvia');
      pulsante.disabled = true;
      txt($('#errAvvia'), '');
      return DB.inventarioTabletAvvia().then(function () {
        pulsante.disabled = false;
        return apri();
      }).catch(function (errore) {
        pulsante.disabled = false;
        txt($('#errAvvia'), messaggio(errore, 'Non riesco ad avviare l\'inventario. Riprova.'));
      });
    }

    /* ---------- filtri ---------- */
    function visibile(r) {
      if (filtri.categoria !== null && r.categoria !== filtri.categoria) return false;
      if (filtri.fornitore !== null) {
        if (filtri.fornitore === SENZA_FORNITORE ? !!r.fornitore : r.fornitore !== filtri.fornitore) return false;
      }
      if (filtri.soloDaContare && r.stato === 'ok') return false;
      if (filtri.ricerca && r.cerca.indexOf(filtri.ricerca) === -1) return false;
      return true;
    }

    function elencoValori(campo) {
      var visti = {};
      righe.forEach(function (r) { visti[r[campo] || ''] = true; });
      return Object.keys(visti).filter(Boolean).sort(function (a, b) { return a.localeCompare(b, 'it'); });
    }

    function creaChips(contenitore, etichettaTutti, valori, campo, selezionato, alScegliere, senzaValore) {
      var scorrimento = contenitore.scrollLeft;
      contenitore.textContent = '';
      var voci = [{ chiave: null, testo: etichettaTutti, test: function () { return true; } }];
      valori.forEach(function (v) {
        voci.push({ chiave: v, testo: v, test: function (r) { return r[campo] === v; } });
      });
      if (senzaValore && righe.some(function (r) { return !r[campo]; })) {
        voci.push({ chiave: SENZA_FORNITORE, testo: 'Senza fornitore', test: function (r) { return !r[campo]; } });
      }
      voci.forEach(function (voce) {
        var b = el('button');
        b.type = 'button';
        b.setAttribute('aria-pressed', selezionato === voce.chiave ? 'true' : 'false');
        b.appendChild(document.createTextNode(voce.testo));
        var n = el('span', '', 'n');
        b.appendChild(n);
        b.addEventListener('click', function () { alScegliere(selezionato === voce.chiave ? null : voce.chiave); });
        contenitore.appendChild(b);
        contatori.push({ span: n, voce: voce });
      });
      contenitore.scrollLeft = scorrimento;
    }

    function aggiornaContatori() {
      contatori.forEach(function (c) {
        var tutte = righe.filter(c.voce.test);
        var fatte = tutte.filter(function (r) { return r.stato === 'ok'; }).length;
        c.span.textContent = fatte + '/' + tutte.length;
      });
    }

    function disegnaFiltri() {
      contatori = [];
      creaChips($('#chipCategorie'), 'Tutte', elencoValori('categoria'), 'categoria', filtri.categoria,
        function (valore) { filtri.categoria = valore; disegna(); }, false);
      creaChips($('#chipFornitori'), 'Tutti', elencoValori('fornitore'), 'fornitore', filtri.fornitore,
        function (valore) { filtri.fornitore = valore; disegna(); }, true);
      $('#btnDaContare').setAttribute('aria-pressed', filtri.soloDaContare ? 'true' : 'false');
      aggiornaContatori();
    }

    /* ---------- elenco ---------- */
    function disegna() {
      if (!inv) return;
      txt($('#contaIntestazione'), 'Iniziato da ' + inv.operatore_nome + ' il ' + ctx.dataOra(inv.iniziato_il) +
        '. Altri colleghi possono contare in parallelo da un altro tablet: tocca "Aggiorna" per vedere i loro progressi.');
      disegnaFiltri();
      var area = $('#righe');
      area.textContent = '';
      var corrente = null;
      var mostrate = 0;
      righe.forEach(function (r) {
        r.nodo = null;
        if (!visibile(r)) return;
        if (r.categoria !== corrente) {
          corrente = r.categoria;
          area.appendChild(el('h3', corrente, 'gruppo-h'));
        }
        area.appendChild(creaRiga(r));
        mostrate += 1;
      });
      if (!mostrate) {
        area.appendChild(el('p', filtri.soloDaContare && !filtri.ricerca && filtri.categoria === null && filtri.fornitore === null
          ? 'Tutto contato!' : 'Nessun prodotto trovato.', 'vuoto'));
      }
      aggiornaAvanzamento();
    }

    function creaRiga(r) {
      var nodo = el('div', null, 'riga');
      var nome = el('div', null, 'nm');
      nome.appendChild(document.createTextNode(r.nome));
      if (r.fornitore) nome.appendChild(el('small', r.fornitore, 'forn'));
      nodo.appendChild(nome);

      var qta = el('div', null, 'qta');
      var meno = el('button', '−', 'pm meno');
      meno.type = 'button';
      meno.setAttribute('aria-label', 'Diminuisci ' + r.nome);
      var input = document.createElement('input');
      input.type = 'text';
      input.inputMode = 'decimal';
      input.autocomplete = 'off';
      input.setAttribute('aria-label', 'Quantità contata di ' + r.nome + ' (' + r.unita + ')');
      input.placeholder = '—';
      var piu = el('button', '+', 'pm piu');
      piu.type = 'button';
      piu.setAttribute('aria-label', 'Aumenta ' + r.nome);
      var unita = el('span', r.unita, 'u');
      var icona = el('span', '', 'stato');
      qta.appendChild(meno); qta.appendChild(input); qta.appendChild(piu);
      qta.appendChild(unita); qta.appendChild(icona);
      nodo.appendChild(qta);

      r.nodo = nodo; r.input = input; r.icona = icona; r.nomeNodo = nome;
      input.value = r.stato === 'errore' && r.testoDigitato != null ? r.testoDigitato : formatta(r.valore);
      aggiornaRiga(r);

      meno.addEventListener('click', function () {
        imposta(r, r.valore == null ? 0 : Math.max(0, r.valore - passo(r.unita)), false);
      });
      piu.addEventListener('click', function () {
        imposta(r, (r.valore == null ? 0 : r.valore) + passo(r.unita), false);
      });
      input.addEventListener('focus', function () { input.select(); });
      input.addEventListener('change', function () { confermaDigitato(r); });
      input.addEventListener('blur', function () { if (r.stato === 'errore') confermaDigitato(r); });
      input.addEventListener('keydown', function (evento) {
        if (evento.key !== 'Enter') return;
        evento.preventDefault();
        var tutti = [].slice.call(document.querySelectorAll('#righe .qta input'));
        var i = tutti.indexOf(input);
        input.blur();
        if (i > -1 && tutti[i + 1]) tutti[i + 1].focus();
      });
      return nodo;
    }

    function aggiornaRiga(r) {
      if (!r.nodo) return;
      r.nodo.classList.toggle('fatto', r.stato === 'ok');
      r.nodo.classList.toggle('errore', r.stato === 'errore');
      r.icona.className = 'stato' + (r.stato === 'ok' ? ' ok' : (r.stato === 'errore' ? ' ko' : ''));
      txt(r.icona, r.stato === 'ok' ? '✓' : (r.stato === 'errore' ? '!' : (r.stato === 'salvataggio' ? '…' : '')));
      r.icona.setAttribute('aria-label', r.stato === 'ok' ? 'Salvato' : (r.stato === 'errore' ? 'Non salvato' : ''));
      var vecchio = r.nomeNodo.querySelector('small.err');
      if (vecchio) vecchio.remove();
      if (r.stato === 'errore') r.nomeNodo.appendChild(el('small', r.messaggioErrore || 'Non salvato: riprova.', 'err'));
    }

    /* ---------- modifica e salvataggio di una riga ---------- */
    function imposta(r, valore, subito) {
      valore = Math.min(1000000, Math.max(0, arrotonda(valore)));
      r.valore = valore;
      r.testoDigitato = null;
      r.messaggioErrore = '';
      r.stato = 'salvataggio';
      if (r.input) r.input.value = formatta(valore);
      aggiornaRiga(r);
      aggiornaAvanzamento();
      clearTimeout(r.timer);
      r.timer = setTimeout(function () { salva(r); }, subito ? 0 : ATTESA_SALVATAGGIO);
    }

    function confermaDigitato(r) {
      var letto = analizza(r.input.value);
      if (letto.vuoto) {
        // Una quantita gia inserita non si puo cancellare: si ripristina.
        r.input.value = formatta(r.valore);
        if (r.stato === 'errore' && r.valore != null) imposta(r, r.valore, true);
        return;
      }
      if (letto.errore) {
        r.stato = 'errore';
        r.messaggioErrore = 'Quantità non valida: usa un numero (es. 3 o 2,5).';
        r.testoDigitato = r.input.value;
        aggiornaRiga(r); aggiornaAvanzamento();
        return;
      }
      if (r.stato === 'ok' && r.contata === letto.valore) return;
      imposta(r, letto.valore, true);
    }

    function salva(r) {
      var valore = r.valore;
      r.coda = r.coda.then(function () {
        return DB.inventarioTabletConta(r.id, valore);
      }).then(function () {
        if (r.valore !== valore) return;   // nel frattempo e cambiato: lo salva il tocco successivo
        r.contata = valore; r.stato = 'ok';
        aggiornaRiga(r); aggiornaAvanzamento();
      }).catch(function (errore) {
        if (r.valore !== valore) return;
        r.stato = 'errore';
        r.messaggioErrore = 'Non salvato (' + messaggio(errore, 'errore di rete') + '). Tocca la riga per riprovare.';
        aggiornaRiga(r); aggiornaAvanzamento();
      });
    }

    function avanzamento() {
      var totale = righe.length;
      var fatte = righe.filter(function (r) { return r.stato === 'ok'; }).length;
      var inCorso = righe.filter(function (r) { return r.stato === 'salvataggio'; }).length;
      var errori = righe.filter(function (r) { return r.stato === 'errore'; }).length;
      return { totale: totale, fatte: fatte, inCorso: inCorso, errori: errori, mancanti: totale - fatte };
    }

    function aggiornaAvanzamento() {
      var a = avanzamento();
      var perc = a.totale ? Math.round(a.fatte / a.totale * 100) : 0;
      txt($('#progTesto'), a.fatte + ' di ' + a.totale + ' contati');
      txt($('#progPerc'), perc + '%');
      $('#progBarra').style.width = perc + '%';
      var pronto = a.totale > 0 && a.mancanti === 0;
      $('#btnControlla').disabled = !pronto;
      var testo;
      if (a.errori) testo = a.errori === 1 ? '1 non salvato: controlla la riga in rosso.' : a.errori + ' non salvati: controlla le righe in rosso.';
      else if (a.inCorso) testo = 'Salvataggio in corso…';
      else if (pronto) testo = 'Tutto contato. Puoi controllare e salvare.';
      else testo = a.mancanti === 1 ? 'Manca 1 prodotto da contare.' : 'Mancano ' + a.mancanti + ' prodotti da contare.';
      txt($('#barraTesto'), testo);
      aggiornaContatori();
    }

    function pendenti() {
      return righe.some(function (r) { return r.stato === 'salvataggio' || r.stato === 'errore'; });
    }

    /* ---------- riepilogo e salvataggio ---------- */
    function controlla() {
      var a = avanzamento();
      if (a.mancanti || a.inCorso || a.errori) return;
      txt($('#riepTesto'), 'Hai contato ' + a.totale + ' prodotti. Salvando, l\'inventario risulterà fatto da ' +
        ctx.stato.profilo.email + '.');
      var zero = righe.filter(function (r) { return r.contata === 0; });
      $('#riepZero').hidden = !zero.length;
      var lista = $('#riepZeroLista');
      lista.textContent = '';
      zero.forEach(function (r) {
        lista.appendChild(el('div', r.nome + ' (' + r.categoria + ')', 'ordine-r'));
      });
      txt($('#errSalva'), '');
      mostraSchermata('contaRiepilogo');
    }

    function salvaInventario() {
      var pulsante = $('#btnSalvaInv');
      pulsante.disabled = true;
      txt($('#errSalva'), '');
      DB.inventarioTabletSalva(inv.id, $('#noteInv').value.trim()).then(function () {
        pulsante.disabled = false;
        $('#noteInv').value = '';
        txt($('#fattoTesto'), 'Grazie! Il titolare può vedere subito chi l\'ha fatto, quando e cosa manca.');
        txt($('#btnFattoOk'), ctx.stato.titolare ? 'Chiudi' : 'Chiudi e cambia operatore');
        inv = null; righe = [];
        mostraSchermata('contaFatto');
      }).catch(function (errore) {
        pulsante.disabled = false;
        txt($('#errSalva'), messaggio(errore, 'Salvataggio non riuscito. Riprova.'));
      });
    }

    function riprovaErrori() {
      righe.forEach(function (r) {
        if (r.stato === 'errore' && r.valore != null && analizza(r.input && r.input.value).valore === r.valore) {
          imposta(r, r.valore, true);
        }
      });
    }

    /* ---------- eventi ---------- */
    $('#btnAvvia').addEventListener('click', avvia);
    $('#btnAggiorna').addEventListener('click', function () {
      var pulsante = $('#btnAggiorna');
      pulsante.disabled = true;
      DB.inventarioTabletStato().then(function (esito) {
        pulsante.disabled = false;
        if (!esito || !esito.inventario) { inv = null; righe = []; return apri(); }
        applicaStato(esito);
        disegna();
      }).catch(function () {
        pulsante.disabled = false;
        ctx.notifica('Aggiornamento non riuscito: controlla la connessione.', 'warning');
      });
    });
    $('#cerca').addEventListener('input', function (evento) {
      filtri.ricerca = normalizza(evento.target.value.trim());
      disegna();
    });
    $('#btnDaContare').addEventListener('click', function () {
      filtri.soloDaContare = !filtri.soloDaContare;
      disegna();
    });
    $('#btnControlla').addEventListener('click', controlla);
    $('#btnRiepIndietro').addEventListener('click', function () { mostraSchermata('contaElenco'); });
    $('#btnSalvaInv').addEventListener('click', salvaInventario);
    $('#btnFattoOk').addEventListener('click', function () {
      if (ctx.stato.titolare) apri();
      else ctx.esci('Inventario salvato. Grazie! Il prossimo collega può accedere con il proprio account.');
    });
    window.addEventListener('beforeunload', function (evento) {
      if (!pendenti()) return;
      evento.preventDefault();
      evento.returnValue = '';
    });

    return { apri: apri, riprovaErrori: riprovaErrori, inSospeso: pendenti };
  };
})();
