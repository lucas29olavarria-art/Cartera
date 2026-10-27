// ══════════════════════════════════════════════════════════════════════
// Zafira — motor de reglas puro (sin DOM, sin Supabase, sin IA).
// Lo importan tanto inviu-crm/index.html como inviu-crm/tests/zafira.test.html.
//
// Formas de entrada esperadas (camelCase, como ya las arma el resto del CRM):
//   clients:   [{id,name,createdAt,birthday,ultimoDeposito}]
//   flows:     [{id,clientId,ticker,tipo,moneda,fecha,monto,cobrado}]
//   contactos: [{id,clientId,fecha,canal,nota}]
//   config:    {dias_sin_contacto,dias_sin_deposito,dias_cobro_cerca,
//               dias_reinversion,dias_cliente_nuevo,templates:{...}}
//   hoy:       string 'YYYY-MM-DD' (para que los tests sean deterministas)
//
// Salida: [{clientId,tipo,motivo,prioridad,sugerenciaMensaje}]
// ══════════════════════════════════════════════════════════════════════

const ZAFIRA_DIAS_CLIENTE_NUEVO_SIN_CONTACTO = 14; // fijo, no está en zafira_config

function zafiraDaysBetween(fromStr, toStr) {
  const a = new Date(fromStr + 'T00:00:00');
  const b = new Date(toStr + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}

function zafiraLastContactDate(clientId, contactos) {
  const mine = (contactos || []).filter(c => c.clientId === clientId);
  if (!mine.length) return null;
  return mine.map(c => c.fecha.slice(0, 10)).sort().slice(-1)[0];
}

function fillTemplate(str, vars) {
  if (!str) return '';
  return str.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
}

function zafiraMsg(templates, key, vars) {
  return fillTemplate((templates || {})[key] || '', vars);
}

// Cumpleaños: compara mes/día nomás, el año de nacimiento no importa acá.
function zafiraIsBirthdaySoon(birthday, hoyStr) {
  if (!birthday) return false;
  const bd = birthday.slice(5, 10); // "MM-DD"
  const hoy = new Date(hoyStr + 'T00:00:00');
  const manana = new Date(hoy.getTime() + 86400000);
  const hoyMD = hoyStr.slice(5, 10);
  const mananaMD = manana.toISOString().slice(5, 10);
  return bd === hoyMD || bd === mananaMD;
}

function computeZafira(clients, flows, contactos, config, hoy) {
  const cfg = config || {};
  const templates = cfg.templates || {};
  const alerts = [];

  (clients || []).forEach(client => {
    const nombre = (client.name || '').split(' ')[0];
    const lastContact = zafiraLastContactDate(client.id, contactos) || (client.createdAt ? String(client.createdAt).slice(0, 10) : null);
    const diasSinContacto = lastContact ? zafiraDaysBetween(lastContact, hoy) : null;
    const createdAtStr = client.createdAt ? String(client.createdAt).slice(0, 10) : null;
    const diasDesdeAlta = createdAtStr ? zafiraDaysBetween(createdAtStr, hoy) : null;
    const esNuevo = diasDesdeAlta != null && diasDesdeAlta <= (cfg.dias_cliente_nuevo ?? 30);

    // Cliente nuevo — se evalúa antes que "sin contacto" para que un alta
    // reciente sin seguimiento salga como "cliente nuevo", no "sin contacto".
    if (esNuevo && diasSinContacto != null && diasSinContacto > ZAFIRA_DIAS_CLIENTE_NUEVO_SIN_CONTACTO) {
      alerts.push({
        clientId: client.id, tipo: 'cliente_nuevo',
        motivo: `Alta hace ${diasDesdeAlta} días y sin contacto en ${diasSinContacto}`,
        prioridad: 'media',
        sugerenciaMensaje: zafiraMsg(templates, 'cliente_nuevo', { nombre }),
      });
    } else if (diasSinContacto != null && diasSinContacto > (cfg.dias_sin_contacto ?? 45)) {
      alerts.push({
        clientId: client.id, tipo: 'sin_contacto',
        motivo: `Más de ${diasSinContacto} días sin registrar un contacto`,
        prioridad: 'alta',
        sugerenciaMensaje: zafiraMsg(templates, 'sin_contacto', { nombre }),
      });
    }

    // Sin depósitos — si nunca hubo uno detectado, se usa la fecha de alta
    // como referencia (no se marca "sin depósitos" desde el día cero).
    const baseDeposito = client.ultimoDeposito || createdAtStr;
    const diasSinDeposito = baseDeposito ? zafiraDaysBetween(baseDeposito, hoy) : null;
    if (diasSinDeposito != null && diasSinDeposito > (cfg.dias_sin_deposito ?? 90)) {
      alerts.push({
        clientId: client.id, tipo: 'sin_deposito',
        motivo: `Más de ${diasSinDeposito} días sin ingreso de dinero`,
        prioridad: 'alta',
        sugerenciaMensaje: zafiraMsg(templates, 'sin_deposito', { nombre }),
      });
    }

    if (zafiraIsBirthdaySoon(client.birthday, hoy)) {
      alerts.push({
        clientId: client.id, tipo: 'cumpleanos',
        motivo: client.birthday.slice(5, 10) === hoy.slice(5, 10) ? 'Cumple hoy' : 'Cumple mañana',
        prioridad: 'baja',
        sugerenciaMensaje: zafiraMsg(templates, 'cumpleanos', { nombre }),
      });
    }

    const misFlows = (flows || []).filter(f => f.clientId === client.id);

    // Cobro cerca: pendiente, vence dentro de la ventana configurada.
    misFlows.filter(f => !f.cobrado).forEach(f => {
      const dias = zafiraDaysBetween(hoy, f.fecha);
      if (dias >= 0 && dias <= (cfg.dias_cobro_cerca ?? 7)) {
        alerts.push({
          clientId: client.id, tipo: 'cobro_cerca',
          motivo: `${f.ticker} vence el ${f.fecha}`,
          prioridad: 'media',
          sugerenciaMensaje: zafiraMsg(templates, 'cobro_cerca', { nombre, ticker: f.ticker, fecha: f.fecha }),
        });
      }
    });

    // Plata para reinvertir: cobrado hace poco. Aproximación conocida: se
    // usa la fecha programada (fecha) como proxy de cuándo se cobró de
    // verdad, porque flows no guarda un timestamp de cuándo se tildó
    // "cobrado" — puede dar falsos positivos/negativos si el cobro real
    // no coincidió con la fecha programada.
    misFlows.filter(f => f.cobrado).forEach(f => {
      const dias = zafiraDaysBetween(f.fecha, hoy);
      if (dias >= 0 && dias <= (cfg.dias_reinversion ?? 3)) {
        alerts.push({
          clientId: client.id, tipo: 'reinversion',
          motivo: `Cobró ${f.ticker} hace ${dias} ${dias === 1 ? 'día' : 'días'}`,
          prioridad: 'media',
          sugerenciaMensaje: zafiraMsg(templates, 'reinversion', { nombre, ticker: f.ticker, monto: f.monto }),
        });
      }
    });
  });

  const orden = { alta: 0, media: 1, baja: 2 };
  alerts.sort((a, b) => orden[a.prioridad] - orden[b.prioridad]);
  return alerts;
}
