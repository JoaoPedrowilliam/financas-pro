import type { EstadoFinanceiro, Insight } from '@/types';
import {
  faturaDoCartao, gastoPorCategoria, limiteUsado, mediaDaVariavel,
  orcamentoPorCategoria, patrimonioLiquido, progressoMeta, recorrenciaVenceNoMes, resumoDoMes,
} from './financas';
import { moeda, percentual, distanciaEmDias } from './format';
import { competenciaDe, hojeISO, mesAnterior, somar, variacao } from './utils';

/**
 * Gera os avisos que aparecem no dashboard.
 * Regra de ouro: cada insight aponta um número concreto e, quando dá, um lugar para agir.
 * Nada de "considere economizar mais".
 */
export function gerarInsights(estado: EstadoFinanceiro): Insight[] {
  const hoje = new Date();
  const comp = competenciaDe(hoje.getFullYear(), hoje.getMonth() + 1);
  const anterior = mesAnterior(comp);
  const insights: Insight[] = [];

  const mes = resumoDoMes(estado.transacoes, comp);
  const mesPassado = resumoDoMes(estado.transacoes, anterior);

  /* 1. Saldo do mês no vermelho */
  if (mes.economia < 0) {
    insights.push({
      id: 'saldo-negativo',
      nivel: 'critico',
      titulo: `Você gastou ${moeda(Math.abs(mes.economia))} a mais do que recebeu`,
      detalhe: `Neste mês entraram ${moeda(mes.receitas)} e saíram ${moeda(mes.despesas)}. A diferença está saindo de reserva ou de crédito.`,
      acao: { rotulo: 'Ver lançamentos do mês', href: '/financas' },
    });
  } else if (mes.taxaEconomia !== null && mes.taxaEconomia >= 20) {
    insights.push({
      id: 'boa-economia',
      nivel: 'positivo',
      titulo: `Você guardou ${mes.taxaEconomia.toFixed(0)}% do que recebeu`,
      detalhe: `São ${moeda(mes.economia)} de sobra neste mês. Acima dos 20% que costumam sustentar uma reserva saudável.`,
      acao: { rotulo: 'Direcionar para uma meta', href: '/metas' },
    });
  }

  /* 2. Salto de gasto contra o mês anterior */
  const varDespesa = variacao(mes.despesas, mesPassado.despesas);
  if (varDespesa !== null && varDespesa > 15 && mesPassado.despesas > 0) {
    insights.push({
      id: 'despesa-subiu',
      nivel: 'atencao',
      titulo: `Suas despesas subiram ${percentual(varDespesa, 0)} sobre o mês passado`,
      detalhe: `De ${moeda(mesPassado.despesas)} para ${moeda(mes.despesas)}. Vale conferir qual categoria puxou o aumento.`,
      acao: { rotulo: 'Abrir relatório comparativo', href: '/relatorios' },
    });
  }

  /* 3. Orçamento por categoria
     Usa `orcamentoPorCategoria` porque ele soma as subcategorias na mãe: um teto
     em "Alimentação" precisa contar o que foi gasto em Mercado e Restaurantes. */
  const orcamentos = orcamentoPorCategoria(estado.transacoes, estado.categorias, comp);
  for (const linha of orcamentos) {
    if (linha.situacao === 'estourado') {
      insights.push({
        id: `orcamento-${linha.categoria.id}`,
        nivel: 'atencao',
        titulo: `${linha.categoria.nome} passou do limite que você definiu`,
        detalhe: `Gasto de ${moeda(linha.gasto)} contra um teto de ${moeda(linha.teto)} — ${moeda(Math.abs(linha.restante))} acima.`,
        acao: { rotulo: 'Rever orçamento', href: '/configuracoes' },
      });
    } else if (linha.situacao === 'perto') {
      insights.push({
        id: `orcamento-perto-${linha.categoria.id}`,
        nivel: 'neutro',
        titulo: `${linha.categoria.nome} já consumiu ${linha.percentual.toFixed(0)}% do teto`,
        detalhe: `Restam ${moeda(linha.restante)} dos ${moeda(linha.teto)} reservados para este mês.`,
        acao: { rotulo: 'Ver orçamento', href: '/dashboard' },
      });
    }
  }

  /* 3b. Todos os tetos respeitados — só faz sentido dizer se existe teto definido. */
  if (orcamentos.length && orcamentos.every((l) => l.situacao === 'dentro')) {
    insights.push({
      id: 'orcamento-em-dia',
      nivel: 'positivo',
      titulo: 'Você está dentro do orçamento deste mês',
      detalhe: `As ${orcamentos.length} categorias com teto definido seguem abaixo do limite. Sobram ${moeda(
        somar(orcamentos, (l) => l.restante),
      )} no total.`,
    });
  }

  /* 3c. Onde o dinheiro está concentrado */
  const porCategoria = gastoPorCategoria(estado.transacoes, estado.categorias, comp);
  const maior = porCategoria.find((l) => l.categoria && l.total > 0);
  if (maior?.categoria && mes.despesas > 0) {
    insights.push({
      id: 'maior-categoria',
      nivel: 'neutro',
      titulo: `Sua maior categoria de gastos foi ${maior.categoria.nome}`,
      detalhe: `${moeda(maior.total)} em ${maior.quantidade} ${
        maior.quantidade === 1 ? 'lançamento' : 'lançamentos'
      } — ${maior.participacao.toFixed(0)}% de tudo que saiu no mês.`,
      acao: { rotulo: 'Ver lançamentos', href: '/financas' },
    });
  }

  /* 4. Conta variável fora da média */
  for (const rec of estado.recorrencias.filter((r) => r.natureza === 'variavel' && r.ativa)) {
    const { desvio, media, ultimo, amostras } = mediaDaVariavel(rec, estado.transacoes);
    if (desvio === null || ultimo === null || amostras < 3) continue;
    if (desvio > 25) {
      insights.push({
        id: `variavel-${rec.id}`,
        nivel: 'atencao',
        titulo: `${rec.nome} veio ${percentual(desvio, 0)} acima da média`,
        detalhe: `A última cobrança foi ${moeda(ultimo)}, contra uma média de ${moeda(media)} nos últimos ${amostras} meses.`,
        acao: { rotulo: 'Ver contas variáveis', href: '/contas' },
      });
    }
  }

  /* 5. Vencimentos nos próximos 7 dias */
  const proximos = estado.transacoes
    .filter((t) => t.status !== 'pago' && t.tipo === 'despesa')
    .map((t) => ({ t, d: distanciaEmDias(t.data) }))
    .filter(({ d }) => d.dias >= 0 && d.dias <= 7);

  if (proximos.length) {
    const total = somar(proximos, ({ t }) => t.valor);
    insights.push({
      id: 'vencimentos',
      nivel: 'neutro',
      titulo: `${proximos.length} ${proximos.length === 1 ? 'conta vence' : 'contas vencem'} nos próximos 7 dias`,
      detalhe: `Somam ${moeda(total)}. A mais próxima é ${proximos[0].t.descricao}, ${proximos[0].d.texto}.`,
      acao: { rotulo: 'Ver contas a pagar', href: '/contas' },
    });
  }

  /* 6. Lançamentos atrasados */
  const atrasados = estado.transacoes.filter(
    (t) => t.status !== 'pago' && t.tipo === 'despesa' && t.data < hojeISO(),
  );
  if (atrasados.length) {
    insights.push({
      id: 'atrasados',
      nivel: 'critico',
      titulo: `${atrasados.length} ${atrasados.length === 1 ? 'conta está atrasada' : 'contas estão atrasadas'}`,
      detalhe: `Total de ${moeda(somar(atrasados, (t) => t.valor))} vencido. Juros e multa costumam entrar a partir do primeiro dia.`,
      acao: { rotulo: 'Resolver agora', href: '/financas' },
    });
  }

  /* 7. Limite de cartão comprometido */
  for (const cartao of estado.cartoes.filter((c) => !c.arquivado && c.tipo !== 'debito')) {
    const usado = limiteUsado(cartao, estado.transacoes);
    const uso = cartao.limite > 0 ? (usado / cartao.limite) * 100 : 0;
    if (uso >= 70) {
      insights.push({
        id: `limite-${cartao.id}`,
        nivel: uso >= 90 ? 'critico' : 'atencao',
        titulo: `${cartao.nome} está com ${uso.toFixed(0)}% do limite comprometido`,
        detalhe: `${moeda(usado)} de ${moeda(cartao.limite)}, contando as parcelas que ainda vão cair.`,
        acao: { rotulo: 'Abrir cartões', href: '/cartoes' },
      });
    }
  }

  /* 8. Fatura próxima do vencimento */
  for (const cartao of estado.cartoes.filter((c) => !c.arquivado && c.tipo !== 'debito')) {
    const fatura = faturaDoCartao(cartao, estado.transacoes, comp);
    const d = distanciaEmDias(fatura.vencimento);
    if (fatura.total > 0 && d.dias >= 0 && d.dias <= 5) {
      insights.push({
        id: `fatura-${cartao.id}`,
        nivel: 'neutro',
        titulo: `Fatura do ${cartao.nome} vence ${d.texto}`,
        detalhe: `Valor fechado de ${moeda(fatura.total)}.`,
        acao: { rotulo: 'Ver fatura', href: '/cartoes' },
      });
    }
  }

  /* 9. Peso das assinaturas */
  const assinaturasAtivas = estado.assinaturas.filter((a) => a.ativa);
  const totalAssinaturas = somar(assinaturasAtivas, (a) => a.valor);
  if (mes.receitas > 0 && totalAssinaturas / mes.receitas > 0.08) {
    insights.push({
      id: 'assinaturas',
      nivel: 'atencao',
      titulo: `Assinaturas consomem ${((totalAssinaturas / mes.receitas) * 100).toFixed(0)}% da sua renda`,
      detalhe: `${assinaturasAtivas.length} cobranças recorrentes somam ${moeda(totalAssinaturas)} por mês, ou ${moeda(totalAssinaturas * 12)} no ano.`,
      acao: { rotulo: 'Revisar assinaturas', href: '/cartoes' },
    });
  }

  /* 10. Dívidas com juros altos */
  const caras = estado.dividas.filter((d) => d.status !== 'quitada' && d.jurosMes >= 8);
  if (caras.length) {
    const pior = caras.sort((a, b) => b.jurosMes - a.jurosMes)[0];
    insights.push({
      id: 'divida-cara',
      nivel: 'critico',
      titulo: `${pior.credor} cobra ${pior.jurosMes.toFixed(1)}% ao mês`,
      detalhe: `Isso equivale a ${((Math.pow(1 + pior.jurosMes / 100, 12) - 1) * 100).toFixed(0)}% ao ano. Priorizar essa dívida economiza mais do que qualquer investimento renderia.`,
      acao: { rotulo: 'Simular quitação', href: '/dividas' },
    });
  }

  /* 11. Reserva de emergência */
  const patrimonio = patrimonioLiquido(estado);
  const mediaDespesas =
    somar([0, 1, 2].map((i) => resumoDoMes(estado.transacoes, i === 0 ? comp : mesAnterior(comp)).despesas), (v) => v) / 3;
  if (mediaDespesas > 0) {
    const meses = patrimonio.contas / mediaDespesas;
    if (meses < 3) {
      insights.push({
        id: 'reserva-curta',
        nivel: 'atencao',
        titulo: `Sua reserva cobre ${meses.toFixed(1)} ${meses < 2 ? 'mês' : 'meses'} de despesas`,
        detalhe: `Com ${moeda(patrimonio.contas)} em conta e um custo mensal de ${moeda(mediaDespesas)}. O piso recomendado é de três meses.`,
        acao: { rotulo: 'Criar meta de reserva', href: '/metas' },
      });
    }
  }

  /* 12. Metas em risco de prazo */
  for (const meta of estado.metas.filter((m) => !m.concluida)) {
    const p = progressoMeta(meta);
    if (p.atrasada) {
      insights.push({
        id: `meta-atrasada-${meta.id}`,
        nivel: 'atencao',
        titulo: `A meta "${meta.nome}" passou do prazo`,
        detalhe: `Faltam ${moeda(p.falta)} para fechar. Vale remarcar a data ou revisar o valor.`,
        acao: { rotulo: 'Ajustar meta', href: '/metas' },
      });
    } else if (p.mesesRestantes > 0 && p.mesesRestantes <= 3 && p.percentual < 60) {
      insights.push({
        id: `meta-risco-${meta.id}`,
        nivel: 'neutro',
        titulo: `"${meta.nome}" precisa de ${moeda(p.aporteMensal)} por mês`,
        detalhe: `Faltam ${p.mesesRestantes} ${p.mesesRestantes === 1 ? 'mês' : 'meses'} e ${moeda(p.falta)} para chegar lá.`,
        acao: { rotulo: 'Fazer um aporte', href: '/metas' },
      });
    }
  }

  const ordem = { critico: 0, atencao: 1, neutro: 2, positivo: 3 } as const;
  return insights.sort((a, b) => ordem[a.nivel] - ordem[b.nivel]);
}

/** Recorrências que vencem no mês e ainda não foram pagas. */
export function lembretesDoMes(estado: EstadoFinanceiro, comp: string) {
  return estado.recorrencias
    .filter((r) => recorrenciaVenceNoMes(r, comp) && r.tipo === 'despesa')
    .map((rec) => {
      const lancamento = estado.transacoes.find((t) => t.recorrenciaId === rec.id && t.data.startsWith(comp));
      const data = lancamento?.data ?? `${comp}-${`${rec.diaVencimento}`.padStart(2, '0')}`;
      return {
        recorrencia: rec,
        lancamento,
        data,
        pago: lancamento?.status === 'pago',
        distancia: distanciaEmDias(data),
      };
    })
    .sort((a, b) => a.data.localeCompare(b.data));
}
