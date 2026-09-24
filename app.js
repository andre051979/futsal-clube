// ===== Festa do Futsal — página de ingressos =====
const CONFIG = {
  whatsappNumero: '5511989540444',               // WhatsApp que recebe o aviso de pagamento
  vendasAte: '2026-10-23T21:00:00-03:00',
  precos: { adulto: 75, crianca6: 45, crianca0: 0 },
  maxPessoas: 30
};
const FAIXAS = [
  { v: 'adulto',   label: 'Adulto (12+) — R$ 75' },
  { v: 'crianca6', label: 'Criança 6 a 11 — R$ 45' },
  { v: 'crianca0', label: 'Criança 0 a 5 — grátis' }
];
const DDDS = [11,12,13,14,15,16,17,18,19,21,22,24,27,28,31,32,33,34,35,37,38,41,42,43,44,45,46,47,48,49,51,53,54,55,61,62,63,64,65,66,67,68,69,71,73,74,75,77,79,81,82,83,84,85,86,87,88,89,91,92,93,94,95,96,97,98,99];

const $ = (id) => document.getElementById(id);
const brl = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const store = {
  get() { try { return JSON.parse(localStorage.getItem('festaPedido') || 'null'); } catch (_) { return null; } },
  set(v) { try { localStorage.setItem('festaPedido', JSON.stringify(v)); } catch (_) {} },
  clear() { try { localStorage.removeItem('festaPedido'); } catch (_) {} }
};
let tipo = null;
let enviando = false;
let pedidoAtual = null;   // { codigo, whatsapp, status, total, comprador, socioNumero, pessoas, ... }

// ----- WhatsApp: máscara (XX) 9XXXX-XXXX e validação -----
function mascaraTel(v) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? '(' + d : '';
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
function telValido(v) {
  const d = v.replace(/\D/g, '');
  return d.length === 11 && DDDS.includes(Number(d.slice(0, 2))) && d[2] === '9';
}
document.querySelectorAll('.js-tel').forEach(inp => inp.addEventListener('input', () => {
  inp.value = mascaraTel(inp.value);
  if (inp.value.replace(/\D/g, '').length === 11) inp.classList.toggle('invalid', !telValido(inp.value));
  else inp.classList.remove('invalid');
}));

