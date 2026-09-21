-- ════════════════════════════════════════════════════════════════════════════
--  Finanças Pro — esquema inicial
--
--  Modelado a partir das entidades que existem em src/types/index.ts. Nada foi
--  acrescentado por conveniência: não há tabela de faturas, por exemplo, porque
--  fatura é derivada em tempo real por faturaDoCartao() a partir das transações.
--  Materializá-la duplicaria valores.
--
--  Decisões de tipo que importam:
--   · dinheiro é numeric(14,2) — float perderia centavo em soma;
--   · data de lançamento é `date` — timestamptz reintroduziria o bug de fuso
--     que o código evita de propósito em dataDe();
--   · ids são uuid porque o app já gera crypto.randomUUID(), o que permite
--     migrar o localStorage preservando as chaves e os relacionamentos.
--
--  Execute no SQL Editor do Supabase: este arquivo primeiro, 0002_rls.sql depois.
-- ════════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ───────────────────────────── utilitários ─────────────────────────────

-- Mantém atualizado_em correto sem depender de o cliente mandar o valor.
create or replace function public.tocar_atualizado_em()
returns trigger
language plpgsql
as $func$
begin
  new.atualizado_em = now();
  return new;
end;
$func$;

-- Deriva a competência ('YYYY-MM') da data do lançamento.
-- Roda em BEFORE, antes das constraints, então o NOT NULL e a unicidade já
-- enxergam o valor preenchido.
create or replace function public.definir_competencia()
returns trigger
language plpgsql
as $func$
begin
  new.competencia = to_char(new.data, 'YYYY-MM');
  return new;
end;
$func$;

-- ───────────────────────────── enumerações ─────────────────────────────
-- Espelham as union types do TypeScript. Enum em vez de check para que um valor
-- novo no app falhe alto no banco, em vez de gravar lixo silenciosamente.

create type public.tipo_transacao   as enum ('receita', 'despesa', 'transferencia');
create type public.status_transacao as enum ('pago', 'pendente', 'atrasado');
create type public.tipo_conta       as enum ('corrente', 'poupanca', 'carteira', 'investimento', 'digital');
create type public.tipo_cartao      as enum ('credito', 'debito', 'multiplo');
create type public.classe_ativo     as enum ('acao', 'fii', 'etf', 'bdr', 'renda-fixa', 'cripto');
create type public.periodicidade    as enum ('mensal', 'bimestral', 'trimestral', 'semestral', 'anual');
create type public.natureza_conta   as enum ('fixa', 'variavel');
create type public.status_divida    as enum ('ativa', 'negociando', 'quitada');
-- Categoria nunca é de transferência.
create type public.tipo_categoria   as enum ('receita', 'despesa');

-- ═══════════════════════════════ perfil ═══════════════════════════════
-- Um por usuário. A PK é o próprio id de auth.users: dispensa join e garante
-- unicidade sem constraint extra.

create table public.perfis (
  id                    uuid primary key references auth.users(id) on delete cascade,
  nome                  text        not null default '',
  email                 text        not null default '',
  moeda                 text        not null default 'BRL' check (moeda in ('BRL', 'USD', 'EUR')),
  inicio_mes_financeiro smallint    not null default 1 check (inicio_mes_financeiro between 1 and 28),
  ocultar_valores       boolean     not null default false,
  -- bloqueio_pin não existe aqui de propósito: é trava local de tela e seria um
  -- segredo em texto puro no banco. Continua apenas no dispositivo.
  criado_em             timestamptz not null default now(),
  atualizado_em         timestamptz not null default now()
);

-- ═══════════════════════════════ categorias ═══════════════════════════
-- Auto-relação de um nível (categoria-mãe). O app nunca aninha mais fundo.

create table public.categorias (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references auth.users(id) on delete cascade,
  nome          text not null check (length(trim(nome)) > 0),
  tipo          public.tipo_categoria not null,
  cor           text not null,
  icone         text not null,
  pai_id        uuid references public.categorias(id) on delete set null,
  orcamento     numeric(14,2) check (orcamento is null or orcamento > 0),
  arquivada     boolean not null default false,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint categoria_nao_e_mae_de_si check (pai_id is null or pai_id <> id)
);

create index categorias_usuario_idx on public.categorias (usuario_id);
create index categorias_pai_idx     on public.categorias (pai_id) where pai_id is not null;

-- ═══════════════════════════════ contas ═══════════════════════════════

create table public.contas (
  id                    uuid primary key default gen_random_uuid(),
  usuario_id            uuid not null references auth.users(id) on delete cascade,
  nome                  text not null check (length(trim(nome)) > 0),
  instituicao           text not null default '',
  -- Id do catálogo local de lib/bancos.ts. Texto livre de propósito: o catálogo
  -- evolui no código, não no banco.
  banco_id              text,
  tipo                  public.tipo_conta not null default 'corrente',
  saldo_inicial         numeric(14,2) not null default 0,
  cor                   text not null default '#171717',
  incluir_no_patrimonio boolean not null default true,
  arquivada             boolean not null default false,
  criado_em             timestamptz not null default now(),
  atualizado_em         timestamptz not null default now()
);

