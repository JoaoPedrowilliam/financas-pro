import type { Categoria, EstadoFinanceiro } from '@/types';
import { competenciaDe, diaSeguro, hojeISO, uid } from '@/lib/utils';

/**
 * Plano de categorias padrão.
 *
 * Fica separado do restante do seed de propósito: categoria não é "dado do
 * usuário", é a taxonomia sem a qual o sistema não funciona — um lançamento
 * precisa ter onde cair. Por isso este conjunto é reinstalado sempre que a
 * lista fica vazia, inclusive depois de "Apagar todos os dados".
 *
 * Os ids são gerados a cada chamada, então quem consome precisa guardar
 * o retorno em vez de chamar a função duas vezes.
 */
export function categoriasPadrao(): Categoria[] {
  const cat = (
    nome: string,
    tipo: 'receita' | 'despesa',
    cor: string,
    icone: string,
    paiId: string | null = null,
    orcamento?: number,
  ): Categoria => ({ id: uid(), nome, tipo, cor, icone, paiId, orcamento, arquivada: false });

  const moradia = cat('Moradia', 'despesa', '#404040', 'Home', null, 2200);
  const alimentacao = cat('Alimentação', 'despesa', '#F59E0B', 'UtensilsCrossed', null, 1400);

  return [
    cat('Salário', 'receita', '#16A34A', 'Wallet'),
    cat('Renda extra', 'receita', '#22C55E', 'Sparkles'),
    moradia,
    cat('Aluguel', 'despesa', '#525252', 'KeyRound', moradia.id),
    cat('Luz, água e internet', 'despesa', '#737373', 'Zap', moradia.id),
    alimentacao,
    cat('Mercado', 'despesa', '#D97706', 'ShoppingCart', alimentacao.id),
    cat('Restaurantes', 'despesa', '#FBBF24', 'Coffee', alimentacao.id),
    cat('Transporte', 'despesa', '#0F766E', 'Car', null, 600),
    cat('Saúde', 'despesa', '#BE123C', 'HeartPulse', null, 500),
    cat('Lazer', 'despesa', '#15803D', 'Popcorn', null, 400),
    cat('Assinaturas', 'despesa', '#3F3F46', 'Repeat', null, 200),
    cat('Dívidas e acordos', 'despesa', '#EF4444', 'Scale', null),
  ];
}

/**
 * Carteira de exemplo. Serve para a interface nunca abrir vazia numa demo
 * e para exercitar todos os módulos (parcelas, recorrências, dívidas, carteira).
 * Em Configurações há o botão "Limpar tudo" para começar do zero.
 */
