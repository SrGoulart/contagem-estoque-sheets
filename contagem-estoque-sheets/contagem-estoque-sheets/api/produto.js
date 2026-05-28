// api/produto.js
// Busca produto na planilha Google Sheets (leitura pública via CSV export)
// A planilha precisa estar com acesso "Qualquer pessoa com o link pode visualizar"

const SHEET_ID = process.env.SHEET_ID_PRODUTOS || '1mcZ9Mx3U0kIb8exWnTcxd4owYbMRUczeGYhbOE3eqwY';
const SHEET_NAME = encodeURIComponent('Página1'); // aba da planilha

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const q = (req.query.q || '').trim().toLowerCase();
  if (!q) return res.status(400).json({ error: 'Parâmetro q obrigatório' });

  try {
    // Busca via CSV público (sem autenticação necessária — planilha pública)
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${SHEET_NAME}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('Erro ao acessar planilha: ' + resp.status);

    const csv = await resp.text();
    const rows = parseCSV(csv);

    if (rows.length < 2) return res.status(404).json({ error: 'Planilha vazia' });

    // Cabeçalho: DataCaptura,COD_PRODUTO,REFERENCIA,SITUACAO,DESCRICAO_PRODUTO,
    //            UNIDADE_DE_MEDIDA,CodClasse,CLASSE_MATERIAL,LOCAL_PRODUTO,CUSTO,ESTOQUE_ATUAL,CUSTO_TOTAL
    const headers = rows[0].map(h => h.trim().toLowerCase());
    const idx = {
      cod:       headers.indexOf('cod_produto'),
      ref:       headers.indexOf('referencia'),
      sit:       headers.indexOf('situacao'),
      desc:      headers.indexOf('descricao_produto'),
      un:        headers.indexOf('unidade_de_medida'),
      codClasse: headers.indexOf('codclasse'),
      classe:    headers.indexOf('classe_material'),
      local:     headers.indexOf('local_produto'),
      custo:     headers.indexOf('custo'),
      estoque:   headers.indexOf('estoque_atual'),
    };

    // Busca com prioridade:
    // 1. Código exato  2. Código parcial  3. Referência exata  4. Referência parcial
    const data = rows.slice(1);
    const found =
      data.find(row => (row[idx.cod] || '').toLowerCase().trim() === q) ||
      data.find(row => (row[idx.cod] || '').toLowerCase().trim().includes(q)) ||
      data.find(row => (row[idx.ref] || '').toLowerCase().trim() === q) ||
      data.find(row => (row[idx.ref] || '').toLowerCase().trim().includes(q));

    if (!found) return res.status(404).json({ error: 'Produto não encontrado' });

    const produto = {
      codProduto:    found[idx.cod]?.trim(),
      referencia:    found[idx.ref]?.trim(),
      situacao:      found[idx.sit]?.trim(),
      descricao:     found[idx.desc]?.trim(),
      unidade:       found[idx.un]?.trim(),
      codClasse:     found[idx.codClasse]?.trim(),
      classeMaterial: found[idx.classe]?.trim(),
      local:         found[idx.local]?.trim(),
      custo:         parseBR(found[idx.custo]),
      estoqueAtual:  parseBR(found[idx.estoque]),
    };

    return res.status(200).json(produto);
  } catch (err) {
    console.error('[produto]', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// Parser CSV simples (suporta aspas e vírgulas dentro de campos)
function parseCSV(text) {
  const rows = [];
  const lines = text.split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    const cols = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQ && line[i+1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (c === ',' && !inQ) {
        cols.push(cur); cur = '';
      } else {
        cur += c;
      }
    }
    cols.push(cur);
    rows.push(cols);
  }
  return rows;
}

// Converte número no formato brasileiro "1.234,56" → float
function parseBR(v) {
  if (!v) return 0;
  const s = String(v).trim().replace(/['"]/g, '');
  // Remove pontos de milhar, substitui vírgula decimal
  return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
}
