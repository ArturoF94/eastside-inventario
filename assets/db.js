/* FILE GENERATO: non modificare manualmente.
 * Profilo: staff.
 * Moduli: core, menu, orders-staff, auth, staff-menu, staff-users, crm, inventory, cash, errori, errori-admin.
 * Fonte: shared/db; comando: npm run db:generate.
 */

(function (root) {
  'use strict';

  var CONFIG = {
    url: 'https://osxwermyqclgdcueksik.supabase.co',
    key: 'sb_publishable_99A1jriqSIStm2HqDPefSQ_kEveqV1u'
  };
  var LIBRARY_ID = 'eastside-supabase-js';
  var LIBRARY_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/dist/umd/supabase.js';
  var DB = root.DB || {};

  DB.configurato = !!(CONFIG.url && CONFIG.key);
  DB.pronto = false;
  DB._client = null;
  DB._menu = null;
  DB._modules = [];
  DB._initPromise = null;
  DB._libraryPromise = null;

  DB._registerModule = function (name) {
    if (DB._modules.indexOf(name) === -1) DB._modules.push(name);
  };

  DB._pick = function (response, fallbackMessage) {
    if (!response || response.error) {
      var error = response && response.error;
      return {
        ok: false,
        errore: (error && error.message) || fallbackMessage || 'Operazione non riuscita.'
      };
    }
    return response.data;
  };

  DB._rows = function (response) {
    if (response && response.error) throw response.error;
    return (response && response.data) || [];
  };

  DB._pagina = function (opzioni, predefinito, massimo) {
    opzioni = opzioni || {};
    var limite = Number(opzioni.limite);
    if (!Number.isFinite(limite) || limite < 1) limite = predefinito;
    return {
      limite: Math.min(Math.floor(limite), massimo),
      primaDi: opzioni.primaDi || null
    };
  };

  DB._applicaPaginaTemporale = function (richiesta, pagina, colonna) {
    var cursore = pagina.primaDi;
    if (cursore && typeof cursore === 'object' && cursore.valore && cursore.id) {
      richiesta = richiesta.or(
        colonna + '.lt.' + cursore.valore +
        ',and(' + colonna + '.eq.' + cursore.valore + ',id.lt.' + cursore.id + ')'
      );
    } else if (cursore) {
      richiesta = richiesta.lt(colonna, cursore);
    }
    return richiesta.limit(pagina.limite);
  };

  function caricaLib() {
    if (root.supabase && root.supabase.createClient) return Promise.resolve();
    if (DB._libraryPromise) return DB._libraryPromise;

    DB._libraryPromise = new Promise(function (resolve, reject) {
      var script = document.getElementById(LIBRARY_ID);
      var nuovo = !script;
      var timer;

      function pulisci() {
        clearTimeout(timer);
        script.removeEventListener('load', caricato);
        script.removeEventListener('error', fallito);
      }
      function caricato() {
        pulisci();
        if (root.supabase && root.supabase.createClient) resolve();
        else reject(new Error('Libreria Supabase non valida'));
      }
      function fallito() {
        pulisci();
        if (nuovo && script.parentNode) script.parentNode.removeChild(script);
        reject(new Error('CDN Supabase non raggiungibile'));
      }

      if (!script) {
        script = document.createElement('script');
        script.id = LIBRARY_ID;
        script.src = LIBRARY_URL;
      }
      script.addEventListener('load', caricato, { once: true });
      script.addEventListener('error', fallito, { once: true });
      timer = setTimeout(function () {
        fallito();
      }, 8000);
      if (nuovo) document.head.appendChild(script);
    }).catch(function (error) {
      DB._libraryPromise = null;
      throw error;
    });

    return DB._libraryPromise;
  }

  DB.init = function () {
    if (!DB.configurato) return Promise.resolve(false);
    if (DB.pronto) return Promise.resolve(true);
    if (DB._initPromise) return DB._initPromise;

    DB._initPromise = caricaLib().then(function () {
      DB._client = root.supabase.createClient(CONFIG.url, CONFIG.key, {
        realtime: { params: { eventsPerSecond: 5 } }
      });
      DB.pronto = true;
      return true;
    }).catch(function (error) {
      DB._client = null;
      DB.pronto = false;
      DB._initPromise = null;
      console.warn('Supabase non disponibile.', error);
      return false;
    });

    return DB._initPromise;
  };

  function origineCorrente() {
    var percorso = (root.location && root.location.pathname) || '';
    return percorso.indexOf('/gestionale/') !== -1 ? 'gestionale' : 'sito';
  }

  function segnalaErrore(messaggio, dettagli) {
    if (typeof DB.registraErrore !== 'function') return;
    DB.registraErrore(origineCorrente(), 'errore', messaggio, dettagli || {});
  }

  if (root.addEventListener) {
    root.addEventListener('error', function (evento) {
      segnalaErrore(evento.message || 'Errore JavaScript', {
        file: evento.filename || '',
        riga: evento.lineno || 0,
        pagina: (root.location && root.location.pathname) || '',
        stack: (evento.error && evento.error.stack) ? String(evento.error.stack).slice(0, 500) : ''
      });
    });
    root.addEventListener('unhandledrejection', function (evento) {
      var motivo = evento.reason;
      var messaggio = (motivo && motivo.message) ? motivo.message : String(motivo);
      segnalaErrore(messaggio, {
        tipo: 'promise',
        pagina: (root.location && root.location.pathname) || '',
        stack: (motivo && motivo.stack) ? String(motivo.stack).slice(0, 500) : ''
      });
    });
  }

  DB._registerModule('core');
  root.DB = DB;
})(window);

