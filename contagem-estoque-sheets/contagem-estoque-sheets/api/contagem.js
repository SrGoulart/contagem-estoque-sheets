const SHEET_ID     = process.env.SHEET_ID_CONTAGEM || '1SoBoFdFTaOxNEFK9YBEFCqqrrEBf30oikkYVug18UQA';
const CLIENT_EMAIL = process.env.CLIENT_EMAIL || 'estoque@scanner-estoque.iam.gserviceaccount.com';
const RAW_KEY      = process.env.PRIVATE_KEY || '';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    grupo, codigo, descricao, unidade,
    quantidade, valorUnitario,
    qtdContada, tipoContagem,
    operador, setor
  } = req.body;

  if (!codigo || qtdContada === undefined)
    return res.status(400).json({ error: 'Dados incompletos' });
  if (!RAW_KEY)
    return res.status(500).json({ error: 'PRIVATE_KEY não configurada' });

  const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  try {
    const token = await getToken(CLIENT_EMAIL, RAW_KEY);

    const check = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Contagem!A1:A1`,
      { headers: { Authorization: 'Bearer ' + token } }
    );
    const cd = await check.json();
    if (!cd.values) {
      await appendRows(token, [[
        'Data/Hora', 'Operador', 'Setor',
        'Grupo', 'Código', 'Descrição', 'Unidade',
        'Qtd. Sistema', 'Valor Unitário',
        'Qtd. Contada', 'Contagem'
      ]]);
    }

    await appendRows(token, [[
      agora, operador, setor,
      grupo, String(codigo), descricao, unidade,
      quantidade, valorUnitario,
      qtdContada, tipoContagem || 'Primeira Contagem'
    ]]);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[contagem]', err.message);
    return res.status(500).json({ error: err.message });
  }
}

async function appendRows(token, values) {
  const r = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Contagem!A1:append?valueInputOption=RAW`,
    {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values })
    }
  );
  if (!r.ok) {
    const t = await r.text();
    throw new Error('Sheets API erro ' + r.status + ': ' + t);
  }
}

function b64url(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
function b64urlBuf(buf) {
  let s = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
function pemToBytes(raw) {
  const cleaned = raw
    .replace(/\\n/g, '\n').replace(/\r/g, '')
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');
  const bin = atob(cleaned);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}
async function getToken(email, rawKey) {
  const now = Math.floor(Date.now() / 1000);
  const header  = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({
    iss: email, scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600
  }));
  const sigInput = header + '.' + payload;
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', pemToBytes(rawKey),
    { name: 'RSASSA-PKCS1-v1_5', hash: { name: 'SHA-256' } },
    false, ['sign']
  );
  const sigBuf = await crypto.subtle.sign({ name: 'RSASSA-PKCS1-v1_5' }, cryptoKey, new TextEncoder().encode(sigInput));
  const jwt = sigInput + '.' + b64urlBuf(sigBuf);
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt })
  });
  const d = await resp.json();
  if (!d.access_token) throw new Error('Token inválido: ' + JSON.stringify(d));
  return d.access_token;
}
