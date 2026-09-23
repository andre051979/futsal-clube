// POST /api/pedido — registra um pedido (Pendente) e seus participantes no Airtable
import { airtable, TABELA_PEDIDOS, TABELA_PARTICIPANTES, PRECOS, FAIXA_LABEL, limpar, normRG } from './_airtable.js';

const VENDAS_ATE = new Date(process.env.VENDAS_ATE || '2026-10-23T21:00:00-03:00');
const MAX_PESSOAS = 30;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ erro: 'Método não permitido.' });
  }
  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

    // Anti-robô (campo invisível preenchido)
    if (b.website) return res.status(400).json({ erro: 'Requisição inválida.' });
    if (new Date() > VENDAS_ATE) return res.status(400).json({ erro: 'As vendas pela página estão encerradas.' });

    // ---- Validação (nunca confiar no navegador) ----
    const tipo = b.tipo === 'socio' ? 'Sócio' : b.tipo === 'nao-socio' ? 'Não sócio' : null;
    const socioNumero = limpar(b.socioNumero, 20);
    const socioNome = limpar(b.socioNome);
    const compradorNome = limpar(b.compradorNome);
    const compradorRG = normRG(b.compradorRG);
    const whatsapp = limpar(b.whatsapp, 25);
    const erros = [];
    if (!tipo) erros.push('Tipo de compra inválido.');
    if (!socioNumero) erros.push('Número do sócio obrigatório.');
    if (socioNome.length < 3) erros.push('Nome do sócio obrigatório.');
    if (compradorNome.split(' ').length < 2) erros.push('Nome completo do comprador obrigatório.');
    if (compradorRG.replace(/[^0-9A-Z]/g, '').length < 5) erros.push('RG do comprador obrigatório.');
    if (whatsapp.replace(/\D/g, '').length < 10) erros.push('WhatsApp inválido.');
    if (b.lgpd !== true) erros.push('Consentimento LGPD obrigatório.');

    const pessoasIn = Array.isArray(b.pessoas) ? b.pessoas : [];
    if (pessoasIn.length === 0) erros.push('Cadastre ao menos uma pessoa.');
    if (pessoasIn.length > MAX_PESSOAS) erros.push(`Máximo de ${MAX_PESSOAS} pessoas por pedido.`);

    const pessoas = pessoasIn.slice(0, MAX_PESSOAS).map((p, i) => {
      const faixa = ['adulto', 'crianca6', 'crianca0'].includes(p?.faixa) ? p.faixa : null;
      const nome = limpar(p?.nome);
      const rg = normRG(p?.rg);
      if (!faixa) erros.push(`Pessoa ${i + 1}: faixa etária inválida.`);
      if (nome.split(' ').length < 2) erros.push(`Pessoa ${i + 1}: nome completo obrigatório.`);
      if (faixa !== 'crianca0' && rg.replace(/[^0-9A-Z]/g, '').length < 5) erros.push(`Pessoa ${i + 1}: RG obrigatório a partir de 6 anos.`);
      return { nome, rg, faixa, titular: p?.titular === true };
    });
    if (erros.length) return res.status(400).json({ erro: erros.slice(0, 4).join(' ') });

    const q = { adulto: 0, crianca6: 0, crianca0: 0 };
    pessoas.forEach(p => q[p.faixa]++);
    const total = q.adulto * PRECOS.adulto + q.crianca6 * PRECOS.crianca6;

    // ---- Grava o pedido (sempre Pendente) ----
    const pedido = await airtable(TABELA_PEDIDOS, {
      method: 'POST',
      body: {
        typecast: true,
        records: [{
          fields: {
            'Tipo': tipo,
            'Nº do sócio': socioNumero,
            'Nome do sócio': socioNome,
            'Comprador': compradorNome,
            'RG do comprador': compradorRG,
            'WhatsApp': whatsapp,
            'Adultos (12+)': q.adulto,
            'Crianças 6-11': q.crianca6,
            'Crianças 0-5': q.crianca0,
            'Valor total': total,
            'Status': 'Pendente',
            'Consentimento LGPD': true
          }
        }]
      }
    });
    const rec = pedido.records[0];

    // ---- Grava os participantes (lotes de 10) ----
    try {
      for (let i = 0; i < pessoas.length; i += 10) {
        await airtable(TABELA_PARTICIPANTES, {
          method: 'POST',
          body: {
            typecast: true,
            records: pessoas.slice(i, i + 10).map(p => ({
              fields: {
                'Nome completo': p.nome,
                'RG': p.rg,
                'Faixa etária': FAIXA_LABEL[p.faixa],
                'Valor': PRECOS[p.faixa],
                'Titular do pedido': p.titular,
                'Pedido': [rec.id]
              }
            }))
          }
        });
      }
    } catch (err) {
      // desfaz o pedido para não deixar pedido sem participantes
      await airtable(TABELA_PEDIDOS, { method: 'DELETE', query: [['records[]', rec.id]] }).catch(() => {});
      throw err;
    }

    // Código gerado por fórmula no Airtable (FUT-0001); relê para garantir
    let codigo = rec.fields['Código'];
    if (!codigo) {
      const again = await airtable(`${TABELA_PEDIDOS}/${rec.id}`);
      codigo = again.fields['Código'];
    }
    return res.status(200).json({ codigo, total });
  } catch (err) {
    console.error('[pedido]', err);
    return res.status(500).json({ erro: 'Não foi possível registrar o pedido agora. Tente novamente em instantes.' });
  }
}
