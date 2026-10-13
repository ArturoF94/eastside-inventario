(function () {
  'use strict';

  window.InventarioModuli = window.InventarioModuli || {};

  /* Storico degli inventari salvati, riservato al titolare: chi, quando e
     i prodotti mancanti raggruppati per fornitore. */
  window.InventarioModuli.titolare = function (ctx) {
    var $ = ctx.$;
    var el = ctx.el;
    var txt = ctx.txt;
    var PAGINA = 20;

    var storico = [];
    var cursore = null;

    function numero(valore) {
      return Number(valore).toLocaleString('it-IT', { maximumFractionDigits: 3 });
    }

    function badge(testo, classe) { return el('span', testo, 'badge ' + classe); }

    function apriStorico() {
      $('#storicoDettaglio').hidden = true;
      $('#storicoElenco').hidden = false;
      storico = []; cursore = null;
      $('#storicoLista').textContent = '';
      return caricaStorico();
    }

    function caricaStorico() {
      txt($('#errStorico'), '');
      var pulsante = $('#btnAltri');
      pulsante.disabled = true;
      return DB.inventariStorico({ limite: PAGINA, primaDi: cursore }).then(function (pagina) {
        pulsante.disabled = false;
        pagina = pagina || [];
        var noti = {};
        storico.forEach(function (i) { noti[i.id] = true; });
        pagina.forEach(function (i) { if (!noti[i.id]) storico.push(i); });
        if (pagina.length) cursore = pagina[pagina.length - 1].completato_il;
        pulsante.hidden = pagina.length < PAGINA;
        disegnaStorico();
      }).catch(function (errore) {
        pulsante.disabled = false;
        txt($('#errStorico'), ctx.messaggio(errore, 'Impossibile caricare gli inventari. Riprova.'));
      });
    }

    function disegnaStorico() {
      var lista = $('#storicoLista');
      lista.textContent = '';
      if (!storico.length) {
        lista.appendChild(el('li', 'Nessun inventario ancora salvato.', 'vuoto'));
        return;
      }
      storico.forEach(function (i) {
        var li = el('li');
        var b = el('button');
        b.type = 'button';
        b.appendChild(el('span', ctx.dataOra(i.completato_il), 'quando'));
        b.appendChild(el('span', 'di ' + i.operatore_nome, 'chi'));
        var conta = el('span', null, 'conta');
        if (i.esauriti > 0) conta.appendChild(badge(i.esauriti + ' esauriti', 'rosso'));
        if (i.sotto_soglia > 0) conta.appendChild(badge(i.sotto_soglia + ' sotto soglia', 'giallo'));
        if (!i.esauriti && !i.sotto_soglia) conta.appendChild(badge('Nulla da riordinare', 'verde'));
        b.appendChild(conta);
        b.addEventListener('click', function () { apriDettaglio(i.id); });
        li.appendChild(b);
        lista.appendChild(li);
      });
    }

    function apriDettaglio(id) {
      var area = $('#storicoDettaglio');
      area.textContent = '';
      area.appendChild(el('p', 'Caricamento…', 'sub-i'));
      $('#storicoElenco').hidden = true;
      area.hidden = false;
      window.scrollTo(0, 0);
      DB.inventarioDettaglio(id).then(function (d) {
        disegnaDettaglio(area, d);
      }).catch(function (errore) {
        area.textContent = '';
        area.appendChild(el('p', ctx.messaggio(errore, 'Impossibile caricare il dettaglio.'), 'msg-err'));
        area.appendChild(tornaElenco());
      });
    }

    function tornaElenco() {
      var b = el('button', '‹ Inventari fatti', 'btn-s');
      b.type = 'button';
      b.addEventListener('click', function () {
        $('#storicoDettaglio').hidden = true;
        $('#storicoElenco').hidden = false;
        window.scrollTo(0, 0);
      });
      return b;
    }

    function riga(etichetta, valore) {
      var r = el('div', null, 'ordine-r');
      r.appendChild(el('span', etichetta));
      r.appendChild(el('span', valore, 'dx'));
      return r;
    }

    function disegnaDettaglio(area, d) {
      area.textContent = '';
      var inv = d.inventario;
      var righe = d.righe || [];
      area.appendChild(tornaElenco());

      var testa = el('div', null, 'card-i');
      testa.style.marginTop = '12px';
      testa.appendChild(el('h2', 'Inventario del ' + ctx.dataOra(inv.completato_il)));
      testa.appendChild(riga('Fatto da', inv.completato_da_nome || inv.operatore_nome));
      if (inv.contributori && inv.contributori.length > 1) {
        testa.appendChild(riga('Hanno contato', inv.contributori.join(', ')));
      }
      testa.appendChild(riga('Iniziato', ctx.dataOra(inv.iniziato_il)));
      testa.appendChild(riga('Salvato', ctx.dataOra(inv.completato_il)));
      testa.appendChild(riga('Prodotti contati', String(righe.length)));
      if (inv.note) testa.appendChild(riga('Note', inv.note));
      area.appendChild(testa);

      var mancanti = righe.filter(function (r) { return r.stato === 'esaurito' || r.stato === 'sotto_soglia'; });
      var card = el('div', null, 'card-i');
      card.appendChild(el('h2', 'Prodotti mancanti' + (mancanti.length ? ' (' + mancanti.length + ')' : '')));
      if (!mancanti.length) {
        card.appendChild(el('p', 'Nessun prodotto esaurito o sotto la soglia minima.', 'sub-i'));
      } else {
        var perFornitore = {};
        mancanti.forEach(function (r) {
          var chiave = r.fornitore_nome || 'Senza fornitore';
          (perFornitore[chiave] = perFornitore[chiave] || []).push(r);
        });
        Object.keys(perFornitore).sort(function (a, b) {
          if (a === 'Senza fornitore') return 1;
          if (b === 'Senza fornitore') return -1;
          return a.localeCompare(b, 'it');
        }).forEach(function (nome) {
          var gruppo = el('div', null, 'ordine-f');
          var titolo = el('h3', nome);
          var tel = perFornitore[nome][0].fornitore_telefono;
          if (tel) titolo.appendChild(el('span', '  ' + tel, 'tel'));
          gruppo.appendChild(titolo);
          perFornitore[nome].forEach(function (r) {
            var rr = el('div', null, 'ordine-r');
            var sx = el('span');
            sx.appendChild(document.createTextNode(r.nome + ' '));
            sx.appendChild(r.stato === 'esaurito' ? badge('Esaurito', 'rosso') : badge('Sotto soglia', 'giallo'));
            rr.appendChild(sx);
            var testo = 'Contati ' + numero(r.contata) + ' ' + r.unita;
            if (r.quantita_proposta > 0) testo += ' · proponi ' + numero(r.quantita_proposta) + ' ' + r.unita;
            else if (r.stato === 'esaurito') testo += ' · soglia non impostata';
            rr.appendChild(el('span', testo, 'dx'));
            gruppo.appendChild(rr);
          });
          card.appendChild(gruppo);
        });
      }
      area.appendChild(card);

      var tutti = el('div', null, 'card-i');
      tutti.appendChild(el('h2', 'Tutti i prodotti contati'));
      var tabella = document.createElement('table');
      tabella.className = 'tabella-r';
      var thead = document.createElement('thead');
      var intest = document.createElement('tr');
      ['Prodotto', 'Categoria', 'Contati', 'Soglia'].forEach(function (t, i) {
        var th = el('th', t, i > 1 ? 'num' : '');
        th.scope = 'col';
        intest.appendChild(th);
      });
      thead.appendChild(intest);
      tabella.appendChild(thead);
      var corpo = document.createElement('tbody');
      righe.forEach(function (r) {
        var tr = document.createElement('tr');
        tr.appendChild(el('td', r.nome));
        tr.appendChild(el('td', r.reparto));
        tr.appendChild(el('td', numero(r.contata) + ' ' + r.unita, 'num'));
        tr.appendChild(el('td', r.scorta_minima > 0 ? numero(r.scorta_minima) : '—', 'num'));
        corpo.appendChild(tr);
      });
      tabella.appendChild(corpo);
      tutti.appendChild(tabella);
      area.appendChild(tutti);
    }

    $('#btnAltri').addEventListener('click', caricaStorico);

    return { apriStorico: apriStorico };
  };
})();