create index contas_usuario_idx on public.contas (usuario_id);

-- ═══════════════════════════════ cartões ══════════════════════════════

create table public.cartoes (
  id                 uuid primary key default gen_random_uuid(),
  usuario_id         uuid not null references auth.users(id) on delete cascade,
  nome               text not null check (length(trim(nome)) > 0),
  bandeira           text not null default 'Outra',
  banco_id           text,
  -- Só os 4 últimos dígitos. A constraint impede gravar o número inteiro.
  final              text check (final is null or final ~ '^[0-9]{4}$'),
  tipo               public.tipo_cartao not null default 'credito',
  limite             numeric(14,2) not null default 0 check (limite >= 0),
  dia_fechamento     smallint not null check (dia_fechamento between 1 and 31),
  dia_vencimento     smallint not null check (dia_vencimento between 1 and 31),
  cor                text not null default '#171717',
  -- set null espelha o store: apagar a conta não apaga o cartão.
  conta_pagamento_id uuid references public.contas(id) on delete set null,
  arquivado          boolean not null default false,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now()
);

create index cartoes_usuario_idx on public.cartoes (usuario_id);

-- ═══════════════════════════════ recorrências ═════════════════════════
-- Precede transacoes porque é referenciada por ela.

create table public.recorrencias (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid not null references auth.users(id) on delete cascade,
  nome           text not null check (length(trim(nome)) > 0),
  natureza       public.natureza_conta not null default 'fixa',
  tipo           public.tipo_categoria not null default 'despesa',
  valor_previsto numeric(14,2) not null check (valor_previsto >= 0),
  categoria_id   uuid references public.categorias(id) on delete set null,
  conta_id       uuid references public.contas(id) on delete set null,
  cartao_id      uuid references public.cartoes(id) on delete set null,
  dia_vencimento smallint not null check (dia_vencimento between 1 and 31),
  periodicidade  public.periodicidade not null default 'mensal',
  inicio_em      date not null,
  fim_em         date,
  lembrete_dias  smallint not null default 3 check (lembrete_dias between 0 and 30),
  ativa          boolean not null default true,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  constraint recorrencia_fim_depois_do_inicio check (fim_em is null or fim_em >= inicio_em)
);

create index recorrencias_usuario_idx on public.recorrencias (usuario_id);

-- ═══════════════════════════════ transações ═══════════════════════════
-- A tabela mais movimentada. Os índices existem porque o app filtra por
-- competência (resumoDoMes, serieAnual) e por cartão (faturaDoCartao).

create table public.transacoes (
  id               uuid primary key default gen_random_uuid(),
  usuario_id       uuid not null references auth.users(id) on delete cascade,
  tipo             public.tipo_transacao not null,
  descricao        text not null check (length(trim(descricao)) > 0),
  valor            numeric(14,2) not null check (valor > 0),
  -- `date` e não timestamptz: o app trabalha em YYYY-MM-DD sem fuso.
  data             date not null,
  categoria_id     uuid references public.categorias(id) on delete set null,
  conta_id         uuid references public.contas(id) on delete set null,
  conta_destino_id uuid references public.contas(id) on delete set null,
  cartao_id        uuid references public.cartoes(id) on delete set null,
  status           public.status_transacao not null default 'pago',
  observacao       text,
  etiquetas        text[] not null default '{}',
  recorrencia_id   uuid references public.recorrencias(id) on delete set null,
  -- Parcelamento achatado em colunas: os três andam juntos ou nenhum existe.
  parcela_numero   smallint check (parcela_numero is null or parcela_numero > 0),
  parcela_total    smallint check (parcela_total is null or parcela_total > 1),
  parcela_grupo_id uuid,
  -- Competência 'YYYY-MM' derivada da data, mantida pelo trigger
  -- `transacoes_competencia` logo abaixo.
  --
  -- Coluna real, e não expressão em índice, porque o PostgREST só sabe apontar
  -- `on conflict` para colunas — e é disso que depende a idempotência da
  -- geração de recorrências.
  --
  -- Preenchida por trigger e não por GENERATED ALWAYS porque coluna gerada
  -- exige expressão IMMUTABLE, e to_char(date, text) é apenas STABLE: o
  -- resultado depende de DateStyle e lc_time. Trigger não tem essa restrição.
  -- O NOT NULL é a rede de proteção: se o trigger for removido, o insert falha
  -- alto em vez de gravar competência vazia e quebrar a idempotência em
  -- silêncio.
  competencia      text not null,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now(),

  constraint parcela_completa_ou_ausente check (
    (parcela_numero is null and parcela_total is null and parcela_grupo_id is null)
    or (parcela_numero is not null and parcela_total is not null and parcela_grupo_id is not null)
  ),
  constraint parcela_dentro_do_total check (
    parcela_numero is null or parcela_numero <= parcela_total
  ),
  -- Só receita e despesa não têm destino. A recíproca NÃO é exigida de
  -- propósito: removeConta() zera o vínculo dos lançamentos em vez de apagá-los,
  -- então uma transferência órfã com destino nulo é estado válido do sistema.
  constraint destino_so_em_transferencia check (
    tipo = 'transferencia' or conta_destino_id is null
  ),
  -- Quando as duas pontas existem, precisam ser contas diferentes — é o que
  -- saldoDaConta pressupõe ao debitar de uma e creditar na outra.
  constraint transferencia_entre_contas_distintas check (
    conta_destino_id is null or conta_id is null or conta_destino_id <> conta_id
  ),
  -- Transferência não pertence a categoria nem a cartão.
  constraint transferencia_sem_categoria_nem_cartao check (
    tipo <> 'transferencia' or (categoria_id is null and cartao_id is null)
  )
  -- Não existe constraint exigindo conta ou cartão: lançamento órfão, sem
  -- nenhuma das duas, é o que sobra quando a pessoa exclui a conta e o
  -- histórico é preservado.
);