(function (root) {
  'use strict';

  var DB = root.DB;
  if (!DB) throw new Error('Il modulo core DB deve essere caricato per primo.');

  function prezzoVarianti(varianti) {
    return varianti.map(function (variante) {
      return '€ ' + Number(variante.price).toFixed(2).replace('.', ',');
    }).join(' / ');
  }

  DB.caricaMenu = function () {
    return Promise.all([
      DB._client.from('menu_categorie').select('id,gruppo,etichetta,servizio,ordine,traduzioni').eq('attiva', true).order('ordine'),
      DB._client.from('menu_prodotti').select('id,categoria_id,nome,descrizione,allergeni,prezzo,varianti,alcolico,immagine,ordine,traduzioni').eq('disponibile', true).order('ordine'),
      DB._client.from('servizi_orari').select('id,etichetta,finestre'),
      DB._client.from('chiusure').select('data,motivo'),
      DB._client.from('aperture').select('data,servizio,dalle,alle'),
      DB._client.from('impostazioni').select('coperto_attivo,coperto_valore,coperto_escluso_pranzo').eq('id', 1).maybeSingle()
    ]).then(function (risposte) {
      risposte.forEach(function (risposta) {
        if (risposta && risposta.error) throw risposta.error;
      });

      var categorie = risposte[0].data || [];
      var prodotti = risposte[1].data || [];
      var servizi = risposte[2].data || [];
      var chiusure = risposte[3].data || [];
      var aperture = risposte[4].data || [];
      var impostazioni = (risposte[5] && risposte[5].data) || {
        coperto_attivo: false,
        coperto_valore: 3,
        coperto_escluso_pranzo: true
      };

      if (root.EASTSIDE_CONFIG) {
        root.EASTSIDE_CONFIG.copertoEuro = impostazioni.coperto_attivo
          ? Number(impostazioni.coperto_valore)
          : 0;
        root.EASTSIDE_CONFIG.copertoEsclusoAPranzo = !!impostazioni.coperto_escluso_pranzo;
      }

      var perCategoria = {};
      prodotti.forEach(function (prodotto) {
        var varianti = Array.isArray(prodotto.varianti) && prodotto.varianti.length
          ? prodotto.varianti
          : null;
        (perCategoria[prodotto.categoria_id] = perCategoria[prodotto.categoria_id] || []).push({
          id: prodotto.id,
          name: prodotto.nome,
          desc: prodotto.descrizione || '',
          allerg: prodotto.allergeni || '',
          price: Number(prodotto.prezzo),
          variants: varianti || undefined,
          alcohol: !!prodotto.alcolico,
          immagine: prodotto.immagine || null,
          traduzioni: prodotto.traduzioni || null,
          priceLabel: varianti
            ? prezzoVarianti(varianti)
            : '€ ' + Number(prodotto.prezzo).toFixed(2).replace('.', ',')
        });
      });

      DB._menu = {
        restaurant: 'Eastside Pub & Steakhouse',
        currency: 'EUR',
        services: servizi.map(function (servizio) {
          return { id: servizio.id, label: servizio.etichetta, windows: servizio.finestre };
        }),
        closures: chiusure.map(function (chiusura) {
          return { date: chiusura.data, motivo: chiusura.motivo };
        }),
        openings: aperture.map(function (apertura) {
          return {
            date: apertura.data,
            service: apertura.servizio,
            from: apertura.dalle.slice(0, 5),
            to: apertura.alle.slice(0, 5)
          };
        }),
        cover: {
          name: 'Pane e coperto',
          price: impostazioni.coperto_attivo ? Number(impostazioni.coperto_valore) : 0,
          attivo: !!impostazioni.coperto_attivo,
          skipService: impostazioni.coperto_escluso_pranzo ? 'pranzo' : null
        },
        categories: categorie.map(function (categoria) {
          return {
            id: categoria.id,
            group: categoria.gruppo,
            label: categoria.etichetta,
            traduzioni: categoria.traduzioni || null,
            service: categoria.servizio,
            items: perCategoria[categoria.id] || []
          };
        }).filter(function (categoria) {
          return categoria.items.length;
        })
      };
      return DB._menu;
    });
  };

  DB.ascoltaMenu = function (aggiorna) {
    if (!DB._client || typeof aggiorna !== 'function') return null;
    if (DB._menuChannel) DB._client.removeChannel(DB._menuChannel);

    var timer = null;
    var ultimoId = null;
    function ricarica(payload) {
      ultimoId = (payload && payload.new && payload.new.id) ||
        (payload && payload.old && payload.old.id) || ultimoId;
      clearTimeout(timer);
      timer = setTimeout(function () {
        DB.caricaMenu().then(function (menu) {
          var versione = Date.now();
          (menu.categories || []).forEach(function (categoria) {
            (categoria.items || []).forEach(function (item) {
              if (item.id !== ultimoId || !item.immagine) return;
              item.immagine += (item.immagine.indexOf('?') === -1 ? '?' : '&') + 'v=' + versione;
            });
          });
          aggiorna(menu);
        }).catch(function (error) {
          console.warn('Aggiornamento del menu non riuscito.', error);
        });
      }, 120);
    }

    DB._menuChannel = DB._client.channel('menu-prodotti-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_prodotti' }, ricarica)
      .subscribe();
    return DB._menuChannel;
  };

  DB._registerModule('menu');
})(window);

(function (root) {
  'use strict';

  var DB = root.DB;
  if (!DB) throw new Error('Il modulo core DB deve essere caricato per primo.');

  DB.listaOrdini = function (opzioni) {
    var da = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
    var pagina = DB._pagina(opzioni, 500, 1000);
    var richiesta = DB._client.from('ordini')
      .select('id,numero,tavolo,persone,righe,imponibile,coperto_unit,coperto,totale,nota,pagamento,paid,alcol,stato,creato_il,aggiornato_il,checkout_id,cliente_id,origine,sessione_id,sconto,stato_pagamento,modo_conto')
      .gte('creato_il', da)
      .order('creato_il', { ascending: false })
      .order('id', { ascending: false });
    return DB._applicaPaginaTemporale(richiesta, pagina, 'creato_il').then(DB._rows);
  };

  DB.aggiornaOrdine = function (id, patch) {
    var aggiornamento = Object.assign({}, patch, { aggiornato_il: new Date().toISOString() });
    return DB._client.from('ordini').update(aggiornamento).eq('id', id);
  };

  DB.listaTavoliAdmin = function () {
    return DB._client.from('tavoli').select('id,attivo').order('id')
      .then(DB._rows);
  };

  DB.listaTavoliOperativi = function () {
    return DB._client.rpc('lista_tavoli_attivi').then(DB._rows);
  };

  DB.salvaTavolo = function (id, attivo) {
    return DB._client.from('tavoli')
      .upsert({ id: Number(id), attivo: attivo !== false }, { onConflict: 'id' })
      .then(function (risposta) {
        return {
          ok: !risposta.error,
          errore: risposta.error && risposta.error.message
        };
      });
  };

  DB.rigeneraTokenTavolo = function (id) {
    return DB._client.rpc('rigenera_token_tavolo', {
      p_tavolo: Number(id)
    }).then(DB._pick);
  };

  DB._registerModule('orders-staff');
})(window);

