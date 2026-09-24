// POST /api/entrada — marca/desmarca "Entrou" de um participante (portaria). Protegido por ADMIN_KEY.
import { airtable, TABELA_PARTICIPANTES } from './_airtable.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido.' });
  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  if (!process.env.ADMIN_KEY || b.chave !== process.env.ADMIN_KEY) return res.status(401).json({ erro: 'Chave de acesso inválida.' });
  if (!/^rec[A-Za-z0-9]{14}$/.test(String(b.id))) return res.status(400).json({ erro: 'Participante inválido.' });
  try {
    const entrou = b.entrou === true;
    const r = await airtable(`${TABELA_PARTICIPANTES}/${b.id}`, {
      method: 'PATCH',
      body: { fields: { 'Entrou': entrou, 'Entrada em': entrou ? new Date().toISOString() : null } }
    });
    return res.status(200).json({ id: r.id, entrou: !!r.fields['Entrou'], entradaEm: r.fields['Entrada em'] || null });
  } catch (err) {
    console.error('[entrada]', err);
    return res.status(500).json({ erro: err.message });
  }
}
