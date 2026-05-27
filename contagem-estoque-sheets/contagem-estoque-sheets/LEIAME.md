# Contagem de Estoque — Versão 100% Google Sheets

## Como funciona
- **Busca produtos**: lê diretamente da sua planilha de cadastro (CSV público)
- **Registra contagens**: escreve na planilha de contagens via Service Account

## Variáveis de ambiente na Vercel

| Variável | Valor |
|---|---|
| `SHEET_ID_PRODUTOS` | `1mcZ9Mx3U0kIb8exWnTcxd4owYbMRUczeGYhbOE3eqwY` |
| `SHEET_ID_CONTAGEM` | `1SoBoFdFTaOxNEFK9YBEFCqqrrEBf30oikkYVug18UQA` |
| `SHEETS_KEY` | JSON completo da Service Account |

## Pré-requisito da planilha de produtos
A planilha de cadastro precisa estar com permissão:
**"Qualquer pessoa com o link pode visualizar"**
(sem isso a busca não funciona)

## Deploy
1. Faça upload deste projeto na Vercel
2. Configure as 3 variáveis de ambiente acima
3. Acesse o app e comece a contar!

## Estrutura
```
public/index.html   → app mobile (3 telas)
api/produto.js      → busca produto na planilha de cadastro
api/contagem.js     → grava contagem na planilha de registros
```
