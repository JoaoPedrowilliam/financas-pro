import {
  LayoutDashboard, ArrowLeftRight, Receipt, CreditCard, LineChart,
  Scale, Target, FileBarChart, Settings2,
  type LucideIcon,
} from 'lucide-react';

export interface ItemNav {
  href: string;
  rotulo: string;
  icone: LucideIcon;
  /** Resumo curto usado no tooltip da sidebar recolhida. */
  resumo: string;
}

export interface GrupoNav {
  titulo: string;
  itens: ItemNav[];
}

/**
 * A navegação é agrupada por intenção, não por ordem alfabética:
 * primeiro o que a pessoa olha todo dia, depois o que ela revisa de vez em quando.
 */
export const NAVEGACAO: GrupoNav[] = [
  {
    titulo: 'Dia a dia',
    itens: [
      { href: '/dashboard', rotulo: 'Dashboard', icone: LayoutDashboard, resumo: 'Visão geral do mês' },
      { href: '/financas', rotulo: 'Finanças', icone: ArrowLeftRight, resumo: 'Receitas, despesas e transferências' },
      { href: '/contas', rotulo: 'Contas', icone: Receipt, resumo: 'Fixas, variáveis e vencimentos' },
      { href: '/cartoes', rotulo: 'Cartões', icone: CreditCard, resumo: 'Faturas, limites e assinaturas' },
    ],
  },
  {
    titulo: 'Patrimônio',
    itens: [
      { href: '/investimentos', rotulo: 'Investimentos', icone: LineChart, resumo: 'Carteira e cotações' },
      { href: '/dividas', rotulo: 'Dívidas', icone: Scale, resumo: 'Plano para limpar seu nome' },
      { href: '/metas', rotulo: 'Metas', icone: Target, resumo: 'Objetivos e aportes' },
    ],
  },
  {
    titulo: 'Sistema',
    itens: [
      { href: '/relatorios', rotulo: 'Relatórios', icone: FileBarChart, resumo: 'Comparativos e exportação' },
      { href: '/configuracoes', rotulo: 'Configurações', icone: Settings2, resumo: 'Perfil, backup e segurança' },
    ],
  },
];

export const TODOS_ITENS = NAVEGACAO.flatMap((g) => g.itens);
