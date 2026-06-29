const SHEET_ID = process.env.SHEET_ID_PRODUTOS || '1mcZ9Mx3U0kIb8exWnTcxd4owYbMRUczeGYhbOE3eqwY';

export default async function handler(req, res) {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Parâmetro q obrigatório' });

  const query = q.trim().toLowerCase();

  try {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Estoque%20Atual`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('Erro ao buscar planilha: ' + resp.status);

    const text = await resp.text();
    const rows = parseCSV(text);

    if (rows.length < 2) return res.status(404).json({ error: 'Planilha vazia' });

    // Colunas: Grupo Almoxarifado, Código, Descrição, Unid., Quant., Valor Unitario
    const header = rows[0].map(h => h.toLowerCase().trim());
    const idx = {
      grupo:  header.findIndex(h => h.includes('grupo')),
      cod:    header.findIndex(h => h.includes('digo') || h === 'codigo'),
      desc:   header.findIndex(h => h.includes('descri')),
      unid:   header.findIndex(h => h.includes('unid')),
      quant:  header.findIndex(h => h.includes('quant')),
      valor:  header.findIndex(h => h.includes('valor')),
    };

    const data = rows.slice(1).filter(r => r.some(c => c.trim()));

    // Prioridade: código exato → código parcial → descrição contém
    const found =
      data.find(r => (r[idx.cod] || '').toLowerCase().trim() === query) ||
      data.find(r => (r[idx.cod] || '').toLowerCase().trim().includes(query)) ||
      data.find(r => (r[idx.desc] || '').toLowerCase().trim().includes(query));

    if (!found) return res.status(404).json({ error: 'Produto não encontrado' });

    return res.status(200).json({
      grupo:         found[idx.grupo] || '',
      codigo:        found[idx.cod]   || '',
      descricao:     found[idx.desc]  || '',
      unidade:       found[idx.unid]  || '',
      quantidade:    found[idx.quant] || '0',
      valorUnitario: found[idx.valor] || '',
    });

  } catch (err) {
    console.error('[produto]', err.message);
    return res.status(500).json({ error: err.message });
  }
}

function parseCSV(text) {
  const rows = [];
  let row = [], cell = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i+1] === '"') { cell += '"'; i++; }
      else if (c === '"') inQ = false;
      else cell += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else if (c !== '\r') cell += c;
    }
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
