# Segurança

## Situação atual

**Esta versão não tem autenticação.** É importante ser específico sobre o que isso significa:

- Não existe servidor de sessão, senha ou token. `lib/sessao.ts` grava um nome no `localStorage`.
- Todos os dados financeiros ficam em `localStorage`, em texto puro.
- O PIN de Configurações é uma barreira de interface. Ele controla o que o React renderiza; não
  cifra nada. `localStorage.getItem('financas-pro:v1')` no console devolve tudo.
- Qualquer script executado na página tem acesso total aos dados.

Isso é adequado para: demonstração, uso pessoal em máquina confiável, avaliação do produto.

Isso **não** é adequado para: dados de terceiros, uso em dispositivo compartilhado, qualquer contexto
com obrigação regulatória.

## O caminho para produção

### 1. Autenticação de verdade

Substitua `lib/sessao.ts` por [Auth.js](https://authjs.dev), [Clerk](https://clerk.com) ou
[Supabase Auth](https://supabase.com/docs/guides/auth). Proteja as rotas com middleware:

```ts
// src/middleware.ts
export const config = {
  matcher: ['/dashboard/:path*', '/financas/:path*', '/contas/:path*',
            '/cartoes/:path*', '/investimentos/:path*', '/dividas/:path*',
            '/metas/:path*', '/relatorios/:path*', '/configuracoes/:path*'],
};
```

Redirecionar no cliente não protege nada: o HTML já foi entregue.

### 2. Persistência no servidor

Os dados precisam sair do navegador. O modelo de `types/index.ts` mapeia quase diretamente para
tabelas relacionais. O ponto crítico é a autorização:

```sql
alter table transacoes enable row level security;

create policy "cada um vê o seu"
  on transacoes for all
  using (usuario_id = auth.uid());
```

Sem RLS (ou o equivalente na sua camada de acesso), qualquer usuário autenticado consegue ler os
dados de qualquer outro trocando um id na requisição. Essa é a falha mais comum em aplicações
multi-tenant.

### 3. Migração do store

As ações de `store/use-financas.ts` viram chamadas de rede. O contrato não muda — as funções de
`lib/` e todos os componentes continuam iguais. Vale usar TanStack Query ou os Server Actions do Next
para cache e revalidação.

Faça a migração pelas ações, não pelas telas: cada ação do store tem um endpoint correspondente.

### 4. Anexos

Hoje anexos viram data URLs dentro do estado persistido. Além de estourar a cota do `localStorage`
rápido, isso é inviável no servidor. Migre para object storage (S3, R2, Supabase Storage) com URLs
assinadas de vida curta e guarde só a referência.

### 5. Validação no servidor

`zod` já está nas dependências. Toda entrada precisa ser validada no servidor — validação de
formulário no cliente é experiência de uso, não controle de segurança.

### 6. Chaves de API

`BRAPI_TOKEN` já fica no servidor, lido apenas dentro de `/api/cotacoes`. **Nunca** mova para uma
variável `NEXT_PUBLIC_*`: esse prefixo embute o valor no bundle enviado ao navegador.

Falta adicionar rate limit na rota, para que sua chave não seja consumida por terceiros que
descubram o endpoint.

## Auditoria de dependências

```bash
npm audit --omit=dev
```

O projeto foi entregue com **zero vulnerabilidades**. Next.js e jspdf tiveram CVEs relevantes em
versões anteriores às fixadas no `package.json` — vale rodar a auditoria antes de cada deploy.

## Checklist antes do primeiro deploy com dados reais

- [ ] Autenticação real substituindo `lib/sessao.ts`
- [ ] Middleware protegendo as rotas do grupo `(app)`
- [ ] Dados em banco com autorização por linha
- [ ] Anexos em object storage
- [ ] Validação `zod` em todo endpoint
- [ ] Rate limit em `/api/cotacoes`
- [ ] HTTPS obrigatório e `Strict-Transport-Security`
- [ ] Content Security Policy
- [ ] `npm audit` limpo
- [ ] Política de retenção e exportação de dados definida (LGPD)
