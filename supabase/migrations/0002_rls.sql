-- ════════════════════════════════════════════════════════════════════════════
--  Finanças Pro — Row Level Security
--
--  Por que isto é crítico neste projeto em particular:
--  o front é um site estático no GitHub Pages. Não há proxy, não há sessão de
--  servidor, não há rota protegida por middleware. A guarda de rota no cliente
--  é conforto de navegação, não segurança — qualquer pessoa pode abrir o
--  console e chamar a API com a anon key, que é pública por definição.
--
--  Portanto o RLS abaixo NÃO é defesa em profundidade. É a única defesa.
--
--  Regra única em todas as tabelas: a linha pertence a auth.uid().
--  O USING controla o que pode ser lido/alterado; o WITH CHECK controla o que
--  pode ser gravado — sem ele, alguém poderia atualizar a própria linha
--  passando usuario_id de outra pessoa.
--
--  Execute depois de 0001_schema.sql.
-- ════════════════════════════════════════════════════════════════════════════

-- ─────────────────── liga o RLS em tudo que tem dado do usuário ──────────────
-- force garante que nem o dono da tabela escape das policies.

alter table public.perfis               enable row level security;
alter table public.categorias           enable row level security;
alter table public.contas               enable row level security;
alter table public.cartoes              enable row level security;
alter table public.recorrencias         enable row level security;
alter table public.transacoes           enable row level security;
alter table public.anexos               enable row level security;
alter table public.assinaturas          enable row level security;
alter table public.ativos               enable row level security;
alter table public.metas                enable row level security;
alter table public.dividas              enable row level security;
alter table public.pagamentos_divida    enable row level security;
alter table public.competencias_geradas enable row level security;
alter table public.migracoes_local      enable row level security;

-- ═══════════════════════════════ perfis ═══════════════════════════════
-- A PK é o próprio id do usuário, então a comparação é com id, não usuario_id.
-- Não há policy de INSERT: quem cria a linha é o trigger ao_criar_usuario,
-- que roda como security definer. Nem há DELETE — o perfil morre junto com a
-- conta, via on delete cascade.

create policy "perfil: ler o próprio"
  on public.perfis for select
  using (auth.uid() = id);

create policy "perfil: atualizar o próprio"
  on public.perfis for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ══════════════ tabelas com usuario_id: as quatro operações ═══════════
-- O bloco abaixo gera SELECT/INSERT/UPDATE/DELETE idênticos para cada tabela.
-- Escrever à mão 4 policies × 12 tabelas convida a esquecer uma — e uma tabela
-- financeira sem policy é um vazamento silencioso.

do $bloco$
declare
  t text;
begin
  foreach t in array array[
    'categorias', 'contas', 'cartoes', 'recorrencias', 'transacoes', 'anexos',
    'assinaturas', 'ativos', 'metas', 'dividas', 'pagamentos_divida',
    'competencias_geradas'
  ]
  loop
    execute format(
      'create policy %I on public.%I for select using (auth.uid() = usuario_id)',
      t || ': ler os próprios', t
    );

    -- Só WITH CHECK: INSERT não tem linha anterior para o USING avaliar.
    execute format(
      'create policy %I on public.%I for insert with check (auth.uid() = usuario_id)',
      t || ': criar como dono', t
    );

    -- Os dois juntos: USING diz quais linhas podem ser alvo, WITH CHECK impede
    -- que a atualização mude o dono da linha para outra pessoa.
    execute format(
      'create policy %I on public.%I for update using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id)',
      t || ': atualizar os próprios', t
    );

    execute format(
      'create policy %I on public.%I for delete using (auth.uid() = usuario_id)',
      t || ': excluir os próprios', t
    );
  end loop;
end;
$bloco$;

-- ═══════════════════════════ migracoes_local ══════════════════════════
-- Sem UPDATE e sem DELETE de propósito: a marca de "migração concluída" não
-- deve poder ser apagada pelo cliente, senão a importação roda de novo e
-- duplica os dados.

create policy "migração: ler a própria"
  on public.migracoes_local for select
  using (auth.uid() = usuario_id);

create policy "migração: registrar a própria"
  on public.migracoes_local for insert
  with check (auth.uid() = usuario_id);

-- ═══════════════════════ verificação de cobertura ═════════════════════
-- Falha alto se alguma tabela de public ficar sem RLS ou sem policy. É barato
-- e evita o pior erro possível aqui: achar que está protegido e não estar.

do $bloco$
declare
  descoberta text;
begin
  select string_agg(c.relname, ', ')
    into descoberta
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and (
      c.relrowsecurity = false
      or not exists (select 1 from pg_policy p where p.polrelid = c.oid)
    );

  if descoberta is not null then
    raise exception 'Tabelas sem RLS ou sem policy: %', descoberta;
  end if;

  raise notice 'RLS conferido: todas as tabelas de public estão protegidas.';
end;
$bloco$;

-- ═══════════════════════════ Storage: anexos ══════════════════════════
-- Bucket privado. O caminho de cada arquivo começa com o id do usuário, e as
-- policies exigem que o primeiro segmento do caminho seja o próprio uid —
-- é o que impede alguém de ler o comprovante de outra pessoa.
--
-- Caminho esperado:  {usuario_id}/{transacao_id}/{arquivo}

insert into storage.buckets (id, name, public)
values ('anexos', 'anexos', false)
on conflict (id) do nothing;

create policy "anexos: ler os próprios"
  on storage.objects for select
  using (
    bucket_id = 'anexos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "anexos: enviar os próprios"
  on storage.objects for insert
  with check (
    bucket_id = 'anexos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "anexos: substituir os próprios"
  on storage.objects for update
  using (
    bucket_id = 'anexos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "anexos: excluir os próprios"
  on storage.objects for delete
  using (
    bucket_id = 'anexos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
