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

export const limpar = (s, max = 120) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
export const normRG = (s) => limpar(s, 30).toUpperCase();
