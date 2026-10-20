/**
 * Modelo de domínio.
 *
 * Convenções que valem para todo o sistema:
 * - Dinheiro é sempre `number` em reais, com 2 casas. Nunca string.
 * - Datas são sempre `string` no formato ISO `YYYY-MM-DD` (sem fuso).
 *   Isso evita o clássico bug de lançamento que "pula" um dia por causa de UTC.
 * - Todo registro tem `id` (uuid) e `criadoEm` (ISO completo).
 */

export type ID = string;

export type TipoTransacao = 'receita' | 'despesa' | 'transferencia';

export type StatusTransacao = 'pago' | 'pendente' | 'atrasado';

export type TipoConta = 'corrente' | 'poupanca' | 'carteira' | 'investimento' | 'digital';

export type TipoCartao = 'credito' | 'debito' | 'multiplo';

export type ClasseAtivo = 'acao' | 'fii' | 'etf' | 'bdr' | 'renda-fixa' | 'cripto';

export type Periodicidade = 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual';

export interface Categoria {
  id: ID;
  nome: string;
  tipo: Exclude<TipoTransacao, 'transferencia'>;
  cor: string;
  icone: string;
  /** Categoria-mãe. Nulo = categoria de primeiro nível. */
  paiId: ID | null;
  /** Teto mensal opcional, usado pelos alertas de estouro. */
  orcamento?: number;
  arquivada?: boolean;
}

export interface Anexo {
  id: ID;
  nome: string;
  tipo: string;
  tamanho: number;
  /** Data URL. Em produção, troque por uma URL de object storage. */
  dados: string;
}

export interface Transacao {
  id: ID;
  tipo: TipoTransacao;
  descricao: string;
  valor: number;
  data: string;
  categoriaId: ID | null;
  contaId: ID | null;
  /** Preenchido apenas em transferências. */
  contaDestinoId?: ID | null;
  cartaoId?: ID | null;
  status: StatusTransacao;
  observacao?: string;
  etiquetas: string[];
  anexos: Anexo[];
  /** Vínculo com a recorrência que gerou este lançamento. */
  recorrenciaId?: ID | null;
  /** Parcelamento: 3 de 12. */
  parcela?: { numero: number; total: number; grupoId: ID };
  criadoEm: string;
}

export interface Conta {
  id: ID;
  nome: string;
  /** Texto livre. Continua existindo para contas criadas antes do catálogo de bancos. */
  instituicao: string;
  /** Id do catálogo em `lib/bancos`. Ausente = instituição não escolhida na lista. */
  bancoId?: string | null;
  tipo: TipoConta;
  saldoInicial: number;
  cor: string;
  incluirNoPatrimonio: boolean;
  arquivada?: boolean;
  criadoEm: string;
}

export interface Cartao {
  id: ID;
  nome: string;
  bandeira: string;
  /** Id do catálogo em `lib/bancos` — o emissor do cartão. */
  bancoId?: string | null;
  /** Últimos 4 dígitos, só para reconhecer o cartão na carteira. Nunca o número inteiro. */
  final?: string;
  tipo: TipoCartao;
  limite: number;
  /** Dia do mês em que a fatura fecha. */
  diaFechamento: number;
  /** Dia do mês do vencimento. */
  diaVencimento: number;
  cor: string;
  contaPagamentoId: ID | null;
  arquivado?: boolean;
  criadoEm: string;
}

export interface Assinatura {
  id: ID;
  nome: string;
  valor: number;
  cartaoId: ID | null;
  categoriaId: ID | null;
  diaCobranca: number;
  periodicidade: Periodicidade;
  ativa: boolean;
  criadoEm: string;
}

/** Conta fixa (valor previsível) ou variável (valor oscila mês a mês). */
export interface Recorrencia {
  id: ID;
  nome: string;
  natureza: 'fixa' | 'variavel';
  tipo: Exclude<TipoTransacao, 'transferencia'>;
  /** Nas fixas é o valor exato; nas variáveis é a estimativa inicial. */
  valorPrevisto: number;
  categoriaId: ID | null;
  contaId: ID | null;
  cartaoId?: ID | null;
  diaVencimento: number;
  periodicidade: Periodicidade;
  inicioEm: string;
  fimEm?: string | null;
  /** Dias de antecedência do lembrete. */
  lembreteDias: number;
  ativa: boolean;
  criadoEm: string;
}

export interface Ativo {
  id: ID;
  ticker: string;
  nome: string;
  classe: ClasseAtivo;
  quantidade: number;
  precoMedio: number;
  /** Última cotação conhecida; atualizada pela rota /api/cotacoes. */
  precoAtual: number;
  atualizadoEm?: string;
  dividendYield?: number;
  /** Renda fixa: taxa contratada e vencimento. */
  taxa?: string;
  vencimento?: string;
  corretora?: string;
  criadoEm: string;
}

export interface Meta {
  id: ID;
  nome: string;
  descricao?: string;
  valorAlvo: number;
  valorAtual: number;
  prazo: string;
  cor: string;
  icone: string;
  contaId?: ID | null;
  concluida: boolean;
  criadoEm: string;
}

export interface PagamentoDivida {
  id: ID;
  data: string;
  valor: number;
  observacao?: string;
}

export interface Divida {
  id: ID;
  credor: string;
  descricao?: string;
  /** Valor original contratado. */
  valorOriginal: number;
  /** Saldo devedor atual, já com encargos. */
  saldoAtual: number;
  /** Taxa de juros ao mês, em % (ex.: 4.5). */
  jurosMes: number;
  /** Proposta de acordo à vista, quando existe. */
  valorAcordo?: number;
  parcelasRestantes?: number;
  valorParcela?: number;
  negativado: boolean;
  orgao?: 'Serasa' | 'SPC' | 'Boa Vista' | 'Cenprot' | 'Nenhum';
  vencimentoOriginal?: string;
  status: 'ativa' | 'negociando' | 'quitada';
  pagamentos: PagamentoDivida[];
  criadoEm: string;
}

export interface Perfil {
  nome: string;
  email: string;
  moeda: 'BRL' | 'USD' | 'EUR';
  /** Dia em que o mês financeiro começa (útil para quem recebe dia 5). */
  inicioMesFinanceiro: number;
  ocultarValores: boolean;
  bloqueioPin?: string | null;
  /**
   * Renda mensal líquida — o que de fato cai na conta.
   * Base do cálculo de comprometimento. Indefinido quando a pessoa ainda não
   * informou: nesse caso não existe percentual, e a interface pede o valor em
   * vez de mostrar zero.
   */
  rendaMensal?: number;
}

export interface EstadoFinanceiro {
  perfil: Perfil;
  contas: Conta[];
  cartoes: Cartao[];
  categorias: Categoria[];
  transacoes: Transacao[];
  recorrencias: Recorrencia[];
  assinaturas: Assinatura[];
  ativos: Ativo[];
  metas: Meta[];
  dividas: Divida[];
  /** Meses (YYYY-MM) em que a geração automática de recorrências já rodou. */
  recorrenciasGeradas: string[];
}

export interface Insight {
  id: string;
  nivel: 'positivo' | 'atencao' | 'critico' | 'neutro';
  titulo: string;
  detalhe: string;
  acao?: { rotulo: string; href: string };
}

export interface FiltroTransacoes {
  busca: string;
  tipos: TipoTransacao[];
  categoriaIds: ID[];
  contaIds: ID[];
  cartaoIds: ID[];
  status: StatusTransacao[];
  de?: string;
  ate?: string;
  valorMin?: number;
  valorMax?: number;
  somenteComAnexo?: boolean;
}
