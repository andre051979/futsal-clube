// /api/bolsas — controle de entrega das bolsas (tabela "Entrega de Bolsas"). Protegido por ADMIN_KEY.
// GET  ?chave=...                         -> lista
// POST {chave, id, entregue, retiradoPor} -> marca/desfaz entrega
import { airtable, listarTodos, limpar } from './_airtable.js';

const TABELA = 'Entrega de Bolsas';
const mapa = (r) => ({
  id: r.id,
  n: r.fields['Nº'] || 0,
  nome: r.fields['Nome'] || '',
  entregue: !!r.fields['Entregue'],
  entregueEm: r.fields['Entregue em'] || null,
  retiradoPor: r.fields['Retirado por'] || '',
  obs: r.fields['Observação'] || ''
});

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const b = req.method === 'POST' ? (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})) : {};
  const chave = req.method === 'POST' ? b.chave : req.query.chave;
  if (!process.env.ADMIN_KEY || chave !== process.env.ADMIN_KEY) return res.status(401).json({ erro: 'Senha inválida.' });
  try {
    if (req.method === 'GET') {
      const lista = (await listarTodos(TABELA)).map(mapa).sort((a, b) => a.n - b.n);
      return res.status(200).json({ bolsas: lista });
    }
    if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido.' });
    if (!/^rec[A-Za-z0-9]{14}$/.test(String(b.id))) return res.status(400).json({ erro: 'Registro inválido.' });
    const entregue = b.entregue === true;
    const r = await airtable(`${TABELA}/${b.id}`, {
      method: 'PATCH',
      body: { fields: {
        'Entregue': entregue,
        'Entregue em': entregue ? new Date().toISOString() : null,
        'Retirado por': entregue ? limpar(b.retiradoPor, 80) : ''
      } }
    });
    return res.status(200).json(mapa(r));
  } catch (err) {
    console.error('[bolsas]', err);
    return res.status(500).json({ erro: err.message });
  }
}