(function (root) {
  'use strict';

  var DB = root.DB;
  if (!DB) throw new Error('Il modulo core DB deve essere caricato per primo.');

  DB.login = function (email, password) {
    return DB._client.auth.signInWithPassword({ email: email, password: password });
  };

  DB.logout = function () {
    return DB._client.auth.signOut();
  };

  DB.sessione = function () {
    return DB._client.auth.getUser().then(function (risposta) {
      return risposta.data ? risposta.data.user : null;
    }).catch(function () {
      return null;
    });
  };

  DB.mioRuolo = function () {
    return DB._client.rpc('mio_ruolo').then(function (risposta) {
      return risposta.error ? null : risposta.data;
    }).catch(function () {
      return null;
    });
  };

  DB._registerModule('auth');
})(window);

(function (root) {
  'use strict';

  var DB = root.DB;
  if (!DB) throw new Error('Il modulo core DB deve essere caricato per primo.');

  DB.salvaMenu = function (dati) {
    var categorie = dati.categories.map(function (categoria, indice) {
      return {
        id: categoria.id,
        gruppo: categoria.group,
        etichetta: categoria.label,
        servizio: categoria.service || 'sempre',
        ordine: indice,
        attiva: true
      };
    });
    var prodotti = [];
    dati.categories.forEach(function (categoria) {
      (categoria.items || []).forEach(function (prodotto, indice) {
        prodotti.push({
          id: prodotto.id,
          categoria_id: categoria.id,
          nome: prodotto.name,
          descrizione: prodotto.desc || '',
          allergeni: prodotto.allerg || '',
          prezzo: prodotto.price,
          varianti: prodotto.variants || null,
          alcolico: !!prodotto.alcohol,
          immagine: prodotto.immagine || null,
          disponibile: prodotto.disponibile !== false,
          ordine: indice
        });
      });
    });
    var categorieDaTenere = categorie.map(function (categoria) { return categoria.id; });
    var prodottiDaTenere = prodotti.map(function (prodotto) { return prodotto.id; });

    return DB._client.from('menu_categorie').upsert(categorie).then(function (risposta) {
      if (risposta.error) throw risposta.error;
      return DB._client.from('menu_prodotti').upsert(prodotti);
    }).then(function (risposta) {
      if (risposta.error) throw risposta.error;
      return DB._client.from('menu_prodotti').select('id');
    }).then(function (risposta) {
      var daEliminare = DB._rows(risposta).map(function (prodotto) {
        return prodotto.id;
      }).filter(function (id) {
        return prodottiDaTenere.indexOf(id) === -1;
      });
      if (daEliminare.length) {
        return DB._client.from('menu_prodotti').delete().in('id', daEliminare);
      }
    }).then(function (risposta) {
      if (risposta && risposta.error) throw risposta.error;
      return DB._client.from('menu_categorie').select('id');
    }).then(function (risposta) {
      var daEliminare = DB._rows(risposta).map(function (categoria) {
        return categoria.id;
      }).filter(function (id) {
        return categorieDaTenere.indexOf(id) === -1;
      });
      if (daEliminare.length) {
        return DB._client.from('menu_categorie').delete().in('id', daEliminare);
      }
    });
  };

  DB.caricaImmagineProdotto = function (prodottoId, file) {
    if (!file) return Promise.reject(new Error('Seleziona un file immagine.'));
    var estensioni = {
      'image/webp': 'webp',
      'image/png': 'png',
      'image/jpeg': 'jpg'
    };
    var estensione = estensioni[file.type];
    if (!estensione) {
      return Promise.reject(new Error('Formato non supportato. Usa WebP, PNG o JPEG.'));
    }
    if (file.size > 5 * 1024 * 1024) {
      return Promise.reject(new Error('La foto supera il limite di 5 MB.'));
    }

    var idSicuro = String(prodottoId || 'prodotto').toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
    var percorso = 'prodotti/' + idSicuro + '/' + Date.now() + '-' +
      Math.random().toString(36).slice(2, 8) + '.' + estensione;

    return DB._client.storage.from('menu-products')
      .upload(percorso, file, {
        cacheControl: '31536000',
        upsert: false,
        contentType: file.type
      }).then(function (risposta) {
        if (risposta.error) throw risposta.error;
        var pubblico = DB._client.storage.from('menu-products').getPublicUrl(percorso);
        var url = pubblico && pubblico.data && pubblico.data.publicUrl;
        if (!url) throw new Error('URL pubblico della foto non disponibile.');
        return url;
      });
  };

  DB.salvaOrari = function (dati) {
    var servizi = (dati.services || []).map(function (servizio) {
      return { id: servizio.id, etichetta: servizio.label, finestre: servizio.windows };
    });
    return DB._client.from('servizi_orari').upsert(servizi).then(function (risposta) {
      if (risposta.error) throw risposta.error;
      return DB._client.from('chiusure').delete().not('id', 'is', null);
    }).then(function (risposta) {
      if (risposta.error) throw risposta.error;
      var chiusure = (dati.closures || []).map(function (chiusura) {
        return { data: chiusura.date, motivo: chiusura.motivo || '' };
      });
      if (chiusure.length) return DB._client.from('chiusure').insert(chiusure);
    }).then(function (risposta) {
      if (risposta && risposta.error) throw risposta.error;
      return DB._client.from('aperture').delete().not('id', 'is', null);
    }).then(function (risposta) {
      if (risposta.error) throw risposta.error;
      var aperture = (dati.openings || []).map(function (apertura) {
        return {
          data: apertura.date,
          servizio: apertura.service || 'sempre',
          dalle: apertura.from,
          alle: apertura.to
        };
      });
      if (aperture.length) return DB._client.from('aperture').insert(aperture);
    });
  };

  DB._registerModule('staff-menu');
})(window);