export function gerarSeed(): EstadoFinanceiro {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth() + 1;

  const contaCorrente = { id: uid(), nome: 'Conta corrente', instituicao: 'Nubank', bancoId: 'nubank', tipo: 'digital' as const, saldoInicial: 3200, cor: '#820AD1', incluirNoPatrimonio: true, criadoEm: hojeISO() };
  const poupanca = { id: uid(), nome: 'Reserva de emergência', instituicao: 'Caixa', bancoId: 'caixa', tipo: 'poupanca' as const, saldoInicial: 6800, cor: '#0070AF', incluirNoPatrimonio: true, criadoEm: hojeISO() };
  const carteira = { id: uid(), nome: 'Dinheiro em espécie', instituicao: '—', bancoId: 'outro', tipo: 'carteira' as const, saldoInicial: 240, cor: '#16A34A', incluirNoPatrimonio: true, criadoEm: hojeISO() };

  const categorias = categoriasPadrao();
  const pega = (nome: string) => {
    const achada = categorias.find((c) => c.nome === nome);
    if (!achada) throw new Error(`Categoria "${nome}" saiu do plano padrão`);
    return achada;
  };

  const salario = pega('Salário');
  const extras = pega('Renda extra');
  const aluguel = pega('Aluguel');
  const contasCasa = pega('Luz, água e internet');
  const mercado = pega('Mercado');
  const restaurante = pega('Restaurantes');
  const transporte = pega('Transporte');
  const saude = pega('Saúde');
  const lazer = pega('Lazer');
  const assinaturasCat = pega('Assinaturas');
  const dividasCat = pega('Dívidas e acordos');

  const cartaoRoxo = { id: uid(), nome: 'Nubank Ultravioleta', bandeira: 'Mastercard', bancoId: 'nubank', final: '4521', tipo: 'credito' as const, limite: 8000, diaFechamento: 28, diaVencimento: 5, cor: '#2A2A2A', contaPagamentoId: contaCorrente.id, criadoEm: hojeISO() };
  const cartaoAzul = { id: uid(), nome: 'Inter Gold', bandeira: 'Visa', bancoId: 'inter', final: '8830', tipo: 'multiplo' as const, limite: 4500, diaFechamento: 20, diaVencimento: 28, cor: '#7C2D12', contaPagamentoId: contaCorrente.id, criadoEm: hojeISO() };

  const transacoes: EstadoFinanceiro['transacoes'] = [];
  const lanc = (
    tipo: 'receita' | 'despesa',
    descricao: string,
    valor: number,
    data: string,
    categoriaId: string,
    opcoes: { cartaoId?: string; status?: 'pago' | 'pendente'; parcela?: { numero: number; total: number; grupoId: string } } = {},
  ) => {
    transacoes.push({
      id: uid(), tipo, descricao, valor, data, categoriaId,
      contaId: opcoes.cartaoId ? null : contaCorrente.id,
      cartaoId: opcoes.cartaoId ?? null,
      status: opcoes.status ?? 'pago',
      etiquetas: [], anexos: [], parcela: opcoes.parcela, criadoEm: hojeISO(),
    });
  };

  // Seis meses de histórico, com uma variação realista mês a mês.
  for (let recuo = 5; recuo >= 0; recuo--) {
    const alvo = new Date(ano, mes - 1 - recuo, 1);
    const a = alvo.getFullYear();
    const m = alvo.getMonth() + 1;
    const ruido = (base: number, amplitude: number) => Math.round((base + (Math.random() - 0.5) * amplitude) * 100) / 100;

    lanc('receita', 'Salário mensal', 7400, diaSeguro(a, m, 5), salario.id);
    if (recuo % 2 === 0) lanc('receita', 'Freelance de design', ruido(950, 500), diaSeguro(a, m, 18), extras.id);

    lanc('despesa', 'Aluguel', 1850, diaSeguro(a, m, 10), aluguel.id);
    lanc('despesa', 'Energia elétrica', ruido(190, 120), diaSeguro(a, m, 12), contasCasa.id);
    lanc('despesa', 'Internet fibra', 119.9, diaSeguro(a, m, 15), contasCasa.id);
    lanc('despesa', 'Compras do mês', ruido(820, 300), diaSeguro(a, m, 8), mercado.id, { cartaoId: cartaoRoxo.id });
    lanc('despesa', 'Delivery e cafés', ruido(310, 200), diaSeguro(a, m, 21), restaurante.id, { cartaoId: cartaoRoxo.id });
    lanc('despesa', 'Combustível', ruido(380, 160), diaSeguro(a, m, 14), transporte.id, { cartaoId: cartaoAzul.id });
    lanc('despesa', 'Plano de saúde', 428.6, diaSeguro(a, m, 7), saude.id);
    lanc('despesa', 'Cinema e passeios', ruido(180, 140), diaSeguro(a, m, 23), lazer.id, { cartaoId: cartaoAzul.id });
    lanc('despesa', 'Acordo Serasa — parcela', 320, diaSeguro(a, m, 20), dividasCat.id);
  }

  // Uma compra parcelada em andamento: 3 de 10.
  const grupo = uid();
  for (let i = 0; i < 10; i++) {
    const alvo = new Date(ano, mes - 3 + i, 1);
    transacoes.push({
      id: uid(), tipo: 'despesa', descricao: 'Notebook — 10x', valor: 489.9,
      data: diaSeguro(alvo.getFullYear(), alvo.getMonth() + 1, 12),
      categoriaId: lazer.id, contaId: null, cartaoId: cartaoRoxo.id,
      status: i < 3 ? 'pago' : 'pendente',
      etiquetas: ['parcelado'], anexos: [],
      parcela: { numero: i + 1, total: 10, grupoId: grupo },
      criadoEm: hojeISO(),
    });
  }

  const recorrencias: EstadoFinanceiro['recorrencias'] = [
    { id: uid(), nome: 'Aluguel', natureza: 'fixa', tipo: 'despesa', valorPrevisto: 1850, categoriaId: aluguel.id, contaId: contaCorrente.id, diaVencimento: 10, periodicidade: 'mensal', inicioEm: `${ano - 1}-01-10`, lembreteDias: 3, ativa: true, criadoEm: hojeISO() },
    { id: uid(), nome: 'Internet fibra', natureza: 'fixa', tipo: 'despesa', valorPrevisto: 119.9, categoriaId: contasCasa.id, contaId: contaCorrente.id, diaVencimento: 15, periodicidade: 'mensal', inicioEm: `${ano - 1}-01-15`, lembreteDias: 2, ativa: true, criadoEm: hojeISO() },
    { id: uid(), nome: 'Plano de saúde', natureza: 'fixa', tipo: 'despesa', valorPrevisto: 428.6, categoriaId: saude.id, contaId: contaCorrente.id, diaVencimento: 7, periodicidade: 'mensal', inicioEm: `${ano - 1}-01-07`, lembreteDias: 3, ativa: true, criadoEm: hojeISO() },
    { id: uid(), nome: 'Energia elétrica', natureza: 'variavel', tipo: 'despesa', valorPrevisto: 190, categoriaId: contasCasa.id, contaId: contaCorrente.id, diaVencimento: 12, periodicidade: 'mensal', inicioEm: `${ano - 1}-01-12`, lembreteDias: 3, ativa: true, criadoEm: hojeISO() },
    { id: uid(), nome: 'Conta de água', natureza: 'variavel', tipo: 'despesa', valorPrevisto: 96, categoriaId: contasCasa.id, contaId: contaCorrente.id, diaVencimento: 18, periodicidade: 'mensal', inicioEm: `${ano - 1}-01-18`, lembreteDias: 3, ativa: true, criadoEm: hojeISO() },
    { id: uid(), nome: 'Salário', natureza: 'fixa', tipo: 'receita', valorPrevisto: 7400, categoriaId: salario.id, contaId: contaCorrente.id, diaVencimento: 5, periodicidade: 'mensal', inicioEm: `${ano - 1}-01-05`, lembreteDias: 0, ativa: true, criadoEm: hojeISO() },
  ];

  const assinaturas: EstadoFinanceiro['assinaturas'] = [
    { id: uid(), nome: 'Spotify Família', valor: 34.9, cartaoId: cartaoRoxo.id, categoriaId: assinaturasCat.id, diaCobranca: 8, periodicidade: 'mensal', ativa: true, criadoEm: hojeISO() },
    { id: uid(), nome: 'Netflix Padrão', valor: 44.9, cartaoId: cartaoRoxo.id, categoriaId: assinaturasCat.id, diaCobranca: 15, periodicidade: 'mensal', ativa: true, criadoEm: hojeISO() },
    { id: uid(), nome: 'iCloud 200 GB', valor: 14.9, cartaoId: cartaoAzul.id, categoriaId: assinaturasCat.id, diaCobranca: 22, periodicidade: 'mensal', ativa: true, criadoEm: hojeISO() },
    { id: uid(), nome: 'Academia', valor: 129.9, cartaoId: cartaoAzul.id, categoriaId: saude.id, diaCobranca: 5, periodicidade: 'mensal', ativa: true, criadoEm: hojeISO() },
  ];

  const ativos: EstadoFinanceiro['ativos'] = [
    { id: uid(), ticker: 'PETR4', nome: 'Petrobras PN', classe: 'acao', quantidade: 200, precoMedio: 34.2, precoAtual: 38.9, dividendYield: 12.4, corretora: 'Clear', criadoEm: hojeISO() },
    { id: uid(), ticker: 'ITSA4', nome: 'Itaúsa PN', classe: 'acao', quantidade: 350, precoMedio: 9.1, precoAtual: 10.35, dividendYield: 7.1, corretora: 'Clear', criadoEm: hojeISO() },
    { id: uid(), ticker: 'MXRF11', nome: 'Maxi Renda FII', classe: 'fii', quantidade: 400, precoMedio: 9.85, precoAtual: 9.62, dividendYield: 11.8, corretora: 'Rico', criadoEm: hojeISO() },
    { id: uid(), ticker: 'HGLG11', nome: 'CSHG Logística', classe: 'fii', quantidade: 30, precoMedio: 158.4, precoAtual: 164.2, dividendYield: 8.6, corretora: 'Rico', criadoEm: hojeISO() },
    { id: uid(), ticker: 'IVVB11', nome: 'iShares S&P 500', classe: 'etf', quantidade: 40, precoMedio: 275.5, precoAtual: 312.8, dividendYield: 0, corretora: 'Clear', criadoEm: hojeISO() },
    { id: uid(), ticker: 'AAPL34', nome: 'Apple BDR', classe: 'bdr', quantidade: 25, precoMedio: 62.3, precoAtual: 68.15, dividendYield: 0.5, corretora: 'Clear', criadoEm: hojeISO() },
    { id: uid(), ticker: 'CDB-INTER-2027', nome: 'CDB Inter 112% CDI', classe: 'renda-fixa', quantidade: 1, precoMedio: 8000, precoAtual: 8940, taxa: '112% do CDI', vencimento: `${ano + 1}-06-30`, corretora: 'Inter', criadoEm: hojeISO() },
    { id: uid(), ticker: 'BTC', nome: 'Bitcoin', classe: 'cripto', quantidade: 0.015, precoMedio: 310000, precoAtual: 372400, corretora: 'Binance', criadoEm: hojeISO() },
  ];

  const metas: EstadoFinanceiro['metas'] = [
    { id: uid(), nome: 'Reserva de emergência', descricao: 'Seis meses de custo de vida', valorAlvo: 24000, valorAtual: 6800, prazo: `${ano + 1}-12-31`, cor: '#16A34A', icone: 'Shield', contaId: poupanca.id, concluida: false, criadoEm: hojeISO() },
    { id: uid(), nome: 'Sair do nome sujo', descricao: 'Quitar os dois acordos em aberto', valorAlvo: 9600, valorAtual: 3840, prazo: `${ano + 1}-06-30`, cor: '#16A34A', icone: 'ShieldCheck', concluida: false, criadoEm: hojeISO() },
    { id: uid(), nome: 'Viagem para o Chile', valorAlvo: 12000, valorAtual: 2100, prazo: `${ano + 1}-09-15`, cor: '#F59E0B', icone: 'Plane', concluida: false, criadoEm: hojeISO() },
  ];

  const dividas: EstadoFinanceiro['dividas'] = [
    { id: uid(), credor: 'Banco Santander', descricao: 'Cheque especial rolado', valorOriginal: 4200, saldoAtual: 5860, jurosMes: 8.2, valorAcordo: 3990, negativado: true, orgao: 'Serasa', vencimentoOriginal: `${ano - 1}-08-14`, status: 'negociando', pagamentos: [], criadoEm: hojeISO() },
    { id: uid(), credor: 'Loja Riachuelo', descricao: 'Cartão da loja', valorOriginal: 1800, saldoAtual: 2340, jurosMes: 12.5, parcelasRestantes: 8, valorParcela: 320, negativado: true, orgao: 'SPC', vencimentoOriginal: `${ano - 1}-11-02`, status: 'ativa', pagamentos: [], criadoEm: hojeISO() },
    { id: uid(), credor: 'Financeira Crefisa', descricao: 'Empréstimo pessoal', valorOriginal: 3000, saldoAtual: 1420, jurosMes: 6.9, parcelasRestantes: 5, valorParcela: 310, negativado: false, orgao: 'Nenhum', status: 'ativa', pagamentos: [], criadoEm: hojeISO() },
  ];

  return {
    perfil: {
      nome: 'Visitante',
      email: 'voce@exemplo.com',
      moeda: 'BRL',
      inicioMesFinanceiro: 1,
      ocultarValores: false,
      bloqueioPin: null,
    },
    contas: [contaCorrente, poupanca, carteira],
    cartoes: [cartaoRoxo, cartaoAzul],
    categorias,
    transacoes,
    recorrencias,
    assinaturas,
    ativos,
    metas,
    dividas,
    recorrenciasGeradas: [competenciaDe(ano, mes)],
  };
}

export const ESTADO_VAZIO: EstadoFinanceiro = {
  perfil: { nome: '', email: '', moeda: 'BRL', inicioMesFinanceiro: 1, ocultarValores: false, bloqueioPin: null },
  contas: [], cartoes: [], categorias: [], transacoes: [],
  recorrencias: [], assinaturas: [], ativos: [], metas: [], dividas: [],
  recorrenciasGeradas: [],
};
