// ══════════════════════════ MORNING CALL ══════════════════════════
// Pestaña para armar el resumen diario del canal de WhatsApp:
//   1) guion del audio (lo genera la tarea programada de las 9:12)
//   2) conversor WAV → MP3 en el navegador (AI Studio descarga WAV)
//   3) imagen "Resumen del día" y botones para compartir
// Lee la tabla public.morning_call (migración 012). Usa los globales del CRM:
// sb, sc, esc, toast, ATb.

const MC_STYLE = 'Leé en español rioplatense, con acento argentino de Buenos Aires bien marcado, "sh" porteño y voseo. Tono de asesor financiero joven, cercano y seguro, como un audio de WhatsApp a sus clientes. Ritmo natural, nada de locutor de radio.';
const MC_STUDIO_URL = 'https://aistudio.google.com/';
const MC_LAME_URL = 'https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js';
const MC = { fechas: [], sel: null, row: null, mp3: null, mp3Url: null };

function mcHoyISO() {
  const d = new Date();
  const z = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

function mcFechaLabel(f) {
  const d = new Date(f + 'T12:00:00');
  const t = d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function mcTextoCanal() {
  const d = new Date((MC.sel || mcHoyISO()) + 'T12:00:00');
  const dia = d.toLocaleDateString('es-AR', { weekday: 'long' });
  const z = n => String(n).padStart(2, '0');
  return `🎧 Resumen del día — ${dia} ${z(d.getDate())}/${z(d.getMonth() + 1)}`;
}

function mcImagenValida(src) {
  return typeof src === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(src);
}

async function renderMorning() {
  sc(`<div class="sec-hdr"><h2>🎙 Morning Call</h2></div>
      <div class="card"><div style="font-size:12px;color:var(--soft);">Cargando…</div></div>`);
  const { data, error } = await sb.from('morning_call').select('fecha').order('fecha', { ascending: false }).limit(15);
  if (ATb !== 'mc') return;
  if (error) {
    sc(`<div class="sec-hdr"><h2>🎙 Morning Call</h2></div>
        <div class="card" style="border-color:rgba(240,108,108,.3);">
          <div style="font-size:12px;color:var(--red);margin-bottom:6px;">No pude leer los datos del Morning Call.</div>
          <div style="font-size:11px;color:var(--soft);line-height:1.5;">Si es la primera vez, falta correr la migración <b>012_morning_call.sql</b> en Supabase.<br>Detalle: ${esc(error.message || '')}</div>
        </div>`);
    return;
  }
  MC.fechas = (data || []).map(r => r.fecha);
  if (!MC.fechas.length) {
    sc(`<div class="sec-hdr"><h2>🎙 Morning Call</h2></div>
        <div class="card"><div class="empty">Todavía no hay ningún resumen cargado.<br>Se genera solo de lunes a viernes a las 9:12.</div></div>`);
    return;
  }
  if (!MC.sel || !MC.fechas.includes(MC.sel)) MC.sel = MC.fechas[0];
  await mcLoad(MC.sel);
}

async function mcLoad(fecha) {
  MC.sel = fecha;
  MC.mp3 = null;
  if (MC.mp3Url) { URL.revokeObjectURL(MC.mp3Url); MC.mp3Url = null; }
  const { data, error } = await sb.from('morning_call').select('fecha,guion,imagen_png').eq('fecha', fecha).maybeSingle();
  if (ATb !== 'mc') return;
  if (error || !data) { toast('No pude cargar ese día'); return; }
  MC.row = data;
  mcRender();
}

function mcRender() {
  const r = MC.row;
  const esHoy = r.fecha === mcHoyISO();
  const img = mcImagenValida(r.imagen_png) ? r.imagen_png : null;
  sc(`
  <div class="sec-hdr">
    <h2>🎙 Morning Call</h2>
    <select class="fi" style="width:auto;" onchange="mcLoad(this.value)">
      ${MC.fechas.map(f => `<option value="${esc(f)}" ${f === MC.sel ? 'selected' : ''}>${esc(mcFechaLabel(f))}</option>`).join('')}
    </select>
  </div>
  ${esHoy ? '' : `<div class="card" style="border-color:rgba(245,166,35,.3);"><div style="font-size:12px;color:var(--amber);">⚠ Todavía no llegó el de hoy (se genera de lunes a viernes a las 9:12). Estás viendo el ${esc(mcFechaLabel(r.fecha))}.</div></div>`}

  <div class="card">
    <label class="flbl">1 · Guion del audio</label>
    <div style="font-size:13px;line-height:1.6;white-space:pre-wrap;max-height:260px;overflow:auto;background:var(--bg4);border:1px solid var(--line);border-radius:var(--r);padding:12px;margin-bottom:10px;">${esc(r.guion)}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button class="ib pri" onclick="mcAbrirStudio()">🎙 Copiar guion y abrir AI Studio</button>
      <button class="ib" onclick="mcCopiar('guion')">📋 Copiar guion</button>
      <button class="ib" onclick="mcCopiar('estilo')">🎨 Copiar estilo</button>
    </div>
    <div style="font-size:10px;color:var(--muted);margin-top:8px;line-height:1.5;">En AI Studio: Create new dialog › Speaker <b>Knox</b> › pegá el estilo en <b>Style</b> y el guion en el recuadro › play › descargá el WAV y traelo al paso 2.</div>
  </div>

  <div class="card">
    <label class="flbl">2 · Audio (WAV → MP3)</label>
    <input type="file" id="mc-wav" accept=".wav,audio/wav,audio/x-wav,audio/*" style="display:none;" onchange="mcConvertir(this.files[0])">
    <div class="upl" id="mc-drop" onclick="document.getElementById('mc-wav').click()">🎧 Tocá o arrastrá acá el WAV de AI Studio</div>
    <div id="mc-audio-out" style="margin-top:10px;"></div>
  </div>

  <div class="card">
    <label class="flbl">3 · Imagen del día</label>
    ${img ? `
      <img src="${img}" alt="Resumen del día" style="width:100%;max-width:420px;display:block;border-radius:var(--r2);border:1px solid var(--line);margin-bottom:10px;">
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="ib" onclick="mcDescargarImg()">⬇ Descargar imagen</button>
        <button class="ib" onclick="mcCompartir(false)">📤 Compartir imagen</button>
      </div>` : `<div style="font-size:12px;color:var(--muted);">Ese día no se generó imagen.</div>`}
  </div>

  <div class="card">
    <button class="ib grn" style="width:100%;padding:11px;margin-bottom:8px;" onclick="mcCompartir(true)">📲 Compartir audio + imagen</button>
    <button class="ib" style="width:100%;padding:9px;" onclick="mcCopiar('canal')">✍ Copiar texto para el canal: <span style="color:var(--text);">${esc(mcTextoCanal())}</span></button>
    <div style="font-size:10px;color:var(--muted);margin-top:6px;line-height:1.5;">En el celu abre el menú de compartir (elegís WhatsApp y el canal). En la compu los descarga. Primero convertí el audio en el paso 2.</div>
  </div>`);

  const drop = document.getElementById('mc-drop');
  if (drop) {
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.style.borderColor = 'var(--blue)'; });
    drop.addEventListener('dragleave', () => { drop.style.borderColor = ''; });
    drop.addEventListener('drop', e => {
      e.preventDefault();
      drop.style.borderColor = '';
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) mcConvertir(f);
    });
  }
}

