// POST /api/comprovante — anexa o comprovante ao pedido no Airtable e muda o status para "Comprovante enviado"
import { airtable, buscarPedido, resumoPedido, TABELA_PEDIDOS } from './_airtable.js';


const TIPOS = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_BYTES = 3 * 1024 * 1024;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido.' });
  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const rec = await buscarPedido(b.codigo, b.whatsapp);
    if (!rec) return res.status(404).json({ erro: 'Pedido não encontrado.' });
    const status = rec.fields['Status'];
    if (status === 'Expirado' || status === 'Cancelado') return res.status(400).json({ erro: `Este pedido está ${status.toLowerCase()}. Faça um novo pedido.` });
    if (status === 'Pago') return res.status(400).json({ erro: 'Este pedido já está confirmado como pago.' });

    const tipo = String(b.arquivo?.tipo || '');
    const dados = String(b.arquivo?.base64 || '');
    const bytes = Math.floor(dados.length * 3 / 4);
    if (!TIPOS.includes(tipo)) return res.status(400).json({ erro: 'Envie uma imagem (JPG/PNG) ou PDF do comprovante.' });
    if (!dados || bytes > MAX_BYTES) return res.status(400).json({ erro: 'Arquivo muito grande (máx. 3 MB).' });

    const ext = tipo === 'application/pdf' ? 'pdf' : tipo.split('/')[1].replace('jpeg', 'jpg');
    const codigo = rec.fields['Código'];

    // Upload direto para o campo de anexo (API de conteúdo do Airtable)
    const up = await fetch(`https://content.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${rec.id}/${encodeURIComponent('Comprovante')}/uploadAttachment`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentType: tipo, file: dados, filename: `comprovante-${codigo}.${ext}` })
    });
    if (!up.ok) throw new Error('upload ' + up.status + ' ' + (await up.text()).slice(0, 200));

    const atualizado = await airtable(`${TABELA_PEDIDOS}/${rec.id}`, {
      method: 'PATCH',
      body: { typecast: true, fields: { 'Status': 'Comprovante enviado', 'Comprovante enviado em': new Date().toISOString() } }
    });
    return res.status(200).json(resumoPedido(atualizado));
  } catch (err) {
    console.error('[comprovante]', err);
    return res.status(500).json({ erro: 'Não foi possível anexar o comprovante agora. Tente novamente.' });
  }
}
