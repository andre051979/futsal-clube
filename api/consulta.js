// POST /api/consulta — recupera um pedido pelo código + WhatsApp (para pagar depois)
import { buscarPedido, resumoPedido } from './_airtable.js';
import { gerarPix } from './_pix.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido.' });
  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const rec = await buscarPedido(b.codigo, b.whatsapp);
    if (!rec) return res.status(404).json({ erro: 'Pedido não encontrado. Confira o código e o WhatsApp informados na compra.' });
    const resumo = resumoPedido(rec);
    const pix = resumo.status === 'Pendente' && resumo.total > 0 ? gerarPix(resumo.total, resumo.codigo) : null;
    return res.status(200).json({ ...resumo, pix });
  } catch (err) {
    console.error('[consulta]', err);
    return res.status(500).json({ erro: 'Não foi possível consultar agora. Tente novamente.' });
  }
}