async function mcCopiarTexto(txt) {
  try {
    await navigator.clipboard.writeText(txt);
    return true;
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = txt;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
    ta.remove();
    return ok;
  }
}

async function mcCopiar(tipo) {
  const txt = tipo === 'estilo' ? MC_STYLE : tipo === 'canal' ? mcTextoCanal() : (MC.row && MC.row.guion) || '';
  const ok = await mcCopiarTexto(txt);
  const msg = { estilo: 'Estilo copiado', canal: 'Texto copiado' }[tipo] || 'Guion copiado';
  toast(ok ? msg : 'No pude copiar: seleccioná el texto a mano');
}

function mcAbrirStudio() {
  // abrir primero (dentro del clic) para que el navegador no lo bloquee
  window.open(MC_STUDIO_URL, '_blank', 'noopener');
  mcCopiar('guion');
}

function mcCargarLame() {
  if (window.lamejs) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = MC_LAME_URL;
    s.onload = () => (window.lamejs ? res() : rej(new Error('el conversor no se cargó bien')));
    s.onerror = () => rej(new Error('no pude descargar el conversor (¿sin internet?)'));
    document.head.appendChild(s);
  });
}

async function mcDecodificar(buf) {
  const AC = window.AudioContext || window.webkitAudioContext;
  let ctx;
  try { ctx = new AC({ sampleRate: 44100 }); } catch (e) { ctx = new AC(); }
  try {
    return await new Promise((res, rej) => {
      const p = ctx.decodeAudioData(buf, res, rej);
      if (p && p.then) p.then(res, rej);
    });
  } finally {
    if (ctx.close) ctx.close();
  }
}