// ----- Modal -----
function abrir() {
  $('overlay').classList.add('open');
  document.body.classList.add('modal-open');
}
function fechar() {
  $('overlay').classList.remove('open');
  document.body.classList.remove('modal-open');
}
function alertBox(msg, id = 'erro') { const e = $(id); e.textContent = msg; e.classList.remove('hidden'); }
function mostrar(stepId) {
  ['step1', 'step2', 'step3', 'stepConsulta'].forEach(s => $(s).classList.toggle('hidden', s !== stepId));
  $('overlay').scrollTop = 0;
}
document.querySelectorAll('.js-comprar').forEach(b => b.addEventListener('click', () => {
  if (new Date() > new Date(CONFIG.vendasAte)) alertBox('As vendas pela página estão encerradas.');
  $('modalTitle').textContent = 'Comprar ingressos';
  mostrar('step1'); abrir();
}));
document.querySelectorAll('.js-consultar').forEach(b => b.addEventListener('click', () => abrirConsulta()));
$('btnFechar').addEventListener('click', fechar);
$('btnConcluir').addEventListener('click', () => { fechar(); location.reload(); });
$('overlay').addEventListener('click', (e) => { if (e.target === $('overlay') && $('step3').classList.contains('hidden')) fechar(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fechar(); });

document.querySelectorAll('.choice button').forEach(b => b.addEventListener('click', () => {
  tipo = b.dataset.tipo;
  $('blocoSocio').classList.toggle('hidden', tipo !== 'socio');
  $('blocoNaoSocio').classList.toggle('hidden', tipo !== 'nao-socio');
  $('modalTitle').textContent = tipo === 'socio' ? 'Compra de sócio' : 'Compra de convidado';
  $('erro').classList.add('hidden');
  mostrar('step2');
  calcular();
}));
$('btnVoltar').addEventListener('click', () => { $('modalTitle').textContent = 'Comprar ingressos'; mostrar('step1'); });

// ----- Convidados -----
function addGuest() {
  const n = $('guests').children.length;
  if (n + 1 >= CONFIG.maxPessoas) { alertBox('Limite de ' + CONFIG.maxPessoas + ' pessoas por pedido.'); return; }
  const div = document.createElement('div');
  div.className = 'guest';
  div.innerHTML = `
    <div class="guest-top"><strong>Pessoa</strong><button type="button">remover</button></div>
    <div class="field"><label>Nome completo *</label><input class="g-nome" autocomplete="off"></div>
    <div class="row2">
      <div class="field"><label>Faixa etária *</label>
        <select class="g-faixa">${FAIXAS.map(f => `<option value="${f.v}">${f.label}</option>`).join('')}</select>
      </div>
      <div class="field"><label class="g-rg-label">RG *</label><input class="g-rg" autocomplete="off"></div>
    </div>`;
  div.querySelector('.guest-top button').addEventListener('click', () => { div.remove(); renumerar(); calcular(); });
  div.querySelector('.g-faixa').addEventListener('change', (e) => {
    div.querySelector('.g-rg-label').textContent = e.target.value === 'crianca0' ? 'RG (opcional)' : 'RG *';
    calcular();
  });
  $('guests').appendChild(div);
  renumerar(); calcular();
  div.querySelector('.g-nome').focus();
}
function renumerar() {
  [...$('guests').children].forEach((g, i) => g.querySelector('.guest-top strong').textContent = 'Pessoa ' + (i + 1));
}
$('btnAddGuest').addEventListener('click', addGuest);
$('socioVai').addEventListener('change', calcular);

// ----- Coleta e cálculo -----
function coletarPessoas() {
  const pessoas = [];
  if (tipo === 'socio' && $('socioVai').checked) pessoas.push({ nome: $('socioNome').value.trim(), rg: $('socioRG').value.trim(), faixa: 'adulto', titular: true });
  if (tipo === 'nao-socio') pessoas.push({ nome: $('compNome').value.trim(), rg: $('compRG').value.trim(), faixa: 'adulto', titular: true });
  [...$('guests').children].forEach(g => pessoas.push({
    nome: g.querySelector('.g-nome').value.trim(),
    rg: g.querySelector('.g-rg').value.trim(),
    faixa: g.querySelector('.g-faixa').value,
    titular: false
  }));
  return pessoas;
}
function contar(pessoas) {
  const q = { adulto: 0, crianca6: 0, crianca0: 0 };
  pessoas.forEach(p => q[p.faixa]++);
  q.total = q.adulto * CONFIG.precos.adulto + q.crianca6 * CONFIG.precos.crianca6;
  return q;
}
function resumoHTML(q) {
  let h = '';
  if (q.adulto) h += `<div class="resumo-row"><span>Adultos (${q.adulto})</span><span>${brl(q.adulto * CONFIG.precos.adulto)}</span></div>`;
  if (q.crianca6) h += `<div class="resumo-row"><span>Crianças 6 a 11 (${q.crianca6})</span><span>${brl(q.crianca6 * CONFIG.precos.crianca6)}</span></div>`;
  if (q.crianca0) h += `<div class="resumo-row"><span>Crianças 0 a 5 (${q.crianca0})</span><span>GRÁTIS</span></div>`;
  if (!h) h = `<div class="resumo-row"><span>Nenhuma pessoa cadastrada ainda</span><span></span></div>`;
  h += `<div class="resumo-total"><span>TOTAL</span><span>${brl(q.total)}</span></div>`;
  return h;
}
function calcular() { $('resumo').innerHTML = resumoHTML(contar(coletarPessoas())); }

// ----- Validação -----
function marcar(el, ok) { el.classList.toggle('invalid', !ok); return ok; }
const nomeOk = (s) => s.trim().split(/\s+/).length >= 2 && s.trim().length >= 5;
const rgOk = (s) => s.replace(/[^0-9a-zA-Z]/g, '').length >= 5;

function validar() {
  const erros = [];
  const req = (id, fn, msg) => { if (!marcar($(id), fn($(id).value))) erros.push(msg); };
  const msgTel = 'WhatsApp inválido: use um celular com DDD, no formato (11) 98765-4321.';
  if (tipo === 'socio') {
    req('socioNumero', v => v.trim().length > 0, 'Informe o número do sócio.');
    req('socioNome', nomeOk, 'Informe o nome completo do sócio.');
    req('socioRG', rgOk, 'Informe o RG do sócio.');
    req('socioWhats', telValido, msgTel);
  } else {
    req('amigoNumero', v => v.trim().length > 0, 'Informe o número do sócio que está te convidando.');
    req('amigoNome', v => v.trim().length >= 3, 'Informe o nome do sócio que está te convidando.');
    req('compNome', nomeOk, 'Informe seu nome completo.');
    req('compRG', rgOk, 'Informe seu RG.');
    req('compWhats', telValido, msgTel);
  }
  [...$('guests').children].forEach((g, i) => {
    const nome = g.querySelector('.g-nome'), rg = g.querySelector('.g-rg'), faixa = g.querySelector('.g-faixa').value;
    if (!marcar(nome, nomeOk(nome.value))) erros.push(`Pessoa ${i + 1}: informe o nome completo.`);
    if (!marcar(rg, faixa !== 'crianca0' ? rgOk(rg.value) : true)) erros.push(`Pessoa ${i + 1}: RG obrigatório a partir de 6 anos.`);
  });
  const pessoas = coletarPessoas();
  if (pessoas.length === 0) erros.push('Cadastre pelo menos uma pessoa para a festa.');
  const rgs = pessoas.map(p => p.rg.replace(/[^0-9a-zA-Z]/g, '').toUpperCase()).filter(Boolean);
  if (new Set(rgs).size !== rgs.length) erros.push('Há RGs repetidos no pedido.');
  if (!$('lgpd').checked) erros.push('É preciso autorizar o uso dos dados (LGPD).');
  return erros;
}

// ----- Criar pedido -----
$('step2').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (enviando) return;
  $('erro').classList.add('hidden');
  if (new Date() > new Date(CONFIG.vendasAte)) { alertBox('As vendas pela página estão encerradas.'); return; }
  const erros = validar();
  if (erros.length) { alertBox(erros.slice(0, 4).join(' ')); return; }

  const pessoas = coletarPessoas();
  const payload = tipo === 'socio'
    ? { tipo, socioNumero: $('socioNumero').value.trim(), socioNome: $('socioNome').value.trim(),
        compradorNome: $('socioNome').value.trim(), compradorRG: $('socioRG').value.trim(), whatsapp: $('socioWhats').value.trim() }
    : { tipo, socioNumero: $('amigoNumero').value.trim(), socioNome: $('amigoNome').value.trim(),
        compradorNome: $('compNome').value.trim(), compradorRG: $('compRG').value.trim(), whatsapp: $('compWhats').value.trim() };
  payload.pessoas = pessoas;
  payload.lgpd = true;
  payload.website = document.querySelector('[name=website]').value;

  enviando = true;
  const btn = $('btnEnviar');
  btn.disabled = true; btn.textContent = 'Registrando pedido...';
  try {
    const r = await fetch('/api/pedido', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.codigo) throw new Error(data.erro || 'Não foi possível registrar o pedido. Tente novamente.');
    store.set({ codigo: data.codigo, whatsapp: data.whatsapp });
    mostrarPedido(data, 'Pedido registrado ✅');
  } catch (err) {
    alertBox(err.message);
    btn.disabled = false; btn.textContent = 'GERAR PEDIDO E PAGAR';
    enviando = false;
  }
});