(function (root) {
  'use strict';

  var DB = root.DB;
  if (!DB) throw new Error('Il modulo core DB deve essere caricato per primo.');

  DB.staff = function () {
    return DB._client.from('profili').select('id,email,ruolo,attivo,permessi,creato_il')
      .order('creato_il').limit(200)
      .then(DB._rows);
  };

  DB.aggiornaProfilo = function (id, patch) {
    return DB._client.from('profili').update(patch).eq('id', id);
  };

  DB.mioProfilo = function () {
    return DB._client.auth.getUser().then(function (risposta) {
      var utenteId = risposta && risposta.data && risposta.data.user
        ? risposta.data.user.id
        : null;
      if (!utenteId) return null;
      return DB._client.from('profili')
        .select('id,email,ruolo,attivo,permessi,creato_il')
        .eq('id', utenteId).maybeSingle()
        .then(function (profilo) {
          return profilo.data || null;
        });
    }).catch(function () {
      return null;
    });
  };

  DB.aggiornaPermessi = function (id, permessi) {
    return DB._client.from('profili').update({ permessi: permessi }).eq('id', id)
      .then(function (risposta) {
        return {
          ok: !risposta.error,
          errore: risposta.error && risposta.error.message
        };
      });
  };

  DB.creaUtente = function (dati) {
    return DB._client.functions.invoke('gestisci-utenti', {
      body: Object.assign({ azione: 'crea' }, dati)
    }).then(function (risposta) {
      if (risposta.error) {
        return {
          ok: false,
          errore: risposta.error.message || 'Errore di rete'
        };
      }
      var esito = risposta.data || { ok: true };
      if (esito.error && !esito.errore) esito.errore = esito.error;
      return esito;
    });
  };

  DB.eliminaUtente = function (id) {
    return DB._client.functions.invoke('gestisci-utenti', {
      body: { azione: 'elimina', id: id }
    }).then(function (risposta) {
      if (risposta.error) {
        return {
          ok: false,
          errore: risposta.error.message || 'Errore di rete'
        };
      }
      var esito = risposta.data || { ok: true };
      if (esito.error && !esito.errore) esito.errore = esito.error;
      return esito;
    });
  };

  DB._registerModule('staff-users');
})(window);

