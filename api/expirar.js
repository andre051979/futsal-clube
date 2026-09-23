// GET /api/expirar — executado 1x por dia pelo Vercel Cron.
// Muda para "Expirado" todo pedido "Pendente" criado há 5 dias (120 h) ou mais.
import { airtable, listarTodos, TABELA_PEDIDOS } from './_airtable.js';

const DIAS = Number(process.env.DIAS_EXPIRACAO || 5);

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ erro: 'Não autorizado.' });
  }
  try {
    const formula = `AND({Status}='Pendente', DATETIME_DIFF(NOW(), CREATED_TIME(), 'hours') >= ${DIAS * 24})`;
    const vencidos = await listarTodos(TABELA_PEDIDOS, [['filterByFormula', formula], ['fields[]', 'Código']]);
    for (let i = 0; i < vencidos.length; i += 10) {
      await airtable(TABELA_PEDIDOS, {
        method: 'PATCH',
        body: { records: vencidos.slice(i, i + 10).map(r => ({ id: r.id, fields: { 'Status': 'Expirado' } })) }
      });
    }
    return res.status(200).json({ expirados: vencidos.map(r => r.fields['Código']) });
  } catch (err) {
    console.error('[expirar]', err);
    return res.status(500).json({ erro: err.message });
  }
}