// ----- Tela do pedido (novo ou resgatado) -----
function fmtData(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}
function mensagemWhats(p) {
  return `Olá! Acabei de enviar o comprovante de pagamento da Festa do Futsal.\nPedido: ${p.codigo}\nNome: ${p.comprador}\nSócio: ${p.socioNumero}\nPessoas: ${p.pessoas}\nTotal: ${brl(p.total)}`;
}
function liberarWhats(p) {
  const wa = $('btnWhatsapp');
  wa.href = `https://wa.me/${CONFIG.whatsappNumero}?text=${encodeURIComponent(mensagemWhats(p))}`;
  wa.removeAttribute('aria-disabled');
  wa.textContent = '💬 AVISAR NO WHATSAPP QUE ENVIEI O PIX';
}
function mostrarPedido(p, titulo) {
  pedidoAtual = p;
  $('modalTitle').textContent = titulo || `Pedido ${p.codigo}`;
  $('codigo').textContent = p.codigo;
  $('resumoFinal').innerHTML = resumoHTML({ adulto: p.adultos, crianca6: p.criancas6, crianca0: p.criancas0, total: p.total });
  $('msgPreview').textContent = mensagemWhats(p);
  $('erroUp').classList.add('hidden');

  const pend = p.status === 'Pendente';
  const enviado = p.status === 'Comprovante enviado';
  $('expira').innerHTML = pend && p.expiraEm ? `Pague e envie o comprovante até <b>${fmtData(p.expiraEm)}</b>` : '';

  // Pix
  $('blocoPix').classList.toggle('hidden', !(pend && p.pix));
  if (pend && p.pix) {
    $('qr').innerHTML = p.pix.svg;
    $('copiaCola').value = p.pix.copiaCola;
    $('pixMeta').innerHTML = `Recebedor: <b>${esc(p.pix.nome)}</b> · Valor: <b>${brl(p.total)}</b><br>Identificador do Pix: ${esc(p.codigo.replace('-', ''))}`;
  }
  // Comprovante e WhatsApp
  $('blocoComprovante').classList.toggle('hidden', !(pend || enviado));
  $('blocoWhats').classList.toggle('hidden', !(pend || enviado));
  const wa = $('btnWhatsapp');
  wa.setAttribute('aria-disabled', 'true'); wa.href = '#';
  wa.textContent = '🔒 Anexe o comprovante para liberar o WhatsApp';
  if (enviado) liberarWhats(p);
  $('fileLabel').firstChild.textContent = enviado ? '📎 Enviar outro comprovante (substitui o anterior) ' : '📎 Toque para escolher a foto ou o PDF do comprovante ';

  // Mensagem de status
  let st = '';
  if (enviado) st = `<div class="ok-box">✅ Comprovante recebido. A organização vai conferir o pagamento e confirmar seu pedido.</div>`;
  if (p.status === 'Pago') { st = `<div class="ok-box">🎉 Pagamento confirmado! Seus nomes estão na lista da portaria. Até a festa!</div>`; store.clear(); }
  if (p.status === 'Expirado' || p.status === 'Cancelado') { st = `<div class="error-box">Este pedido está <b>${esc(p.status.toLowerCase())}</b>. Faça um novo pedido pela página.</div>`; store.clear(); }
  $('blocoStatus').innerHTML = st;
  mostrar('step3');
  abrir();
}