create index transacoes_usuario_data_idx  on public.transacoes (usuario_id, data desc);
create index transacoes_competencia_idx   on public.transacoes (usuario_id, competencia);
create index transacoes_cartao_idx        on public.transacoes (cartao_id, data) where cartao_id is not null;
create index transacoes_conta_idx         on public.transacoes (conta_id) where conta_id is not null;
create index transacoes_categoria_idx     on public.transacoes (categoria_id) where categoria_id is not null;
create index transacoes_grupo_parcela_idx on public.transacoes (parcela_grupo_id) where parcela_grupo_id is not null;

-- Sustenta a idempotência de gerarLancamentosDoMes: uma recorrência produz um
-- único lançamento por competência. A garantia fica no banco, não numa
-- checagem otimista do cliente.
-- Parcial (só quando há recorrência) não serve para `on conflict` do PostgREST,
-- que exige uma constraint real. Por isso é constraint sobre as duas colunas:
-- linhas com recorrencia_id nulo não conflitam entre si, porque em Postgres
-- NULL nunca é igual a NULL num índice único.
alter table public.transacoes
  add constraint transacoes_recorrencia_competencia_unica
  unique (recorrencia_id, competencia);

-- ═══════════════════════════════ anexos ═══════════════════════════════
-- O arquivo vai para o Storage; aqui ficam só o ponteiro e os metadados.
-- Data URL em base64 dentro da linha, como o localStorage fazia, estouraria o
-- payload rapidamente.