(function (root) {
  'use strict';

  var DB = root.DB;
  if (!DB) throw new Error('Il modulo core DB deve essere caricato per primo.');

  DB.leggiClienti = function (opzioni) {
    var pagina = DB._pagina(opzioni, 100, 500);
    var richiesta = DB._client.from('v_clienti_stats')
      .select('id,nome,cognome,email,telefono,canale,note,creato_il,ordini,speso,ultimo_ordine,prenotazioni,consenso_marketing,consenso_data,consenso_origine,saldo_punti')
      .order('speso', { ascending: false, nullsFirst: false })
      .order('id', { ascending: true });
    var cursore = pagina.primaDi;
    if (cursore && typeof cursore === 'object' && cursore.id) {
      var speso = Number(cursore.speso) || 0;
      richiesta = richiesta.or(
        'speso.lt.' + speso + ',and(speso.eq.' + speso + ',id.gt.' + cursore.id + ')'
      );
    }
    return richiesta.limit(pagina.limite).then(DB._rows);
  };

  DB.leggiPrenotazioni = function (opzioni) {
    var pagina = DB._pagina(opzioni, 100, 500);
    var richiesta = DB._client.from('prenotazioni')
      .select('id,cliente_id,nome,telefono,email,persone,quando,canale,stato,note,creato_il,aggiornato_il,confermata_il,completata_il,annullata_il')
      .order('quando', { ascending: false })
      .order('id', { ascending: false });
    return DB._applicaPaginaTemporale(richiesta, pagina, 'quando').then(DB._rows);
  };

  DB.leggiEventi = function () {
    return DB._client.from('eventi')
      .select('id,nome,data,posti_tot,prenotati,stato,ricorrente,note')
      .order('data', { ascending: true, nullsFirst: false }).limit(200)
      .then(DB._rows);
  };

  DB.leggiFornitori = function () {
    return DB._client.from('fornitori')
      .select('id,nome,categoria,referente,telefono,consegne,ultimo_ordine,stato,note')
      .order('nome').limit(500)
      .then(DB._rows);
  };

  DB.salvaRecord = function (tabella, record) {
    var dati = {};
    for (var chiave in record) {
      if (Object.prototype.hasOwnProperty.call(record, chiave) && record[chiave] !== undefined) {
        dati[chiave] = record[chiave];
      }
    }
    if (dati.id) {
      var id = dati.id;
      delete dati.id;
      return DB._client.from(tabella).update(dati).eq('id', id);
    }
    return DB._client.from(tabella).insert(dati);
  };

  DB.eliminaRecord = function (tabella, id) {
    return DB._client.from(tabella).delete().eq('id', id);
  };

  DB.trovaOCreaCliente = function (dati) {
    return DB._client.rpc('trova_o_crea_cliente', {
      p_nome: dati.nome || '',
      p_cognome: dati.cognome || '',
      p_email: dati.email || '',
      p_telefono: dati.telefono || '',
      p_canale: dati.canale || null
    }).then(function (risposta) {
      return risposta.error ? null : risposta.data;
    });
  };

  DB.movimentiFedelta = function (clienteId, limite) {
    return DB._client.from('movimenti_fedelta')
      .select('id,cliente_id,ordine_id,tipo,punti_delta,saldo_dopo,causale,creato_il')
      .eq('cliente_id', clienteId).order('creato_il', { ascending: false })
      .limit(limite || 50).then(DB._rows);
  };

  DB.registraPunti = function (clienteId, punti, causale) {
    return DB._client.rpc('fedelta_movimento', {
      p_cliente: clienteId, p_punti: punti, p_causale: causale || ''
    }).then(function (risposta) {
      if (risposta.error) return { ok: false, errore: risposta.error.message };
      return risposta.data || { ok: false, errore: 'Risposta non valida.' };
    });
  };

  DB.disponibilitaPrenotazione = function (quando, escludi) {
    return DB._client.rpc('prenotazione_disponibilita', {
      p_quando: quando, p_escludi: escludi || null
    }).then(function (risposta) {
      if (risposta.error) return { ok: false, errore: risposta.error.message };
      return risposta.data || { ok: false };
    });
  };

  DB.salvaPrenotazione = function (dati) {
    return DB._client.rpc('prenotazione_salva', {
      p_id: dati.id || null, p_cliente: dati.cliente_id || null,
      p_nome: dati.nome || '', p_telefono: dati.telefono || '', p_email: dati.email || '',
      p_persone: dati.persone, p_quando: dati.quando,
      p_canale: dati.canale || 'Telefono', p_stato: dati.stato || 'in attesa',
      p_note: dati.note || ''
    }).then(function (risposta) {
      if (risposta.error) return { ok: false, errore: risposta.error.message };
      return risposta.data || { ok: false, errore: 'Risposta non valida.' };
    });
  };

  DB.prenotazioniConfig = function () {
    return DB._client.from('prenotazioni_config')
      .select('id,capienza_fascia,durata_fascia_min,aggiornato_il').eq('id', 1).maybeSingle()
      .then(function (risposta) {
        if (risposta.error) throw risposta.error;
        return risposta.data || null;
      });
  };

  DB.salvaPrenotazioniConfig = function (capienza, durataMin) {
    return DB._client.rpc('prenotazioni_config_set', {
      p_capienza: Number(capienza), p_durata_min: Number(durataMin)
    }).then(function (risposta) {
      if (risposta.error) return { ok: false, errore: risposta.error.message };
      return risposta.data || { ok: false, errore: 'Risposta non valida.' };
    });
  };

  DB.creaOrdineStaff = function (dati) {
    return DB._client.rpc('crea_ordine_staff', {
      p_righe: dati.righe,
      p_tavolo: dati.tavolo || 0,
      p_cliente: dati.cliente || null,
      p_pagamento: 'cassa',
      p_paid: false,
      p_persone: dati.persone || 0,
      p_nota: dati.nota || ''
    }).then(function (risposta) {
      return risposta.error
        ? { ok: false, errore: 'Salvataggio non riuscito.' }
        : risposta.data;
    });
  };

  DB.traduci = function () {
    return DB._client.rpc('traduci_menu').then(function (risposta) {
      if (risposta.error) return { ok: false, errore: 'Traduzione non riuscita.' };
      return risposta.data || { ok: true };
    });
  };

  DB.leggiImpostazioni = function () {
    return DB._client.from('impostazioni')
      .select('id,coperto_attivo,coperto_valore,coperto_escluso_pranzo')
      .eq('id', 1).maybeSingle()
      .then(function (risposta) {
        if (risposta.error) throw risposta.error;
        return risposta.data || null;
      });
  };

  DB.salvaImpostazioni = function (patch) {
    return DB._client.from('impostazioni').update(patch).eq('id', 1);
  };

  DB.leggiWifi = function () {
    return DB._client.from('wifi_config')
      .select('id,ssid,password,auth,hidden,aggiornato_il')
      .eq('id', 1).maybeSingle()
      .then(function (risposta) {
        if (risposta.error) throw risposta.error;
        return risposta.data || null;
      });
  };

  DB.salvaWifi = function (patch) {
    return DB._client.from('wifi_config').update(patch).eq('id', 1)
      .then(function (risposta) {
        return {
          ok: !risposta.error,
          errore: risposta.error && risposta.error.message
        };
      });
  };

  DB.leggiPromozioni = function () {
    return DB._client.from('promozioni')
      .select('id,nome,tipo,sconto_perc,dal,al,target,descrizione,stato,creato_il')
      .order('creato_il', { ascending: false }).limit(200)
      .then(DB._rows);
  };

  DB.salvaPromozione = function (record) {
    if (record.id) {
      return DB._client.from('promozioni').update(record).eq('id', record.id);
    }
    return DB._client.from('promozioni').insert(record);
  };

  DB.eliminaPromozione = function (id) {
    return DB._client.from('promozioni').delete().eq('id', id);
  };

  DB._registerModule('crm');
})(window);

