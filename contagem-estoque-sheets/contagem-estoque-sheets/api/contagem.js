// api/contagem.js
// Grava contagem no Google Sheets via Service Account
const SHEET_ID   = process.env.SHEET_ID_CONTAGEM || '1SoBoFdFTaOxNEFK9YBEFCqqrrEBf30oikkYVug18UQA';
const SHEETS_KEY = process.env.SHEETS_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    codProduto, referencia, situacao, descricao, unidade,
    codClasse, classeMaterial, local, custo,
    estoqueAtual, qtdContada, diferenca,
    operador, setor
  } = req.body;

  if (!codProduto || qtdContada === undefined) {
    return res.status(400).json({ error: 'Dados incompletos' });
  }

  const agora  = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const status = diferenca === 0 ? 'OK' : diferenca > 0 ? 'EXCESSO' : 'FALTA';

  try {
    if (!SHEETS_KEY) throw new Error('SHEETS_KEY não configurada');

    const keyObj = JSON.parse(SHEETS_KEY);
    const token  = await getServiceAccountToken(keyObj);

    // Garante cabeçalho na primeira vez
    const check = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Contagem!A1:A1`,
      { headers: { Authorization: 'Bearer ' + token } }
    );
    const cd = await check.json();
    if (!cd.values) {
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Contagem!A1:append?valueInputOption=RAW`,
        {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: [[
            'Data/Hora', 'Operador', 'Setor',
            'Cod Produto', 'Referencia', 'Situacao', 'Descricao',
            'Unidade', 'Cod Classe', 'Classe Material', 'Local',
            'Custo Unit.', 'Estoque Sistema', 'Qtd Contada', 'Diferenca', 'Status'
          ]] })
        }
      );
    }

    const row = [
      agora, operador, setor,
      String(codProduto), referencia, situacao, descricao,
      unidade, String(codClasse || ''), classeMaterial, local,
      custo, estoqueAtual, qtdContada, diferenca, status
    ];

    const r = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Contagem!A1:append?valueInputOption=RAW`,
      {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [row] })
      }
    );

    if (!r.ok) throw new Error('Sheets API erro: ' + r.status);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[contagem]', err.message);
    return res.status(500).json({ error: err.message });
  }
}

async function getServiceAccountToken(key) {
  const now   = Math.floor(Date.now() / 1000);
  const claim = {
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600, iat: now
  };
  const header  = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify(claim));
  const msg     = header + '.' + payload;
  const keyData = key.private_key.replace(/\\n/g, '\n');
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', pemToBuf(keyData),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(msg));
  const jwt = msg + '.' + btoa(String.fromCharCode(...new Uint8Array(sig)));
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`
  });
  const d = await resp.json();
  return d.access_token;
}

function pemToBuf(pem) {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}
