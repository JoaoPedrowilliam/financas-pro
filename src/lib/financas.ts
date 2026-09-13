import type {
  Ativo,
  Cartao,
  Categoria,
  Conta,
  Divida,
  EstadoFinanceiro,
  Recorrencia,
  Transacao,
} from '@/types';
import { agrupar, competencia, competenciaDe, dataDe, diaSeguro, hojeISO, somar } from './utils';

/* ────────────────────────────── Saldos e patrimônio ───────────────────────────── */

/**
 * Saldo de uma conta = saldo inicial + receitas − despesas ± transferências.
 * Só conta lançamentos com status `pago`: o que está pendente ainda não saiu do bolso.
 */
export function saldoDaConta(conta: Conta, transacoes: Transacao[], ate?: string): number {
  const relevantes = transacoes.filter((t) => t.status === 'pago' && (!ate || t.data <= ate));
  let saldo = conta.saldoInicial;
  for (const t of relevantes) {
    if (t.tipo === 'transferencia') {
      if (t.contaId === conta.id) saldo -= t.valor;
      if (t.contaDestinoId === conta.id) saldo += t.valor;
      continue;
    }
    // Compras no cartão de crédito não saem da conta na hora — saem na fatura.
    if (t.cartaoId) continue;
    if (t.contaId !== conta.id) continue;
    saldo += t.tipo === 'receita' ? t.valor : -t.valor;
  }
  return arredondar(saldo);
}

export function saldoTotal(contas: Conta[], transacoes: Transacao[], ate?: string): number {
  return arredondar(
    somar(
      contas.filter((c) => !c.arquivada),
      (c) => saldoDaConta(c, transacoes, ate),
    ),
  );
}

/** Patrimônio líquido = contas + investimentos a mercado − dívidas em aberto. */
export function patrimonioLiquido(estado: EstadoFinanceiro): {
  contas: number;
  investimentos: number;
  dividas: number;
  total: number;
} {
  const emContas = somar(
    estado.contas.filter((c) => !c.arquivada && c.incluirNoPatrimonio),
    (c) => saldoDaConta(c, estado.transacoes),
  );
  const investimentos = valorDeMercado(estado.ativos);
  const dividas = somar(
    estado.dividas.filter((d) => d.status !== 'quitada'),
    (d) => d.saldoAtual,
  );
  return {
    contas: arredondar(emContas),
    investimentos: arredondar(investimentos),
    dividas: arredondar(dividas),
    total: arredondar(emContas + investimentos - dividas),
  };
}

/* ─────────────────────────────── Fluxo mensal ─────────────────────────────── */

export interface ResumoMes {
  competencia: string;
  receitas: number;
  despesas: number;
  economia: number;
  /** Percentual da receita que sobrou. Negativo = gastou mais do que ganhou. */
  taxaEconomia: number | null;
  quantidade: number;
}

export function transacoesDoMes(transacoes: Transacao[], comp: string): Transacao[] {
  return transacoes.filter((t) => competencia(t.data) === comp);
}

export function resumoDoMes(transacoes: Transacao[], comp: string): ResumoMes {
  const doMes = transacoesDoMes(transacoes, comp);
  const receitas = somar(doMes.filter((t) => t.tipo === 'receita'), (t) => t.valor);
  const despesas = somar(doMes.filter((t) => t.tipo === 'despesa'), (t) => t.valor);
  const economia = receitas - despesas;
  return {
    competencia: comp,
    receitas: arredondar(receitas),
    despesas: arredondar(despesas),
    economia: arredondar(economia),
    taxaEconomia: receitas > 0 ? (economia / receitas) * 100 : null,
    quantidade: doMes.length,
  };
}

/** Série de 12 meses do ano, sempre com os 12 pontos (mês vazio = zero). */
export function serieAnual(transacoes: Transacao[], ano: number): ResumoMes[] {
  return Array.from({ length: 12 }, (_, i) => resumoDoMes(transacoes, competenciaDe(ano, i + 1)));
}