$('btnCopiar').addEventListener('click', () => {
  const txt = $('copiaCola').value;
  const ok = () => { $('btnCopiar').textContent = '✅ Código copiado!'; setTimeout(() => $('btnCopiar').textContent = '📋 COPIAR CÓDIGO PIX', 2000); };
  if (navigator.clipboard) navigator.clipboard.writeText(txt).then(ok).catch(fallback); else fallback();
  function fallback() { $('copiaCola').select(); try { document.execCommand('copy'); ok(); } catch (_) {} }
});

// ----- Comprovante -----
$('arquivo').addEventListener('change', () => {
  const f = $('arquivo').files[0];
  $('btnUpload').disabled = !f;
  if (f) $('fileLabel').firstChild.textContent = `📎 ${f.name} `;
});

// reduz imagens grandes para caber no envio (máx. ~1600px, JPEG)
function prepararArquivo(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    if (file.type === 'application/pdf') {
      if (file.size > 3 * 1024 * 1024) return reject(new Error('PDF muito grande (máx. 3 MB).'));
      reader.onload = () => resolve({ tipo: 'application/pdf', base64: reader.result.split(',')[1] });
      return reader.readAsDataURL(file);
    }
    if (!file.type.startsWith('image/')) return reject(new Error('Envie uma imagem ou PDF do comprovante.'));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 1600, k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        resolve({ tipo: 'image/jpeg', base64: c.toDataURL('image/jpeg', 0.82).split(',')[1] });
      };
      img.onerror = () => reject(new Error('Imagem inválida.'));
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