function mcDuracion(seg) {
  const m = Math.floor(seg / 60);
  const s = Math.round(seg % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

async function mcConvertir(file) {
  if (!file) return;
  const out = document.getElementById('mc-audio-out');
  if (!out) return;
  out.innerHTML = '<div style="font-size:12px;color:var(--blue);">Convirtiendo a MP3… (unos segundos)</div>';
  try {
    await mcCargarLame();
    const audio = await mcDecodificar(await file.arrayBuffer());
    const n = audio.length;
    const ch = audio.numberOfChannels;
    const mono = new Float32Array(n);
    for (let c = 0; c < ch; c++) {
      const d = audio.getChannelData(c);
      for (let i = 0; i < n; i++) mono[i] += d[i] / ch;
    }
    const pcm = new Int16Array(n);
    for (let i = 0; i < n; i++) {
      const s = Math.max(-1, Math.min(1, mono[i]));
      pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    const enc = new window.lamejs.Mp3Encoder(1, audio.sampleRate, 96);
    const partes = [];
    for (let i = 0; i < n; i += 1152) {
      const b = enc.encodeBuffer(pcm.subarray(i, i + 1152));
      if (b.length) partes.push(new Uint8Array(b));
    }
    const fin = enc.flush();
    if (fin.length) partes.push(new Uint8Array(fin));

    const nombre = `morning_call_${MC.sel}.mp3`;
    const blob = new Blob(partes, { type: 'audio/mpeg' });
    MC.mp3 = new File([blob], nombre, { type: 'audio/mpeg' });
    if (MC.mp3Url) URL.revokeObjectURL(MC.mp3Url);
    MC.mp3Url = URL.createObjectURL(blob);

    out.innerHTML = `
      <audio controls src="${MC.mp3Url}" style="width:100%;margin-bottom:8px;"></audio>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <a class="ib" href="${MC.mp3Url}" download="${esc(nombre)}" style="text-decoration:none;">⬇ Descargar MP3</a>
        <button class="ib" onclick="mcCompartirAudio()">📤 Compartir audio</button>
        <span class="chip g">MP3 listo · ${mcDuracion(audio.duration)}</span>
      </div>`;
  } catch (e) {
    out.innerHTML = `<div style="font-size:12px;color:var(--red);">No pude convertir el archivo: ${esc((e && e.message) || String(e))}</div>`;
  }
}

function mcImagenFile() {
  const src = MC.row && MC.row.imagen_png;
  if (!mcImagenValida(src)) return null;
  const bin = atob(src.split(',')[1]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], `resumen_${MC.sel}.png`, { type: 'image/png' });
}

function mcDescargar(file) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function mcDescargarImg() {
  const f = mcImagenFile();
  if (f) mcDescargar(f);
}

async function mcCompartirArchivos(files) {
  if (navigator.canShare && navigator.canShare({ files })) {
    try {
      await navigator.share({ files, text: mcTextoCanal() });
    } catch (e) {
      if (e && e.name !== 'AbortError') toast('No se pudo compartir');
    }
    return;
  }
  files.forEach(mcDescargar);
  toast('Este navegador no comparte archivos: los descargué');
}

function mcCompartirAudio() {
  if (!MC.mp3) { toast('Primero convertí el audio'); return; }
  mcCompartirArchivos([MC.mp3]);
}

function mcCompartir(conAudio) {
  const files = [];
  if (conAudio) {
    if (!MC.mp3) { toast('Primero convertí el audio (paso 2)'); return; }
    files.push(MC.mp3);
  }
  const img = mcImagenFile();
  if (img) files.push(img);
  if (!files.length) { toast('No hay nada para compartir'); return; }
  mcCompartirArchivos(files);
}