(function (root) {
  'use strict';

  var DB = root.DB;
  if (!DB) throw new Error('Il modulo core DB deve essere caricato per primo.');

  function esitoScrittura(risposta) {
    return {
      ok: !risposta.error,
      errore: risposta.error && risposta.error.message
    };
  }

  DB.leggiIngredienti = function () {
    return DB._client.from('ingredienti')
      .select('id,nome,unita,costo_unitario,fornitore_id,note,giacenza,scorta_minima,creato_il,aggiornato_il')
      .order('nome').limit(1000)
      .then(DB._rows);
  };

  DB.salvaIngrediente = function (record) {
    var richiesta = record.id
      ? DB._client.from('ingredienti').update(record).eq('id', record.id)
      : DB._client.from('ingredienti').insert(record);
    return richiesta.then(esitoScrittura);
  };

  DB.eliminaIngrediente = function (id) {
    return DB._client.from('ingredienti').delete().eq('id', id)
      .then(esitoScrittura);
  };

  DB.movimentiMagazzino = function (limite) {
    return DB._client.from('movimenti_magazzino')
      .select('id,ingrediente_id,ordine_id,tipo,quantita_delta,giacenza_dopo,costo_unitario,causale,operatore,creato_il,ingredienti(nome,unita)')
      .order('creato_il', { ascending: false }).limit(Math.min(Number(limite) || 50, 250))
      .then(DB._rows);
  };

  DB.scarichiMagazzino = function (limite) {
    return DB._client.from('scarichi_magazzino_ordini')
      .select('ordine_id,stato,dettaglio,elaborato_il,ordini(numero)')
      .order('elaborato_il', { ascending: false }).limit(Math.min(Number(limite) || 30, 100))
      .then(DB._rows);
  };

  DB.registraMovimentoMagazzino = function (dati) {
    return DB._client.rpc('magazzino_movimento', {
      p_ingrediente: dati.ingrediente,
      p_tipo: dati.tipo,
      p_quantita: Number(dati.quantita),
      p_costo_unitario: dati.costo == null || dati.costo === '' ? null : Number(dati.costo),
      p_causale: dati.causale || ''
    }).then(DB._pick);
  };

  DB.foodCost = function () {
    return DB._client.from('v_food_cost')
      .select('prodotto_id,nome,categoria_id,prezzo,costo,food_cost_perc,n_ingredienti')
      .limit(1000).then(DB._rows);
  };

  DB.leggiRicetta = function (prodottoId) {
    return DB._client.from('ricetta_voci')
      .select('id, quantita, ingrediente_id, ingredienti ( nome, unita, costo_unitario )')
      .eq('prodotto_id', prodottoId)
      .then(DB._rows);
  };

  DB.salvaRicettaVoce = function (record) {
    var richiesta = record.id
      ? DB._client.from('ricetta_voci').update(record).eq('id', record.id)
      : DB._client.from('ricetta_voci').insert(record);
    return richiesta.then(esitoScrittura);
  };

  DB.eliminaRicettaVoce = function (id) {
    return DB._client.from('ricetta_voci').delete().eq('id', id)
      .then(esitoScrittura);
  };

  DB.mappaMenu = function () {
    return Promise.all([
      DB._client.from('menu_categorie').select('id, etichetta').order('ordine'),
      DB._client.from('menu_prodotti').select('id, nome, categoria_id, prezzo')
    ]).then(function (risposte) {
      return {
        categorie: DB._rows(risposte[0]),
        prodotti: DB._rows(risposte[1])
      };
    });
  };

  DB.proposteOrdine = function () {
    return DB._client.from('v_proposte_ordine')
      .select('ingrediente_id,nome,unita,giacenza,scorta_minima,fornitore_id,fornitore_nome,fornitore_telefono,quantita_proposta')
      .order('fornitore_nome', { ascending: true, nullsFirst: false })
      .order('nome')
      .then(DB._rows);
  };

  DB.reportMagazzinoScostamenti = function (dal, al) {
    return DB._client.rpc('report_magazzino_scostamenti', { p_dal: dal || null, p_al: al || null })
      .then(function (risposta) {
        if (risposta.error) throw risposta.error;
        return risposta.data || { periodo: {}, ingredienti: [] };
      });
  };

  DB.inventarioInCorso = function () {
    return DB._client.from('inventari_magazzino')
      .select('id,iniziato_il,operatore,note')
      .is('completato_il', null)
      .order('iniziato_il', { ascending: false }).limit(1).maybeSingle()
      .then(function (risposta) {
        if (risposta.error) throw risposta.error;
        return risposta.data || null;
      });
  };

  DB.inventarioRighe = function (inventarioId) {
    return DB._client.from('inventari_magazzino_righe')
      .select('id,ingrediente_id,giacenza_teorica,giacenza_contata,differenza,ingredienti(nome,unita)')
      .eq('inventario_id', inventarioId)
      .order('id')
      .then(DB._rows);
  };

  DB.inventarioAvvia = function () {
    return DB._client.rpc('inventario_avvia').then(DB._pick);
  };

  DB.inventarioImpostaConteggio = function (rigaId, contata) {
    return DB._client.rpc('inventario_imposta_conteggio', {
      p_riga: rigaId, p_contata: Number(contata)
    }).then(DB._pick);
  };

  DB.inventarioCompleta = function (inventarioId, note) {
    return DB._client.rpc('inventario_completa', {
      p_inventario: inventarioId, p_note: note || ''
    }).then(DB._pick);
  };

  /* ---- Inventario da tablet (permesso 'inventario'; storico e catalogo: titolare) ---- */
  function rpcOrThrow(nome, parametri) {
    return DB._client.rpc(nome, parametri || {}).then(function (risposta) {
      if (risposta.error) throw risposta.error;
      return risposta.data;
    });
  }

  DB.inventarioTabletStato = function () {
    return rpcOrThrow('inventario_tablet_stato');
  };

  DB.inventarioTabletAvvia = function () {
    return rpcOrThrow('inventario_tablet_avvia');
  };

  DB.inventarioTabletConta = function (rigaId, contata) {
    return rpcOrThrow('inventario_tablet_conta', { p_riga: rigaId, p_contata: Number(contata) });
  };

  DB.inventarioTabletSalva = function (inventarioId, note) {
    return rpcOrThrow('inventario_tablet_salva', { p_inventario: inventarioId, p_note: note || '' });
  };

  DB.inventariStorico = function (opzioni) {
    var pagina = DB._pagina(opzioni, 20, 100);
    return rpcOrThrow('inventari_storico', { p_limite: pagina.limite, p_prima_di: pagina.primaDi });
  };

  DB.inventarioDettaglio = function (inventarioId) {
    return rpcOrThrow('inventario_dettaglio', { p_inventario: inventarioId });
  };

  DB.inventarioCatalogo = function () {
    return rpcOrThrow('inventario_catalogo');
  };

  DB.inventarioFornitori = function () {
    return rpcOrThrow('inventario_fornitori');
  };

  DB.inventarioProdottoSalva = function (prodotto) {
    return rpcOrThrow('inventario_prodotto_salva', {
      p_id: prodotto.id || null,
      p_nome: prodotto.nome,
      p_unita: prodotto.unita,
      p_categoria: prodotto.categoria_id || null,
      p_scorta_minima: Number(prodotto.scorta_minima) || 0,
      p_fornitore: prodotto.fornitore_id || null,
      p_attivo: prodotto.attivo !== false,
      p_categoria_nuova: prodotto.categoria_nuova || null,
      p_fornitore_nuovo: prodotto.fornitore_nuovo || null
    });
  };

  DB.inventarioProdottiAzione = function (ids, azione, valore) {
    return rpcOrThrow('inventario_prodotti_azione', {
      p_ids: ids, p_azione: azione, p_valore: valore == null ? null : String(valore)
    });
  };

  DB.inventarioCategorie = function () {
    return rpcOrThrow('inventario_categorie_elenco');
  };

  DB.inventarioCategoriaSalva = function (categoria) {
    return rpcOrThrow('inventario_categoria_salva', { p_id: categoria.id || null, p_nome: categoria.nome });
  };

  DB.inventarioCategoriaElimina = function (id) {
    return rpcOrThrow('inventario_categoria_elimina', { p_id: id });
  };

  DB.inventarioFornitoreSalva = function (fornitore) {
    return rpcOrThrow('inventario_fornitore_salva', {
      p_id: fornitore.id || null, p_nome: fornitore.nome, p_telefono: fornitore.telefono || null
    });
  };

  DB.inventarioFornitoreElimina = function (id) {
    return rpcOrThrow('inventario_fornitore_elimina', { p_id: id });
  };

  DB.inventarioUtenti = function () {
    return rpcOrThrow('inventario_utenti_elenco');
  };

  DB.inventarioUtenteNome = function (id, nome) {
    return rpcOrThrow('inventario_utente_nome_imposta', { p_id: id, p_nome: nome || '' });
  };

  DB._registerModule('inventory');
})(window);

