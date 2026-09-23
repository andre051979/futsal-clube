// GET /api/lista?chave=... — pedidos e participantes para a lista impressa da portaria.
import { listarTodos, TABELA_PEDIDOS, TABELA_PARTICIPANTES } from './_airtable.js';

export default async function handler(req, res) {
  const chave = process.env.ADMIN_KEY;
  if (!chave || req.query.chave !== chave) return res.status(401).json({ erro: 'Chave de acesso inválida.' });
  res.setHeader('Cache-Control', 'no-store');
  try {
    const status = req.query.status === 'todos' ? null : 'Pago';
    const filtro = status ? [['filterByFormula', `{Status}='${status}'`]] : [];
    const pedidos = await listarTodos(TABELA_PEDIDOS, filtro);
    const ids = new Set(pedidos.map(p => p.id));
    const participantes = (await listarTodos(TABELA_PARTICIPANTES)).filter(p => (p.fields['Pedido'] || []).some(id => ids.has(id)));

    const porPedido = {};
    participantes.forEach(p => {
      const pid = p.fields['Pedido'][0];
      (porPedido[pid] ||= []).push({
        nome: p.fields['Nome completo'] || '',
        rg: p.fields['RG'] || '',
        faixa: p.fields['Faixa etária'] || '',
        titular: !!p.fields['Titular do pedido']
      });
    });

    const out = pedidos.map(p => ({
      codigo: p.fields['Código'],
      status: p.fields['Status'],
      tipo: p.fields['Tipo'],
      socioNumero: p.fields['Nº do sócio'] || '',
      socioNome: p.fields['Nome do sócio'] || '',
      socioValidado: p.fields['Sócio validado pelo clube'] || 'Não verificado',
      comprador: p.fields['Comprador'] || '',
      whatsapp: p.fields['WhatsApp'] || '',
      total: p.fields['Valor total'] || 0,
      pessoas: (porPedido[p.id] || []).sort((a, b) => (b.titular - a.titular) || a.nome.localeCompare(b.nome, 'pt-BR'))
    }));
    return res.status(200).json({ geradoEm: new Date().toISOString(), pedidos: out });
  } catch (err) {
    console.error('[lista]', err);
    return res.status(500).json({ erro: err.message });
  }
}
