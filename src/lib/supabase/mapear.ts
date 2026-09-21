/**
 * Tradução entre o formato do banco e o modelo de domínio.
 *
 * O Postgres usa snake_case; o domínio em src/types usa camelCase. A conversão
 * fica concentrada aqui para que nenhum componente precise saber o nome de
 * coluna — e para que renomear uma coluna seja uma mudança de um arquivo só.
 *
 * Duas regras que este arquivo existe para garantir:
 *
 * 1. DINHEIRO volta como `number`. O driver do Postgres entrega `numeric` como
 *    string para não perder precisão em bigint; se isso vazasse para o domínio,
 *    `a + b` viraria concatenação e todo cálculo de `financas.ts` quebraria em
 *    silêncio. `num()` converte na fronteira.
 *
 * 2. DATA volta como 'YYYY-MM-DD' puro. Nunca `new Date()`, nunca ISO com fuso:
 *    o app monta datas locais de propósito para não "pular um dia", e um
 *    timestamptz aqui reintroduziria exatamente esse bug.
 */

import type {
  Assinatura, Ativo, Cartao, Categoria, Conta, Divida,
  Meta, PagamentoDivida, Perfil, Recorrencia, Transacao,
} from '@/types';

/* ────────────────────────── conversores de campo ────────────────────────── */

