# Festa do Futsal 2026 — página de ingressos

- `index.html` — página do evento + compra (janela sobreposta: sócio / não sócio → cadastro nominal → código FUT-XXXX → Pix)
- `portaria.html` — lista imprimível (somente pagos), agrupada por sócio, com coluna "Entrou" e folha de conferência de sócios para o clube
- `api/pedido.js` — grava Pedido (sempre **Pendente**) + Participantes no Airtable; recalcula preços no servidor
- `api/expirar.js` — Vercel Cron diário (06h de Brasília): Pendente há 5 dias ou mais → **Expirado**
- `api/lista.js` — dados da lista da portaria (protegido por ADMIN_KEY)

## Variáveis de ambiente (Vercel)
| Nome | Valor |
|---|---|
| AIRTABLE_TOKEN | token pessoal do Airtable (data.records:read/write) |
| AIRTABLE_BASE_ID | id da base (appXXXXXXXXXXXXXX) |
| ADMIN_KEY | senha da página /portaria.html |
| CRON_SECRET | segredo do cron (opcional, recomendado) |

## Airtable — tabelas
**Pedidos**: Nº (autonumber) · Código (fórmula `"FUT-" & RIGHT("0000" & {Nº}, 4)`) · Tipo (Sócio/Não sócio) · Nº do sócio · Nome do sócio · Comprador · RG do comprador · WhatsApp · Adultos (12+) · Crianças 6-11 · Crianças 0-5 · Valor total (R$) · Status (Pendente/Pago/Expirado/Cancelado) · Criado em · Pago em · Consentimento LGPD · Sócio validado pelo clube (Não verificado/Válido/Inválido) · Participantes (link) · Observações

**Participantes**: Nome completo · RG · Faixa etária (Adulto (12+)/Criança 6-11/Criança 0-5) · Valor · Titular do pedido · Pedido (link) · Entrou