(function (root) {
  'use strict';

  var DB = root.DB;
  if (!DB) throw new Error('Il modulo core DB deve essere caricato per primo.');

  DB.cassaStato = function () {
    return DB._client.rpc('cassa_stato').then(function (risposta) {
      return risposta.error ? { ok: false } : risposta.data;
    });
  };

  DB.cassaSessione = function () {
    return DB._client.from('cassa_sessioni')
      .select('id,operatore,aperta_il,chiusa_il,fondo_iniziale,contanti_dichiarati,stato,totali,note')
      .eq('stato', 'aperta')
      .order('aperta_il', { ascending: false }).limit(1).maybeSingle()
      .then(function (risposta) {
        if (risposta.error) throw risposta.error;
        return risposta.data || null;
      });
  };

  DB.cassaApri = function (fondo) {
    return DB._client.rpc('cassa_apri', {
      p_fondo: Number(fondo) || 0
    }).then(DB._pick);
  };

  DB.cassaChiudi = function (contantiDichiarati) {
    return DB._client.rpc('cassa_chiudi', {
      p_contanti_dichiarati: contantiDichiarati == null || contantiDichiarati === ''
        ? null
        : Number(contantiDichiarati)
    }).then(DB._pick);
  };

  DB.cassaMovimento = function (tipo, importo, causale) {
    return DB._client.rpc('cassa_movimento', {
      p_tipo: tipo,
      p_importo: Number(importo) || 0,
      p_causale: causale || ''
    }).then(DB._pick);
  };

  DB.cassaPagamento = function (dati) {
    return DB._client.rpc('cassa_registra_pagamento', {
      p_ordine: dati.ordine,
      p_metodo: dati.metodo,
      p_importo: Number(dati.importo),
      p_incassato: dati.incassato == null || dati.incassato === ''
        ? null
        : Number(dati.incassato),
      p_riferimento: dati.riferimento || '',
      p_meta: dati.meta || {},
      p_conto: dati.conto || null
    }).then(DB._pick);
  };

  DB.cassaContiRomana = function (ordine, numeroConti) {
    return DB._client.rpc('cassa_conti_romana', {
      p_ordine: ordine,
      p_n: Number(numeroConti)
    }).then(DB._pick);
  };

  DB.cassaContiRimanenti = function (ordine) {
    return DB._client.rpc('cassa_conti_rimanenti', {
      p_ordine: ordine
    }).then(DB._pick);
  };

  DB.cassaContoParziale = function (ordine, righe, etichetta) {
    return DB._client.rpc('cassa_conto_parziale', {
      p_ordine: ordine,
      p_righe: righe,
      p_etichetta: etichetta || 'Parziale'
    }).then(DB._pick);
  };

  DB.cassaContiLista = function (ordine) {
    return DB._client.rpc('cassa_conti_lista', {
      p_ordine: ordine
    }).then(DB._pick);
  };

  DB.cassaContiAnnulla = function (ordine) {
    return DB._client.rpc('cassa_conti_annulla', {
      p_ordine: ordine
    }).then(DB._pick);
  };

  DB.cassaRiepilogoIva = function (ordine) {
    return DB._client.rpc('cassa_riepilogo_iva', {
      p_ordine: ordine
    }).then(DB._pick);
  };

  DB.cassaEmetti = function (ordine, tipo, datiCliente, contoId) {
    return DB._client.rpc('cassa_emetti_documento', {
      p_ordine: ordine,
      p_tipo: tipo || 'documento_commerciale',
      p_dati_cliente: datiCliente || {},
      p_conto: contoId || null
    }).then(DB._pick);
  };

  DB.cassaPayloadRT = function (documento) {
    return DB._client.rpc('cassa_payload_rt', {
      p_documento: documento
    }).then(DB._pick);
  };

  DB.cassaConfermaDoc = function (documento, stato, numero, risposta, lotteria) {
    return DB._client.rpc('cassa_conferma_documento', {
      p_documento: documento,
      p_stato: stato,
      p_numero: numero || '',
      p_risposta: risposta || {},
      p_lotteria: lotteria == null ? null : lotteria
    }).then(DB._pick);
  };

  DB.cassaChiusuraFiscale = function () {
    return DB._client.rpc('cassa_chiusura_fiscale', {}).then(DB._pick);
  };

  DB.cassaDocumenti = function (opzioni) {
    var pagina = DB._pagina(opzioni, 100, 250);
    var richiesta = DB._client.from('documenti_fiscali')
      .select('id,tipo,ordine_id,sessione_id,numero_documento,data,imponibile,iva_totale,totale,righe_iva,cliente_id,dati_cliente,metodo_pagamento,rt_matricola,rt_stato,rt_risposta,lotteria_codice,xml_url,sdi_stato,creato_il,conto_id,righe_stampa')
      .order('data', { ascending: false })
      .order('id', { ascending: false });
    return DB._applicaPaginaTemporale(richiesta, pagina, 'data').then(DB._rows);
  };

  DB.cassaMovimenti = function (sessioneId, opzioni) {
    var pagina = DB._pagina(opzioni, 100, 250);
    var richiesta = DB._client.from('cassa_movimenti')
      .select('id,sessione_id,tipo,importo,causale,operatore,creato_il')
      .order('creato_il', { ascending: false })
      .order('id', { ascending: false });
    if (sessioneId) richiesta = richiesta.eq('sessione_id', sessioneId);
    return DB._applicaPaginaTemporale(richiesta, pagina, 'creato_il').then(DB._rows);
  };

  DB.cassaPagamentiOrdine = function (ordine) {
    return DB._client.from('pagamenti')
      .select('id,ordine_id,sessione_id,metodo,importo,resto,riferimento,stato,operatore,meta,creato_il,conto_id')
      .eq('ordine_id', ordine).order('creato_il').limit(100).then(DB._rows);
  };

  DB.cassaConfig = function () {
    return DB._client.from('cassa_config')
      .select('id,rt_attivo,rt_modello,rt_matricola,rt_endpoint,fattura_provider,fattura_attivo,aliquota_food,aliquota_alcol,aliquota_coperto,denominazione,piva_esercente,aggiornato_il')
      .eq('id', 1).maybeSingle()
      .then(function (risposta) {
        if (risposta.error) throw risposta.error;
        return risposta.data || null;
      });
  };

  DB.cassaConfigSet = function (patch) {
    return DB._client.rpc('cassa_config_set', {
      p_patch: patch
    }).then(DB._pick);
  };

  DB.cassaSetSconto = function (ordine, sconto) {
    return DB._client.rpc('cassa_set_sconto', {
      p_ordine: ordine,
      p_sconto: Number(sconto) || 0
    }).then(DB._pick);
  };

  DB.reportGestionale = function (filtri) {
    filtri = filtri || {};
    return DB._client.rpc('report_gestionale', {
      p_dal: filtri.dal || null,
      p_al: filtri.al || null,
      p_metodo: filtri.metodo || null,
      p_categoria: filtri.categoria || null,
      p_cliente: filtri.cliente || null
    }).then(DB._pick);
  };

  DB.auditOperativo = function (limite) {
    return DB._client.from('audit_operativo')
      .select('id,attore,azione,entita,entita_id,dettagli,creato_il')
      .order('creato_il', { ascending: false })
      .limit(Math.min(Number(limite) || 25, 100))
      .then(DB._rows);
  };

  DB.webhookFalliti = function (limite) {
    return DB._client.from('webhook_eventi')
      .select('id,provider,tipo,riferimento,stato,tentativi,esito,ricevuto_il,elaborato_il')
      .eq('stato', 'errore')
      .order('ricevuto_il', { ascending: false })
      .limit(Math.min(Number(limite) || 20, 100))
      .then(DB._rows);
  };

  DB.reportQueryLente = function (limite) {
    return DB._client.rpc('report_query_lente', { p_limite: Number(limite) || 20 })
      .then(function (risposta) {
        if (risposta.error) throw risposta.error;
        return (risposta.data && risposta.data.query) || [];
      });
  };

  DB.ascoltaCassa = function (callback) {
    var timer = null;
    function aggiorna() {
      clearTimeout(timer);
      timer = setTimeout(callback, 150);
    }
    return DB._client.channel('cassa')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ordini' }, aggiorna)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pagamenti' }, aggiorna)
      .subscribe();
  };

  DB._registerModule('cash');
})(window);