export function gastoPorCategoria(
  transacoes: Transacao[],
  categorias: Categoria[],
  comp?: string,
): { categoria: Categoria | null; total: number; participacao: number; quantidade: number }[] {
  const base = (comp ? transacoesDoMes(transacoes, comp) : transacoes).filter(
    (t) => t.tipo === 'despesa',
  );
  const totalGeral = somar(base, (t) => t.valor);
  const grupos = agrupar(base, (t) => t.categoriaId ?? 'sem-categoria');

  return Object.entries(grupos)
    .map(([id, itens]) => {
      const total = somar(itens, (t) => t.valor);
      return {
        categoria: categorias.find((c) => c.id === id) ?? null,
        total: arredondar(total),
        participacao: totalGeral > 0 ? (total / totalGeral) * 100 : 0,
        quantidade: itens.length,
      };
    })
    .sort((a, b) => b.total - a.total);
}

export type SituacaoOrcamento = 'dentro' | 'perto' | 'estourado';

export interface LinhaOrcamento {
  categoria: Categoria;
  /** Gasto do mês na categoria, somando as subcategorias dela. */
  gasto: number;
  teto: number;
  percentual: number;
  /** Positivo = ainda cabe; negativo = quanto passou. */
  restante: number;
  situacao: SituacaoOrcamento;
}

/**
 * Acompanhamento do teto mensal por categoria.
 *
 * O gasto de uma categoria-mãe inclui o das filhas: quem define teto para
 * "Alimentação" espera que Mercado e Restaurantes contem contra ele — os
 * lançamentos ficam nas folhas, o orçamento vive na raiz.
 */
export function orcamentoPorCategoria(
  transacoes: Transacao[],
  categorias: Categoria[],
  comp: string,
): LinhaOrcamento[] {
  const despesasDoMes = transacoesDoMes(transacoes, comp).filter((t) => t.tipo === 'despesa');

  return categorias
    .filter((c) => !c.arquivada && c.tipo === 'despesa' && (c.orcamento ?? 0) > 0)
    .map((categoria) => {
      const familia = new Set([
        categoria.id,
        ...categorias.filter((c) => c.paiId === categoria.id).map((c) => c.id),
      ]);
      const gasto = arredondar(
        somar(
          despesasDoMes.filter((t) => t.categoriaId && familia.has(t.categoriaId)),
          (t) => t.valor,
        ),
      );
      const teto = categoria.orcamento as number;
      const percentual = (gasto / teto) * 100;
      return {
        categoria,
        gasto,
        teto,
        percentual,
        restante: arredondar(teto - gasto),
        situacao: (percentual > 100 ? 'estourado' : percentual >= 80 ? 'perto' : 'dentro') as SituacaoOrcamento,
      };
    })
    .sort((a, b) => b.percentual - a.percentual);
}

/** Evolução do saldo acumulado dia a dia dentro do mês — alimenta o gráfico do dashboard. */
export function evolucaoDiaria(
  transacoes: Transacao[],
  comp: string,
  saldoAbertura: number,
): { dia: number; saldo: number; entrada: number; saida: number }[] {
  const [ano, mes] = comp.split('-').map(Number);
  const total = new Date(ano, mes, 0).getDate();
  const doMes = transacoesDoMes(transacoes, comp).filter((t) => t.tipo !== 'transferencia');
  let acumulado = saldoAbertura;

  return Array.from({ length: total }, (_, i) => {
    const dia = i + 1;
    const doDia = doMes.filter((t) => dataDe(t.data).getDate() === dia);
    const entrada = somar(doDia.filter((t) => t.tipo === 'receita'), (t) => t.valor);
    const saida = somar(doDia.filter((t) => t.tipo === 'despesa'), (t) => t.valor);
    acumulado += entrada - saida;
    return { dia, saldo: arredondar(acumulado), entrada: arredondar(entrada), saida: arredondar(saida) };
  });
}

/* ──────────────────────────────── Cartões ──────────────────────────────── */

export interface Fatura {
  cartaoId: string;
  competencia: string;
  fechamento: string;
  vencimento: string;
  total: number;
  itens: Transacao[];
  fechada: boolean;
}

/**
 * Monta a fatura de uma competência.
 * Compra feita depois do fechamento cai na fatura seguinte — é o que o cartão faz de verdade.
 */