create table public.anexos (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references auth.users(id) on delete cascade,
  transacao_id  uuid not null references public.transacoes(id) on delete cascade,
  nome          text not null,
  tipo          text not null default '',
  tamanho       integer not null default 0 check (tamanho >= 0),
  -- Caminho dentro do bucket 'anexos'.
  caminho       text not null,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index anexos_transacao_idx on public.anexos (transacao_id);
create index anexos_usuario_idx   on public.anexos (usuario_id);

-- ═══════════════════════════════ assinaturas ══════════════════════════

create table public.assinaturas (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references auth.users(id) on delete cascade,
  nome          text not null check (length(trim(nome)) > 0),
  valor         numeric(14,2) not null check (valor >= 0),
  cartao_id     uuid references public.cartoes(id) on delete set null,
  categoria_id  uuid references public.categorias(id) on delete set null,
  dia_cobranca  smallint not null check (dia_cobranca between 1 and 31),
  periodicidade public.periodicidade not null default 'mensal',
  ativa         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index assinaturas_usuario_idx on public.assinaturas (usuario_id);

-- ═══════════════════════════════ ativos ═══════════════════════════════
-- Posição do usuário. A COTAÇÃO é externa e dinâmica (/api/cotacoes): aqui só
-- persiste o último preço conhecido, que é cache, não verdade de mercado.

create table public.ativos (
  id                    uuid primary key default gen_random_uuid(),
  usuario_id            uuid not null references auth.users(id) on delete cascade,
  ticker                text not null check (length(trim(ticker)) > 0),
  nome                  text not null default '',
  classe                public.classe_ativo not null,
  quantidade            numeric(20,8) not null check (quantidade >= 0),
  preco_medio           numeric(20,8) not null check (preco_medio >= 0),
  preco_atual           numeric(20,8) not null default 0 check (preco_atual >= 0),
  atualizado_cotacao_em timestamptz,
  dividend_yield        numeric(8,4),
  taxa                  text,
  vencimento            date,
  corretora             text,
  criado_em             timestamptz not null default now(),
  atualizado_em         timestamptz not null default now()
);

create index ativos_usuario_idx on public.ativos (usuario_id);
-- O mesmo ticker não deve aparecer duas vezes na carteira do mesmo usuário.
create unique index ativos_usuario_ticker_idx on public.ativos (usuario_id, upper(ticker));

-- ═══════════════════════════════ metas ════════════════════════════════

create table public.metas (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references auth.users(id) on delete cascade,
  nome          text not null check (length(trim(nome)) > 0),
  descricao     text,
  valor_alvo    numeric(14,2) not null check (valor_alvo > 0),
  valor_atual   numeric(14,2) not null default 0 check (valor_atual >= 0),
  prazo         date not null,
  cor           text not null default '#22C55E',
  icone         text not null default 'Target',
  conta_id      uuid references public.contas(id) on delete set null,
  concluida     boolean not null default false,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index metas_usuario_idx on public.metas (usuario_id);

-- ═══════════════════════════════ dívidas ══════════════════════════════

create table public.dividas (
  id                  uuid primary key default gen_random_uuid(),
  usuario_id          uuid not null references auth.users(id) on delete cascade,
  credor              text not null check (length(trim(credor)) > 0),
  descricao           text,
  valor_original      numeric(14,2) not null check (valor_original >= 0),
  saldo_atual         numeric(14,2) not null check (saldo_atual >= 0),
  -- Percentual ao mês (12.5 = 12,5%), não fração.
  juros_mes           numeric(8,4) not null default 0 check (juros_mes >= 0),
  valor_acordo        numeric(14,2) check (valor_acordo is null or valor_acordo >= 0),
  parcelas_restantes  smallint check (parcelas_restantes is null or parcelas_restantes >= 0),
  valor_parcela       numeric(14,2) check (valor_parcela is null or valor_parcela >= 0),
  negativado          boolean not null default false,
  orgao               text check (orgao is null or orgao in ('Serasa','SPC','Boa Vista','Cenprot','Nenhum')),
  vencimento_original date,
  status              public.status_divida not null default 'ativa',
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now()
);

create index dividas_usuario_idx on public.dividas (usuario_id);

-- Pagamentos saem de dentro da dívida e viram tabela própria.
create table public.pagamentos_divida (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references auth.users(id) on delete cascade,
  divida_id     uuid not null references public.dividas(id) on delete cascade,
  data          date not null,
  valor         numeric(14,2) not null check (valor > 0),
  observacao    text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index pagamentos_divida_idx  on public.pagamentos_divida (divida_id, data);
create index pagamentos_usuario_idx on public.pagamentos_divida (usuario_id);

-- ═══════════════════════ controle de recorrências ═════════════════════
-- Equivale ao array recorrenciasGeradas. Tabela em vez de coluna para que a
-- gravação seja um insert idempotente.

create table public.competencias_geradas (
  usuario_id  uuid not null references auth.users(id) on delete cascade,
  competencia text not null check (competencia ~ '^[0-9]{4}-[0-9]{2}$'),
  gerado_em   timestamptz not null default now(),
  primary key (usuario_id, competencia)
);

-- ═══════════════════════ controle de migração ═════════════════════════
-- Marca que o localStorage daquele usuário já foi importado. É o que torna a
-- migração idempotente: rodar de novo não duplica nada.

create table public.migracoes_local (
  usuario_id   uuid primary key references auth.users(id) on delete cascade,
  origem       text not null default 'localStorage',
  registros    integer not null default 0,
  concluida_em timestamptz not null default now()
);

-- ═══════════════════════════════ triggers ═════════════════════════════

do $bloco$
declare
  t text;
begin
  foreach t in array array[
    'perfis','categorias','contas','cartoes','recorrencias','transacoes',
    'anexos','assinaturas','ativos','metas','dividas','pagamentos_divida'
  ]
  loop
    execute format(
      'create trigger %I_atualizado_em before update on public.%I
       for each row execute function public.tocar_atualizado_em()',
      t, t
    );
  end loop;
end;
$bloco$;

-- Precisa ser BEFORE INSERT também, e não só update: a competência tem que
-- existir já na primeira gravação.
create trigger transacoes_competencia
  before insert or update on public.transacoes
  for each row execute function public.definir_competencia();

-- ═══════════════════ perfil automático no cadastro ════════════════════
-- Sem isto, um usuário recém-criado ficaria sem linha em perfis e a primeira
-- leitura do app voltaria vazia.

create or replace function public.criar_perfil_do_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
begin
  insert into public.perfis (id, nome, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', ''),
    coalesce(new.email, '')
  )
  on conflict (id) do nothing;
  return new;
end;
$func$;

create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil_do_usuario();