(function (root) {
  'use strict';

  var DB = root.DB;
  if (!DB) throw new Error('Il modulo core DB deve essere caricato per primo.');

  DB.registraErrore = function (origine, livello, messaggio, contesto) {
    if (!DB._client) return Promise.resolve({ ok: false });
    return DB._client.rpc('errore_registra', {
      p_origine: origine,
      p_livello: livello || 'errore',
      p_messaggio: String(messaggio || '').slice(0, 2000),
      p_contesto: contesto || {}
    }).then(function (risposta) {
      return risposta.error ? { ok: false } : (risposta.data || { ok: false });
    }).catch(function () {
      return { ok: false };
    });
  };

  DB._registerModule('errori');
})(window);

(function (root) {
  'use strict';

  var DB = root.DB;
  if (!DB) throw new Error('Il modulo core DB deve essere caricato per primo.');

  DB.leggiErrori = function (opzioni) {
    opzioni = opzioni || {};
    var pagina = DB._pagina(opzioni, 100, 500);
    var richiesta = DB._client.from('errori_applicativi')
      .select('id,origine,livello,messaggio,contesto,utente,creato_il')
      .order('creato_il', { ascending: false })
      .order('id', { ascending: false });
    if (opzioni.origine) richiesta = richiesta.eq('origine', opzioni.origine);
    if (opzioni.livello) richiesta = richiesta.eq('livello', opzioni.livello);
    return DB._applicaPaginaTemporale(richiesta, pagina, 'creato_il').then(DB._rows);
  };

  DB._registerModule('errori-admin');
})(window);