export function faturaDoCartao(cartao: Cartao, transacoes: Transacao[], comp: string): Fatura {
  const [ano, mes] = comp.split('-').map(Number);
  const fechamento = diaSeguro(ano, mes, cartao.diaFechamento);
  const vencimento =
    cartao.diaVencimento > cartao.diaFechamento
      ? diaSeguro(ano, mes, cartao.diaVencimento)
      : diaSeguro(mes === 12 ? ano + 1 : ano, mes === 12 ? 1 : mes + 1, cartao.diaVencimento);

  const anterior = mes === 1 ? competenciaDe(ano - 1, 12) : competenciaDe(ano, mes - 1);
  const [aAnt, mAnt] = anterior.split('-').map(Number);
  const fechamentoAnterior = diaSeguro(aAnt, mAnt, cartao.diaFechamento);

  const itens = transacoes
    .filter((t) => t.cartaoId === cartao.id && t.tipo === 'despesa')
    .filter((t) => t.data > fechamentoAnterior && t.data <= fechamento)
    .sort((a, b) => a.data.localeCompare(b.data));

  return {
    cartaoId: cartao.id,
    competencia: comp,
    fechamento,
    vencimento,
    total: arredondar(somar(itens, (t) => t.valor)),
    itens,
    fechada: hojeISO() > fechamento,
  };
}

/** Limite comprometido = tudo que ainda não foi pago, incluindo parcelas futuras. */
export function limiteUsado(cartao: Cartao, transacoes: Transacao[]): number {
  const emAberto = transacoes.filter(
    (t) => t.cartaoId === cartao.id && t.tipo === 'despesa' && t.status !== 'pago',
  );
  return arredondar(somar(emAberto, (t) => t.valor));
}

/**
 * Divide uma compra em N parcelas.
 * O resto dos centavos vai na primeira parcela, como fazem as operadoras.
 */
export function gerarParcelas(
  valorTotal: number,
  quantidade: number,
  primeiraData: string,
): { valor: number; data: string; numero: number }[] {
  const centavos = Math.round(valorTotal * 100);
  const base = Math.floor(centavos / quantidade);
  const resto = centavos - base * quantidade;
  const d = dataDe(primeiraData);

  return Array.from({ length: quantidade }, (_, i) => {
    const valor = (base + (i === 0 ? resto : 0)) / 100;
    const alvo = new Date(d.getFullYear(), d.getMonth() + i, 1);
    return {
      numero: i + 1,
      valor: arredondar(valor),
      data: diaSeguro(alvo.getFullYear(), alvo.getMonth() + 1, d.getDate()),
    };
  });
}

/* ───────────────────────────── Recorrências ───────────────────────────── */

const PASSO_MESES: Record<Recorrencia['periodicidade'], number> = {
  mensal: 1,
  bimestral: 2,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};

export function recorrenciaVenceNoMes(rec: Recorrencia, comp: string): boolean {
  if (!rec.ativa) return false;
  const [ano, mes] = comp.split('-').map(Number);
  const inicio = dataDe(rec.inicioEm);
  const alvo = new Date(ano, mes - 1, 1);
  const inicioMes = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
  if (alvo < inicioMes) return false;
  if (rec.fimEm && diaSeguro(ano, mes, rec.diaVencimento) > rec.fimEm) return false;

  const distancia = (ano - inicio.getFullYear()) * 12 + (mes - 1 - inicio.getMonth());
  return distancia % PASSO_MESES[rec.periodicidade] === 0;
}

/**
 * Média das últimas N ocorrências de uma conta variável.
 * É a base do alerta "sua luz veio 34% acima da média".
 */
export function mediaDaVariavel(
  rec: Recorrencia,
  transacoes: Transacao[],
  meses = 6,
): { media: number; amostras: number; ultimo: number | null; desvio: number | null } {
  const historico = transacoes
    .filter((t) => t.recorrenciaId === rec.id)
    .sort((a, b) => b.data.localeCompare(a.data))
    .slice(0, meses);

  if (!historico.length) return { media: rec.valorPrevisto, amostras: 0, ultimo: null, desvio: null };

  const media = somar(historico, (t) => t.valor) / historico.length;
  const ultimo = historico[0].valor;
  return {
    media: arredondar(media),
    amostras: historico.length,
    ultimo,
    desvio: media > 0 ? ((ultimo - media) / media) * 100 : null,
  };
}

