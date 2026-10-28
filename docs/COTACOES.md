# Cotações automáticas

O botão **Atualizar cotações** da tela de Investimentos busca os preços assim:

1. **Edge Function `cotacoes` no Supabase** (`supabase/functions/cotacoes/index.ts`) — é o caminho
   usado no site do GitHub Pages, que não tem servidor.
2. **Rota `/api/cotacoes` do Next** — fallback ao rodar com `npm run dev`.

| Ativo | Provedor | Precisa de chave? |
|---|---|---|
| Ações, FIIs, ETFs, BDRs | brapi.dev | Sim (`BRAPI_TOKEN`, grátis) |
| BTC, ETH, SOL, USDT, ADA, XRP | CoinGecko | Não |
| Renda fixa | — (simulado: só aplica variação) | — |

Plano gratuito da brapi: 15 mil requisições/mês, 1 ticker por chamada e ~30 min de atraso. Por isso a
função consulta os ativos da B3 um de cada vez.

## Publicar a função (uma vez só)

### 1. Pegar o token da brapi
Crie uma conta em https://brapi.dev, entre no painel e copie seu token.

### 2. Guardar o token no Supabase
Supabase → seu projeto → **Edge Functions → Secrets** → *Add new secret*:
- Name: `BRAPI_TOKEN`
- Value: o token da brapi

### 3. Criar a função
**Pelo painel (sem instalar nada):** Supabase → **Edge Functions → Deploy a new function → Via
Editor**. Nome: `cotacoes`. Apague o código de exemplo, cole o conteúdo de
`supabase/functions/cotacoes/index.ts` e clique em **Deploy function**. Deixe ligada a opção
*Verify JWT* (só usuário logado consegue usar).

**Ou pela CLI:**
```bash
npx supabase login
npx supabase link --project-ref vkvghaejjxrivespyajo
npx supabase secrets set BRAPI_TOKEN=seu_token
npx supabase functions deploy cotacoes
```

### 4. Testar
Abra o app → Investimentos → **Atualizar cotações**. Se aparecer "vieram simuladas", o
`BRAPI_TOKEN` não foi encontrado pela função — confira o nome do secret.
