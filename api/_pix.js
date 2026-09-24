// Geração de Pix "copia e cola" (BR Code estático, padrão EMV do Banco Central) + QR Code em SVG
import qrcode from 'qrcode-generator';

const CHAVE = process.env.PIX_CHAVE || '29502859880';
const NOME = process.env.PIX_NOME || 'RAFAEL FONTES FUJIKAKE';
const CIDADE = process.env.PIX_CIDADE || 'SAO PAULO';

const semAcento = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
const campo = (id, valor) => id + String(valor.length).padStart(2, '0') + valor;

function crc16(str) {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

// codigo: "FUT-0042" -> identificador "FUT0042" (o padrão só aceita letras e números)
export function gerarPix(valor, codigo) {
  const txid = String(codigo || '***').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';
  const payload =
    campo('00', '01') +
    campo('26', campo('00', 'br.gov.bcb.pix') + campo('01', CHAVE)) +
    campo('52', '0000') +
    campo('53', '986') +
    campo('54', Number(valor).toFixed(2)) +
    campo('58', 'BR') +
    campo('59', semAcento(NOME).slice(0, 25)) +
    campo('60', semAcento(CIDADE).slice(0, 15)) +
    campo('62', campo('05', txid)) +
    '6304';
  const copiaCola = payload + crc16(payload);

  const qr = qrcode(0, 'M');
  qr.addData(copiaCola);
  qr.make();
  const svg = qr.createSvgTag({ cellSize: 6, margin: 3, scalable: true });
  return { copiaCola, svg, chave: CHAVE, nome: NOME };
}
