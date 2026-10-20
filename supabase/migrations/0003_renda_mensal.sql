-- ════════════════════════════════════════════════════════════════════════════
--  Finanças Pro — renda mensal no perfil
-- ════════════════════════════════════════════════════════════════════════════
--
-- Guarda a renda líquida mensal para calcular quanto dela já está comprometido
-- com contas fixas, variáveis, assinaturas e parcelas de dívida.
--
-- Fica em `perfis`, e não numa tabela própria, porque é um dado único por
-- usuário — uma tabela com no máximo uma linha por pessoa seria cerimônia sem
-- ganho. `perfis` já tem RLS por `id = auth.uid()`, então a coluna nasce
-- protegida pelas políticas existentes; não é preciso criar nenhuma.
--
-- Nulo é um estado com significado: "ainda não informei". Diferente de zero,
-- que significaria renda nenhuma. A interface usa essa diferença para pedir o
-- valor em vez de exibir 0% de comprometimento.

alter table public.perfis
  add column if not exists renda_mensal numeric(14, 2)
    check (renda_mensal is null or renda_mensal >= 0);

comment on column public.perfis.renda_mensal is
  'Renda líquida mensal em reais. Nulo = não informada pelo usuário.';