/* ────────────────────────────── Investimentos ────────────────────────────── */

export function valorDeMercado(ativos: Ativo[]): number {
  return arredondar(somar(ativos, (a) => a.quantidade * (a.precoAtual || a.precoMedio)));
}

export function custoTotal(ativos: Ativo[]): number {
  return arredondar(somar(ativos, (a) => a.quantidade * a.precoMedio));
}

export function resultadoCarteira(ativos: Ativo[]) {
  const mercado = valorDeMercado(ativos);
  const custo = custoTotal(ativos);
  const lucro = mercado - custo;
  return {
    mercado,
    custo,
    lucro: arredondar(lucro),
    rentabilidade: custo > 0 ? (lucro / custo) * 100 : 0,
    /** Proventos projetados em 12 meses, pelo DY informado. */
    proventos12m: arredondar(
      somar(ativos, (a) => a.quantidade * (a.precoAtual || a.precoMedio) * ((a.dividendYield ?? 0) / 100)),
    ),
  };
}

export function alocacaoPorClasse(ativos: Ativo[]) {
  const total = valorDeMercado(ativos);
  const grupos = agrupar(ativos, (a) => a.classe);
  return Object.entries(grupos)
    .map(([classe, itens]) => {
      const valor = valorDeMercado(itens);
      return {
        classe: classe as Ativo['classe'],
        valor,
        participacao: total > 0 ? (valor / total) * 100 : 0,
        quantidade: itens.length,
      };
    })
    .sort((a, b) => b.valor - a.valor);
}

/* ──────────────────────────────── Dívidas ──────────────────────────────── */

/** Custo total de uma dívida se ela seguir rolando o número de parcelas restantes. */
export function custoSeManter(divida: Divida): number {
  if (divida.valorParcela && divida.parcelasRestantes) {
    return arredondar(divida.valorParcela * divida.parcelasRestantes);
  }
  // Sem parcelamento definido, projetamos 12 meses de juros compostos sobre o saldo.
  const i = divida.jurosMes / 100;
  return arredondar(divida.saldoAtual * Math.pow(1 + i, 12));
}

export interface SimulacaoQuitacao {
  meses: number;
  parcela: number;
  totalPago: number;
  jurosPagos: number;
  economiaVsManter: number;
  cronograma: { mes: number; saldo: number; juros: number; amortizacao: number }[];
}

/**
 * Simula a quitação com parcela fixa (Price).
 * Retorna `null` se a parcela não cobrir nem os juros do mês — a dívida nunca fecharia.
 */
export function simularQuitacao(divida: Divida, parcela: number, limiteMeses = 600): SimulacaoQuitacao | null {
  const i = divida.jurosMes / 100;
  let saldo = divida.valorAcordo ?? divida.saldoAtual;

  if (i > 0 && parcela <= saldo * i) return null;
  if (parcela <= 0) return null;

  const cronograma: SimulacaoQuitacao['cronograma'] = [];
  let jurosPagos = 0;
  let totalPago = 0;
  let mes = 0;

  while (saldo > 0.005 && mes < limiteMeses) {
    mes += 1;
    const juros = saldo * i;
    const pagamento = Math.min(parcela, saldo + juros);
    const amortizacao = pagamento - juros;
    saldo = Math.max(0, saldo - amortizacao);
    jurosPagos += juros;
    totalPago += pagamento;
    cronograma.push({
      mes,
      saldo: arredondar(saldo),
      juros: arredondar(juros),
      amortizacao: arredondar(amortizacao),
    });
  }

  return {
    meses: mes,
    parcela: arredondar(parcela),
    totalPago: arredondar(totalPago),
    jurosPagos: arredondar(jurosPagos),
    economiaVsManter: arredondar(custoSeManter(divida) - totalPago),
    cronograma,
  };
}

/** Parcela necessária para quitar em N meses (fórmula da Tabela Price). */
export function parcelaParaPrazo(divida: Divida, meses: number): number {
  const saldo = divida.valorAcordo ?? divida.saldoAtual;
  const i = divida.jurosMes / 100;
  if (meses <= 0) return saldo;
  if (i === 0) return arredondar(saldo / meses);
  const fator = Math.pow(1 + i, meses);
  return arredondar((saldo * i * fator) / (fator - 1));
}