$('btnUpload').addEventListener('click', async () => {
  const f = $('arquivo').files[0];
  if (!f || !pedidoAtual) return;
  const btn = $('btnUpload');
  btn.disabled = true; btn.textContent = 'Enviando comprovante...';
  $('erroUp').classList.add('hidden');
  try {
    const arquivo = await prepararArquivo(f);
    const r = await fetch('/api/comprovante', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo: pedidoAtual.codigo, whatsapp: pedidoAtual.whatsapp, arquivo }) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.erro || 'Falha ao enviar o comprovante.');
    $('arquivo').value = '';
    btn.textContent = 'ENVIAR COMPROVANTE';
    mostrarPedido({ ...pedidoAtual, ...data, pix: pedidoAtual.pix }, 'Comprovante enviado ✅');
    $('btnWhatsapp').scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (err) {
    alertBox(err.message, 'erroUp');
    btn.disabled = false; btn.textContent = 'ENVIAR COMPROVANTE';
  }
});

// ----- Consulta (resgatar pedido) -----
function abrirConsulta(codigo = '', whatsapp = '') {
  $('cCodigo').value = codigo; $('cWhats').value = whatsapp;
  $('erroConsulta').classList.add('hidden');
  $('modalTitle').textContent = 'Meu pedido';
  mostrar('stepConsulta'); abrir();
}
async function consultar(codigo, whatsapp) {
  const r = await fetch('/api/consulta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codigo, whatsapp }) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.erro || 'Pedido não encontrado.');
  return data;
}
$('stepConsulta').addEventListener('submit', async (e) => {
  e.preventDefault();
  const codigo = $('cCodigo').value.trim(), whatsapp = $('cWhats').value.trim();
  if (!/^\s*FUT-?\d{1,6}\s*$/i.test(codigo)) return alertBox('Informe o código no formato FUT-0042.', 'erroConsulta');
  if (!telValido(whatsapp)) return alertBox('WhatsApp inválido: use o formato (11) 98765-4321.', 'erroConsulta');
  const btn = $('btnConsultar'); btn.disabled = true; btn.textContent = 'Buscando...';
  try {
    const p = await consultar(codigo, whatsapp);
    store.set({ codigo: p.codigo, whatsapp: p.whatsapp });
    mostrarPedido(p);
  } catch (err) { alertBox(err.message, 'erroConsulta'); }
  btn.disabled = false; btn.textContent = 'BUSCAR PEDIDO';
});

// ----- Pedido pendente salvo neste aparelho -----
(async function verificarPendente() {
  const salvo = store.get();
  if (!salvo || !salvo.codigo) return;
  try {
    const p = await consultar(salvo.codigo, salvo.whatsapp);
    if (p.status !== 'Pendente' && p.status !== 'Comprovante enviado') { if (p.status !== 'Pago') store.clear(); return; }
    const b = $('bannerPendente');
    b.innerHTML = p.status === 'Pendente'
      ? `Você tem o pedido <b>${esc(p.codigo)}</b> aguardando pagamento.<button type="button">Pagar agora</button>`
      : `Pedido <b>${esc(p.codigo)}</b>: comprovante enviado, aguardando conferência.<button type="button">Ver pedido</button>`;
    b.classList.remove('hidden');
    b.querySelector('button').addEventListener('click', () => mostrarPedido(p));
  } catch (_) { /* pedido não encontrado: ignora */ }
})();
