// Utilitários de acesso ao Airtable (arquivos iniciados por "_" não viram rotas no Vercel)
const API = 'https://api.airtable.com/v0';

export const TABELA_PEDIDOS = process.env.AIRTABLE_TABLE_PEDIDOS || 'Pedidos';
export const TABELA_PARTICIPANTES = process.env.AIRTABLE_TABLE_PARTICIPANTES || 'Participantes';

export const PRECOS = { adulto: 75, crianca6: 45, crianca0: 0 };
export const FAIXA_LABEL = { adulto: 'Adulto (12+)', crianca6: 'Criança 6-11', crianca0: 'Criança 0-5' };

function cfg() {
  const token = process.env.AIRTABLE_TOKEN;
  const base = process.env.AIRTABLE_BASE_ID;
  if (!token || !base) throw new Error('Airtable não configurado (AIRTABLE_TOKEN / AIRTABLE_BASE_ID).');
  return { token, base };
}

export async function airtable(path, { method = 'GET', body, query } = {}) {
  const { token, base } = cfg();
  const qs = query ? '?' + new URLSearchParams(query).toString() : ''; // aceita objeto ou lista de pares
  const res = await fetch(`${API}/${base}/${path.split('/').map(encodeURIComponent).join('/')}${qs}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || data?.error?.type || res.statusText;
    throw new Error(`Airtable ${res.status}: ${msg}`);
  }
  return data;
}

// Lista todos os registros (com paginação)
// params: lista de pares [chave, valor] (permite repetir "fields[]")
export async function listarTodos(tabela, params = []) {
  const out = [];
  let offset;
  do {
    const query = [['pageSize', '100'], ...params];
    if (offset) query.push(['offset', offset]);
    const data = await airtable(tabela, { query });
    out.push(...data.records);
    offset = data.offset;
  } while (offset);
  return out;
}

// ---- WhatsApp: celular brasileiro com DDD válido, formato (XX) 9XXXX-XXXX ----
const DDDS = new Set([11,12,13,14,15,16,17,18,19,21,22,24,27,28,31,32,33,34,35,37,38,41,42,43,44,45,46,47,48,49,51,53,54,55,61,62,63,64,65,66,67,68,69,71,73,74,75,77,79,81,82,83,84,85,86,87,88,89,91,92,93,94,95,96,97,98,99]);
export function formatarWhats(s) {
  let d = String(s ?? '').replace(/\D/g, '');
  if (d.length === 13 && d.startsWith('55')) d = d.slice(2);
  if (d.length !== 11 || !DDDS.has(Number(d.slice(0, 2))) || d[2] !== '9') return null;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

// Busca um pedido pelo código e confere o WhatsApp (proteção contra consulta de pedidos alheios)
export async function buscarPedido(codigo, whatsapp) {
  const cod = String(codigo ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const m = cod.match(/^FUT(\d{1,6})$/);
  const tel = formatarWhats(whatsapp);
  if (!m || !tel) return null;
  const codigoFmt = 'FUT-' + m[1].padStart(4, '0');
  const r = await airtable(TABELA_PEDIDOS, { query: [['filterByFormula', `{Código}='${codigoFmt}'`], ['maxRecords', '1']] });
  const rec = r.records[0];
  if (!rec) return null;
  const telRec = formatarWhats(rec.fields['WhatsApp']) || rec.fields['WhatsApp'];
  if (telRec !== tel) return null;
  return rec;
}

export function resumoPedido(rec) {
  const f = rec.fields;
  return {
    codigo: f['Código'],
    status: f['Status'],
    total: f['Valor total'] || 0,
    comprador: f['Comprador'] || '',
    socioNumero: f['Nº do sócio'] || '',
    whatsapp: f['WhatsApp'] || '',
    pessoas: (f['Adultos (12+)'] || 0) + (f['Crianças 6-11'] || 0) + (f['Crianças 0-5'] || 0),
    adultos: f['Adultos (12+)'] || 0,
    criancas6: f['Crianças 6-11'] || 0,
    criancas0: f['Crianças 0-5'] || 0,
    expiraEm: f['Expira em'] || null,
    temComprovante: Array.isArray(f['Comprovante']) && f['Comprovante'].length > 0
  };
}

export const limpar =(s, max = 120) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
export const normRG = (s) => limpar(s, 30).toUpperCase();