export type Estrategia = 'avalanche' | 'bola-de-neve';

/**
 * Ordena as dívidas segundo a estratégia escolhida.
 * - avalanche: maior juros primeiro (matematicamente mais barato)
 * - bola de neve: menor saldo primeiro (vitórias rápidas, sustenta a motivação)
 */
export function ordenarPorEstrategia(dividas: Divida[], estrategia: Estrategia): Divida[] {
  const ativas = dividas.filter((d) => d.status !== 'quitada');
  return [...ativas].sort((a, b) =>
    estrategia === 'avalanche' ? b.jurosMes - a.jurosMes : a.saldoAtual - b.saldoAtual,
  );
}

/**
 * Plano completo de quitação: aplica o orçamento mensal na ordem da estratégia,
 * pagando o mínimo de todas e jogando a sobra na dívida-alvo.
 */
export function planoDeQuitacao(dividas: Divida[], orcamentoMensal: number, estrategia: Estrategia) {
  const fila = ordenarPorEstrategia(dividas, estrategia).map((d) => ({
    id: d.id,
    credor: d.credor,
    saldo: d.valorAcordo ?? d.saldoAtual,
    juros: d.jurosMes / 100,
    minimo: d.valorParcela ?? Math.max((d.valorAcordo ?? d.saldoAtual) * 0.03, 50),
  }));

  const minimoTotal = somar(fila, (d) => d.minimo);
  if (orcamentoMensal < minimoTotal) {
    return { viavel: false as const, minimoNecessario: arredondar(minimoTotal), meses: 0, totalPago: 0, jurosPagos: 0, quitacoes: [], linhaDoTempo: [] };
  }

  const quitacoes: { credor: string; mes: number }[] = [];
  const linhaDoTempo: { mes: number; saldoTotal: number }[] = [];
  let jurosPagos = 0;
  let totalPago = 0;
  let mes = 0;

  while (fila.some((d) => d.saldo > 0.005) && mes < 600) {
    mes += 1;
    let disponivel = orcamentoMensal;

    for (const d of fila) {
      if (d.saldo <= 0.005) continue;
      const juros = d.saldo * d.juros;
      jurosPagos += juros;
      d.saldo += juros;
      const pago = Math.min(d.minimo, d.saldo, disponivel);
      d.saldo -= pago;
      disponivel -= pago;
      totalPago += pago;
    }

    for (const d of fila) {
      if (disponivel <= 0.005) break;
      if (d.saldo <= 0.005) continue;
      const extra = Math.min(disponivel, d.saldo);
      d.saldo -= extra;
      disponivel -= extra;
      totalPago += extra;
    }

    for (const d of fila) {
      if (d.saldo <= 0.005 && !quitacoes.some((q) => q.credor === d.credor)) {
        quitacoes.push({ credor: d.credor, mes });
      }
    }

    linhaDoTempo.push({ mes, saldoTotal: arredondar(somar(fila, (d) => Math.max(0, d.saldo))) });
  }

  return {
    viavel: true as const,
    minimoNecessario: arredondar(minimoTotal),
    meses: mes,
    totalPago: arredondar(totalPago),
    jurosPagos: arredondar(jurosPagos),
    quitacoes,
    linhaDoTempo,
  };
}

/* ──────────────────────────────── Metas ──────────────────────────────── */

export function progressoMeta(meta: { valorAtual: number; valorAlvo: number; prazo: string }) {
  const percentual = meta.valorAlvo > 0 ? Math.min(100, (meta.valorAtual / meta.valorAlvo) * 100) : 0;
  const falta = Math.max(0, meta.valorAlvo - meta.valorAtual);
  const hoje = dataDe(hojeISO());
  const prazo = dataDe(meta.prazo);
  const mesesRestantes = Math.max(
    0,
    (prazo.getFullYear() - hoje.getFullYear()) * 12 + (prazo.getMonth() - hoje.getMonth()),
  );
  return {
    percentual,
    falta: arredondar(falta),
    mesesRestantes,
    aporteMensal: mesesRestantes > 0 ? arredondar(falta / mesesRestantes) : falta,
    atrasada: prazo < hoje && falta > 0,
  };
}

export function arredondar(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}