/** `numeric` chega como string do driver. Traz de volta para number. */
export function num(valor: unknown): number {
  if (typeof valor === 'number') return valor;
  if (valor === null || valor === undefined || valor === '') return 0;
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

/** Igual a `num`, mas preserva a ausência — para campos opcionais. */
function numOuUndef(valor: unknown): number | undefined {
  if (valor === null || valor === undefined || valor === '') return undefined;
  const n = Number(valor);
  return Number.isFinite(n) ? n : undefined;
}

/** Corta um `date` ou `timestamptz` para 'YYYY-MM-DD', sem passar por Date. */
export function data(valor: unknown): string {
  if (typeof valor !== 'string') return '';
  return valor.slice(0, 10);
}

function dataOuNulo(valor: unknown): string | undefined {
  const d = data(valor);
  return d || undefined;
}

type Linha = Record<string, unknown>;

/* ─────────────────────────────── Perfil ─────────────────────────────── */

export function perfilDeLinha(l: Linha, bloqueioPin: string | null = null): Perfil {
  return {
    nome: (l.nome as string) ?? '',
    email: (l.email as string) ?? '',
    moeda: ((l.moeda as string) ?? 'BRL') as Perfil['moeda'],
    inicioMesFinanceiro: num(l.inicio_mes_financeiro) || 1,
    ocultarValores: Boolean(l.ocultar_valores),
    // O PIN nunca sai do dispositivo — não existe coluna para ele no banco.
    bloqueioPin,
  };
}

export function perfilParaLinha(p: Partial<Perfil>): Linha {
  const l: Linha = {};
  if (p.nome !== undefined) l.nome = p.nome;
  if (p.email !== undefined) l.email = p.email;
  if (p.moeda !== undefined) l.moeda = p.moeda;
  if (p.inicioMesFinanceiro !== undefined) l.inicio_mes_financeiro = p.inicioMesFinanceiro;
  if (p.ocultarValores !== undefined) l.ocultar_valores = p.ocultarValores;
  return l;
}

/* ───────────────────────────── Categoria ───────────────────────────── */

export function categoriaDeLinha(l: Linha): Categoria {
  return {
    id: l.id as string,
    nome: l.nome as string,
    tipo: l.tipo as Categoria['tipo'],
    cor: l.cor as string,
    icone: l.icone as string,
    paiId: (l.pai_id as string) ?? null,
    orcamento: numOuUndef(l.orcamento),
    arquivada: Boolean(l.arquivada),
  };
}

export function categoriaParaLinha(c: Partial<Categoria>): Linha {
  const l: Linha = {};
  if (c.id !== undefined) l.id = c.id;
  if (c.nome !== undefined) l.nome = c.nome;
  if (c.tipo !== undefined) l.tipo = c.tipo;
  if (c.cor !== undefined) l.cor = c.cor;
  if (c.icone !== undefined) l.icone = c.icone;
  if (c.paiId !== undefined) l.pai_id = c.paiId;
  if (c.orcamento !== undefined) l.orcamento = c.orcamento || null;
  if (c.arquivada !== undefined) l.arquivada = c.arquivada;
  return l;
}

/* ─────────────────────────────── Conta ─────────────────────────────── */

export function contaDeLinha(l: Linha): Conta {
  return {
    id: l.id as string,
    nome: l.nome as string,
    instituicao: (l.instituicao as string) ?? '',
    bancoId: (l.banco_id as string) ?? null,
    tipo: l.tipo as Conta['tipo'],
    saldoInicial: num(l.saldo_inicial),
    cor: l.cor as string,
    incluirNoPatrimonio: Boolean(l.incluir_no_patrimonio),
    arquivada: Boolean(l.arquivada),
    criadoEm: data(l.criado_em),
  };
}

export function contaParaLinha(c: Partial<Conta>): Linha {
  const l: Linha = {};
  if (c.id !== undefined) l.id = c.id;
  if (c.nome !== undefined) l.nome = c.nome;
  if (c.instituicao !== undefined) l.instituicao = c.instituicao;
  if (c.bancoId !== undefined) l.banco_id = c.bancoId;
  if (c.tipo !== undefined) l.tipo = c.tipo;
  if (c.saldoInicial !== undefined) l.saldo_inicial = c.saldoInicial;
  if (c.cor !== undefined) l.cor = c.cor;
  if (c.incluirNoPatrimonio !== undefined) l.incluir_no_patrimonio = c.incluirNoPatrimonio;
  if (c.arquivada !== undefined) l.arquivada = c.arquivada;
  return l;
}

/* ─────────────────────────────── Cartao ────────────────────────────── */

export function cartaoDeLinha(l: Linha): Cartao {
  return {
    id: l.id as string,
    nome: l.nome as string,
    bandeira: (l.bandeira as string) ?? 'Outra',
    bancoId: (l.banco_id as string) ?? null,
    final: (l.final as string) ?? undefined,
    tipo: l.tipo as Cartao['tipo'],
    limite: num(l.limite),
    diaFechamento: num(l.dia_fechamento),
    diaVencimento: num(l.dia_vencimento),
    cor: l.cor as string,
    contaPagamentoId: (l.conta_pagamento_id as string) ?? null,
    arquivado: Boolean(l.arquivado),
    criadoEm: data(l.criado_em),
  };
}

export function cartaoParaLinha(c: Partial<Cartao>): Linha {
  const l: Linha = {};
  if (c.id !== undefined) l.id = c.id;
  if (c.nome !== undefined) l.nome = c.nome;
  if (c.bandeira !== undefined) l.bandeira = c.bandeira;
  if (c.bancoId !== undefined) l.banco_id = c.bancoId;
  if (c.final !== undefined) l.final = c.final || null;
  if (c.tipo !== undefined) l.tipo = c.tipo;
  if (c.limite !== undefined) l.limite = c.limite;
  if (c.diaFechamento !== undefined) l.dia_fechamento = c.diaFechamento;
  if (c.diaVencimento !== undefined) l.dia_vencimento = c.diaVencimento;
  if (c.cor !== undefined) l.cor = c.cor;
  if (c.contaPagamentoId !== undefined) l.conta_pagamento_id = c.contaPagamentoId;
  if (c.arquivado !== undefined) l.arquivado = c.arquivado;
  return l;
}

/* ───────────────────────────── Transacao ───────────────────────────── */

export function transacaoDeLinha(l: Linha): Transacao {
  const numero = l.parcela_numero as number | null;
  const total = l.parcela_total as number | null;
  const grupo = l.parcela_grupo_id as string | null;

  return {
    id: l.id as string,
    tipo: l.tipo as Transacao['tipo'],
    descricao: l.descricao as string,
    valor: num(l.valor),
    data: data(l.data),
    categoriaId: (l.categoria_id as string) ?? null,
    contaId: (l.conta_id as string) ?? null,
    contaDestinoId: (l.conta_destino_id as string) ?? null,
    cartaoId: (l.cartao_id as string) ?? null,
    status: l.status as Transacao['status'],
    observacao: (l.observacao as string) ?? undefined,
    etiquetas: (l.etiquetas as string[]) ?? [],
    // Anexos são carregados à parte: vivem em outra tabela e no Storage.
    anexos: [],
    recorrenciaId: (l.recorrencia_id as string) ?? null,
    parcela:
      numero && total && grupo ? { numero, total, grupoId: grupo } : undefined,
    criadoEm: data(l.criado_em),
  };
}

export function transacaoParaLinha(t: Partial<Transacao>): Linha {
  const l: Linha = {};
  if (t.id !== undefined) l.id = t.id;
  if (t.tipo !== undefined) l.tipo = t.tipo;
  if (t.descricao !== undefined) l.descricao = t.descricao;
  if (t.valor !== undefined) l.valor = t.valor;
  if (t.data !== undefined) l.data = t.data;
  if (t.categoriaId !== undefined) l.categoria_id = t.categoriaId;
  if (t.contaId !== undefined) l.conta_id = t.contaId;
  if (t.contaDestinoId !== undefined) l.conta_destino_id = t.contaDestinoId;
  if (t.cartaoId !== undefined) l.cartao_id = t.cartaoId;
  if (t.status !== undefined) l.status = t.status;
  if (t.observacao !== undefined) l.observacao = t.observacao ?? null;
  if (t.etiquetas !== undefined) l.etiquetas = t.etiquetas;
  if (t.recorrenciaId !== undefined) l.recorrencia_id = t.recorrenciaId;
  if (t.parcela !== undefined) {
    l.parcela_numero = t.parcela?.numero ?? null;
    l.parcela_total = t.parcela?.total ?? null;
    l.parcela_grupo_id = t.parcela?.grupoId ?? null;
  }
  return l;
}

/* ──────────────────────────── Recorrencia ──────────────────────────── */

export function recorrenciaDeLinha(l: Linha): Recorrencia {
  return {
    id: l.id as string,
    nome: l.nome as string,
    natureza: l.natureza as Recorrencia['natureza'],
    tipo: l.tipo as Recorrencia['tipo'],
    valorPrevisto: num(l.valor_previsto),
    categoriaId: (l.categoria_id as string) ?? null,
    contaId: (l.conta_id as string) ?? null,
    cartaoId: (l.cartao_id as string) ?? null,
    diaVencimento: num(l.dia_vencimento),
    periodicidade: l.periodicidade as Recorrencia['periodicidade'],
    inicioEm: data(l.inicio_em),
    fimEm: dataOuNulo(l.fim_em) ?? null,
    lembreteDias: num(l.lembrete_dias),
    ativa: Boolean(l.ativa),
    criadoEm: data(l.criado_em),
  };
}

export function recorrenciaParaLinha(r: Partial<Recorrencia>): Linha {
  const l: Linha = {};
  if (r.id !== undefined) l.id = r.id;
  if (r.nome !== undefined) l.nome = r.nome;
  if (r.natureza !== undefined) l.natureza = r.natureza;
  if (r.tipo !== undefined) l.tipo = r.tipo;
  if (r.valorPrevisto !== undefined) l.valor_previsto = r.valorPrevisto;
  if (r.categoriaId !== undefined) l.categoria_id = r.categoriaId;
  if (r.contaId !== undefined) l.conta_id = r.contaId;
  if (r.cartaoId !== undefined) l.cartao_id = r.cartaoId;
  if (r.diaVencimento !== undefined) l.dia_vencimento = r.diaVencimento;
  if (r.periodicidade !== undefined) l.periodicidade = r.periodicidade;
  if (r.inicioEm !== undefined) l.inicio_em = r.inicioEm;
  if (r.fimEm !== undefined) l.fim_em = r.fimEm || null;
  if (r.lembreteDias !== undefined) l.lembrete_dias = r.lembreteDias;
  if (r.ativa !== undefined) l.ativa = r.ativa;
  return l;
}

/* ───────────────────────────── Assinatura ──────────────────────────── */

export function assinaturaDeLinha(l: Linha): Assinatura {
  return {
    id: l.id as string,
    nome: l.nome as string,
    valor: num(l.valor),
    cartaoId: (l.cartao_id as string) ?? null,
    categoriaId: (l.categoria_id as string) ?? null,
    diaCobranca: num(l.dia_cobranca),
    periodicidade: l.periodicidade as Assinatura['periodicidade'],
    ativa: Boolean(l.ativa),
    criadoEm: data(l.criado_em),
  };
}

export function assinaturaParaLinha(a: Partial<Assinatura>): Linha {
  const l: Linha = {};
  if (a.id !== undefined) l.id = a.id;
  if (a.nome !== undefined) l.nome = a.nome;
  if (a.valor !== undefined) l.valor = a.valor;
  if (a.cartaoId !== undefined) l.cartao_id = a.cartaoId;
  if (a.categoriaId !== undefined) l.categoria_id = a.categoriaId;
  if (a.diaCobranca !== undefined) l.dia_cobranca = a.diaCobranca;
  if (a.periodicidade !== undefined) l.periodicidade = a.periodicidade;
  if (a.ativa !== undefined) l.ativa = a.ativa;
  return l;
}

/* ─────────────────────────────── Ativo ─────────────────────────────── */

export function ativoDeLinha(l: Linha): Ativo {
  return {
    id: l.id as string,
    ticker: l.ticker as string,
    nome: (l.nome as string) ?? '',
    classe: l.classe as Ativo['classe'],
    quantidade: num(l.quantidade),
    precoMedio: num(l.preco_medio),
    precoAtual: num(l.preco_atual),
    atualizadoEm: (l.atualizado_cotacao_em as string) ?? undefined,
    dividendYield: numOuUndef(l.dividend_yield),
    taxa: (l.taxa as string) ?? undefined,
    vencimento: dataOuNulo(l.vencimento),
    corretora: (l.corretora as string) ?? undefined,
    criadoEm: data(l.criado_em),
  };
}

export function ativoParaLinha(a: Partial<Ativo>): Linha {
  const l: Linha = {};
  if (a.id !== undefined) l.id = a.id;
  if (a.ticker !== undefined) l.ticker = a.ticker;
  if (a.nome !== undefined) l.nome = a.nome;
  if (a.classe !== undefined) l.classe = a.classe;
  if (a.quantidade !== undefined) l.quantidade = a.quantidade;
  if (a.precoMedio !== undefined) l.preco_medio = a.precoMedio;
  if (a.precoAtual !== undefined) l.preco_atual = a.precoAtual;
  if (a.atualizadoEm !== undefined) l.atualizado_cotacao_em = a.atualizadoEm ?? null;
  if (a.dividendYield !== undefined) l.dividend_yield = a.dividendYield ?? null;
  if (a.taxa !== undefined) l.taxa = a.taxa ?? null;
  if (a.vencimento !== undefined) l.vencimento = a.vencimento || null;
  if (a.corretora !== undefined) l.corretora = a.corretora ?? null;
  return l;
}

/* ─────────────────────────────── Meta ──────────────────────────────── */

export function metaDeLinha(l: Linha): Meta {
  return {
    id: l.id as string,
    nome: l.nome as string,
    descricao: (l.descricao as string) ?? undefined,
    valorAlvo: num(l.valor_alvo),
    valorAtual: num(l.valor_atual),
    prazo: data(l.prazo),
    cor: l.cor as string,
    icone: l.icone as string,
    contaId: (l.conta_id as string) ?? null,
    concluida: Boolean(l.concluida),
    criadoEm: data(l.criado_em),
  };
}

export function metaParaLinha(m: Partial<Meta>): Linha {
  const l: Linha = {};
  if (m.id !== undefined) l.id = m.id;
  if (m.nome !== undefined) l.nome = m.nome;
  if (m.descricao !== undefined) l.descricao = m.descricao ?? null;
  if (m.valorAlvo !== undefined) l.valor_alvo = m.valorAlvo;
  if (m.valorAtual !== undefined) l.valor_atual = m.valorAtual;
  if (m.prazo !== undefined) l.prazo = m.prazo;
  if (m.cor !== undefined) l.cor = m.cor;
  if (m.icone !== undefined) l.icone = m.icone;
  if (m.contaId !== undefined) l.conta_id = m.contaId;
  if (m.concluida !== undefined) l.concluida = m.concluida;
  return l;
}

/* ─────────────────────────────── Divida ────────────────────────────── */

export function pagamentoDeLinha(l: Linha): PagamentoDivida {
  return {
    id: l.id as string,
    data: data(l.data),
    valor: num(l.valor),
    observacao: (l.observacao as string) ?? undefined,
  };
}

export function dividaDeLinha(l: Linha, pagamentos: PagamentoDivida[] = []): Divida {
  return {
    id: l.id as string,
    credor: l.credor as string,
    descricao: (l.descricao as string) ?? undefined,
    valorOriginal: num(l.valor_original),
    saldoAtual: num(l.saldo_atual),
    jurosMes: num(l.juros_mes),
    valorAcordo: numOuUndef(l.valor_acordo),
    parcelasRestantes: numOuUndef(l.parcelas_restantes),
    valorParcela: numOuUndef(l.valor_parcela),
    negativado: Boolean(l.negativado),
    orgao: (l.orgao as Divida['orgao']) ?? undefined,
    vencimentoOriginal: dataOuNulo(l.vencimento_original),
    status: l.status as Divida['status'],
    pagamentos,
    criadoEm: data(l.criado_em),
  };
}

export function dividaParaLinha(d: Partial<Divida>): Linha {
  const l: Linha = {};
  if (d.id !== undefined) l.id = d.id;
  if (d.credor !== undefined) l.credor = d.credor;
  if (d.descricao !== undefined) l.descricao = d.descricao ?? null;
  if (d.valorOriginal !== undefined) l.valor_original = d.valorOriginal;
  if (d.saldoAtual !== undefined) l.saldo_atual = d.saldoAtual;
  if (d.jurosMes !== undefined) l.juros_mes = d.jurosMes;
  if (d.valorAcordo !== undefined) l.valor_acordo = d.valorAcordo ?? null;
  if (d.parcelasRestantes !== undefined) l.parcelas_restantes = d.parcelasRestantes ?? null;
  if (d.valorParcela !== undefined) l.valor_parcela = d.valorParcela ?? null;
  if (d.negativado !== undefined) l.negativado = d.negativado;
  if (d.orgao !== undefined) l.orgao = d.orgao ?? null;
  if (d.vencimentoOriginal !== undefined) l.vencimento_original = d.vencimentoOriginal || null;
  if (d.status !== undefined) l.status = d.status;
  return l;
}
