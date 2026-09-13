'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  Ativo, Assinatura, Cartao, Categoria, Conta, Divida, EstadoFinanceiro,
  Meta, PagamentoDivida, Perfil, Recorrencia, Transacao,
} from '@/types';
import { ESTADO_VAZIO, categoriasPadrao, gerarSeed } from './seed';
import { competenciaDe, diaSeguro, hojeISO, uid } from '@/lib/utils';
import { gerarParcelas, recorrenciaVenceNoMes } from '@/lib/financas';

export const CHAVE_PERSISTENCIA = 'financas-pro:v1';

type Novo<T> = Omit<T, 'id' | 'criadoEm'>;

interface Acoes {
  /* transações */
  addTransacao: (dados: Novo<Transacao> & { parcelas?: number }) => void;
  updateTransacao: (id: string, mudancas: Partial<Transacao>) => void;
  removeTransacao: (id: string) => void;
  /** Remove todas as parcelas de uma compra parcelada. */
  removeGrupoParcelas: (grupoId: string) => void;
  alternarStatus: (id: string) => void;

  /* cadastros */
  addConta: (dados: Novo<Conta>) => void;
  updateConta: (id: string, mudancas: Partial<Conta>) => void;
  removeConta: (id: string) => void;

  addCartao: (dados: Novo<Cartao>) => void;
  updateCartao: (id: string, mudancas: Partial<Cartao>) => void;
  removeCartao: (id: string) => void;

  addCategoria: (dados: Omit<Categoria, 'id'>) => void;
  updateCategoria: (id: string, mudancas: Partial<Categoria>) => void;
  removeCategoria: (id: string) => void;

  addRecorrencia: (dados: Novo<Recorrencia>) => void;
  updateRecorrencia: (id: string, mudancas: Partial<Recorrencia>) => void;
  removeRecorrencia: (id: string) => void;
  /** Cria os lançamentos previstos da competência informada. Idempotente. */
  gerarLancamentosDoMes: (comp: string) => number;

  addAssinatura: (dados: Novo<Assinatura>) => void;
  updateAssinatura: (id: string, mudancas: Partial<Assinatura>) => void;
  removeAssinatura: (id: string) => void;

  addAtivo: (dados: Novo<Ativo>) => void;
  updateAtivo: (id: string, mudancas: Partial<Ativo>) => void;
  removeAtivo: (id: string) => void;
  aplicarCotacoes: (cotacoes: Record<string, { preco: number; dividendYield?: number }>) => void;

  addMeta: (dados: Novo<Meta>) => void;
  updateMeta: (id: string, mudancas: Partial<Meta>) => void;
  removeMeta: (id: string) => void;
  aportarNaMeta: (id: string, valor: number) => void;

  addDivida: (dados: Novo<Divida>) => void;
  updateDivida: (id: string, mudancas: Partial<Divida>) => void;
  removeDivida: (id: string) => void;
  registrarPagamento: (dividaId: string, pagamento: Omit<PagamentoDivida, 'id'>) => void;

  /* sistema */
  updatePerfil: (mudancas: Partial<Perfil>) => void;
  alternarOcultarValores: () => void;
  /**
   * Sinaliza que a leitura do localStorage terminou.
   * Precisa ser uma ação do próprio store: o `localStorage` é síncrono, então o
   * zustand hidrata DURANTE o `create()` — a constante `useFinancas` ainda não
   * existe nesse instante, e chamá-la ali lança ReferenceError.
   */
  marcarHidratado: () => void;
  importar: (estado: EstadoFinanceiro) => void;
  restaurarDemo: () => void;
  limparTudo: () => void;
}

export type StoreFinancas = EstadoFinanceiro & Acoes & { hidratado: boolean };

const marcar = <T extends object>(dados: T) => ({ ...dados, id: uid(), criadoEm: hojeISO() });

/**
 * v1 → v2: troca as cores azul/roxo que o seed antigo distribuía pela paleta atual.
 *
 * Regras que tornam isso seguro:
 * - só reescreve `cor`, e só quando o valor bate EXATAMENTE com um padrão antigo;
 *   qualquer cor escolhida à mão fica como está;
 * - nenhum campo de valor, data, status ou vínculo é tocado;
 * - qualquer falha devolve o estado intacto — cor é cosmético, dado financeiro não.
 */
const CORES_LEGADAS: Record<'categorias' | 'metas' | 'contas' | 'cartoes', Record<string, string>> = {
  categorias: {
    '#3B82F6': '#404040', // Moradia / Aluguel
    '#60A5FA': '#737373', // Luz, água e internet
    '#8B5CF6': '#0F766E', // Transporte
    '#EC4899': '#BE123C', // Saúde
    '#06B6D4': '#15803D', // Lazer
    '#A855F7': '#3F3F46', // Assinaturas
  },
  metas: { '#0EA5E9': '#16A34A' },
  contas: { '#8B5CF6': '#820AD1', '#0EA5E9': '#0070AF' },
  cartoes: { '#7C3AED': '#2A2A2A', '#F97316': '#7C2D12' },
};

function migrarCores(persistido: unknown): EstadoFinanceiro {
  const estado = persistido as EstadoFinanceiro;
  try {
    const trocar = <T extends { cor: string }>(itens: T[] | undefined, mapa: Record<string, string>) =>
      (itens ?? []).map((item) =>
        mapa[item.cor?.toUpperCase?.()] ? { ...item, cor: mapa[item.cor.toUpperCase()] } : item,
      );

    return {
      ...estado,
      categorias: trocar(estado.categorias, CORES_LEGADAS.categorias),
      metas: trocar(estado.metas, CORES_LEGADAS.metas),
      contas: trocar(estado.contas, CORES_LEGADAS.contas),
      cartoes: trocar(estado.cartoes, CORES_LEGADAS.cartoes),
    };
  } catch (falha) {
    console.error('Migração de cores ignorada; os dados seguem como estavam:', falha);
    return estado;
  }
}

export const useFinancas = create<StoreFinancas>()(
  persist(
    (set, get) => ({
      ...ESTADO_VAZIO,
      hidratado: false,

      /* ─── Transações ─── */
      addTransacao: ({ parcelas, ...dados }) => {
        // Compra parcelada vira N lançamentos ligados por um grupoId.
        if (parcelas && parcelas > 1) {
          const grupoId = uid();
          const partes = gerarParcelas(dados.valor, parcelas, dados.data);
          const novas: Transacao[] = partes.map((p) => ({
            ...(dados as Omit<Transacao, 'id' | 'criadoEm'>),
            id: uid(),
            criadoEm: hojeISO(),
            valor: p.valor,
            data: p.data,
            descricao: `${dados.descricao} (${p.numero}/${parcelas})`,
            status: p.numero === 1 ? dados.status : 'pendente',
            parcela: { numero: p.numero, total: parcelas, grupoId },
          }));
          set((s) => ({ transacoes: [...novas, ...s.transacoes] }));
          return;
        }
        set((s) => ({ transacoes: [marcar(dados) as Transacao, ...s.transacoes] }));
      },

      updateTransacao: (id, mudancas) =>
        set((s) => ({ transacoes: s.transacoes.map((t) => (t.id === id ? { ...t, ...mudancas } : t)) })),

      removeTransacao: (id) => set((s) => ({ transacoes: s.transacoes.filter((t) => t.id !== id) })),

      removeGrupoParcelas: (grupoId) =>
        set((s) => ({ transacoes: s.transacoes.filter((t) => t.parcela?.grupoId !== grupoId) })),

      alternarStatus: (id) =>
        set((s) => ({
          transacoes: s.transacoes.map((t) =>
            t.id === id ? { ...t, status: t.status === 'pago' ? 'pendente' : 'pago' } : t,
          ),
        })),

      /* ─── Contas ─── */
      addConta: (dados) => set((s) => ({ contas: [...s.contas, marcar(dados) as Conta] })),
      updateConta: (id, m) => set((s) => ({ contas: s.contas.map((c) => (c.id === id ? { ...c, ...m } : c)) })),
      removeConta: (id) =>
        set((s) => ({
          contas: s.contas.filter((c) => c.id !== id),
          // Lançamentos órfãos continuam existindo, apenas sem conta vinculada.
          transacoes: s.transacoes.map((t) =>
            t.contaId === id ? { ...t, contaId: null } : t.contaDestinoId === id ? { ...t, contaDestinoId: null } : t,
          ),
        })),

      /* ─── Cartões ─── */
      addCartao: (dados) => set((s) => ({ cartoes: [...s.cartoes, marcar(dados) as Cartao] })),
      updateCartao: (id, m) => set((s) => ({ cartoes: s.cartoes.map((c) => (c.id === id ? { ...c, ...m } : c)) })),
      removeCartao: (id) =>
        set((s) => ({
          cartoes: s.cartoes.filter((c) => c.id !== id),
          assinaturas: s.assinaturas.map((a) => (a.cartaoId === id ? { ...a, cartaoId: null } : a)),
          transacoes: s.transacoes.map((t) => (t.cartaoId === id ? { ...t, cartaoId: null } : t)),
        })),

      /* ─── Categorias ─── */
      addCategoria: (dados) => set((s) => ({ categorias: [...s.categorias, { ...dados, id: uid() }] })),
      updateCategoria: (id, m) =>
        set((s) => ({ categorias: s.categorias.map((c) => (c.id === id ? { ...c, ...m } : c)) })),
      removeCategoria: (id) =>
        set((s) => ({
          // Subcategorias sobem um nível em vez de sumirem junto.
          categorias: s.categorias
            .filter((c) => c.id !== id)
            .map((c) => (c.paiId === id ? { ...c, paiId: null } : c)),
          transacoes: s.transacoes.map((t) => (t.categoriaId === id ? { ...t, categoriaId: null } : t)),
        })),

      /* ─── Recorrências ─── */
      addRecorrencia: (dados) => set((s) => ({ recorrencias: [...s.recorrencias, marcar(dados) as Recorrencia] })),
      updateRecorrencia: (id, m) =>
        set((s) => ({ recorrencias: s.recorrencias.map((r) => (r.id === id ? { ...r, ...m } : r)) })),
      removeRecorrencia: (id) =>
        set((s) => ({
          recorrencias: s.recorrencias.filter((r) => r.id !== id),
          transacoes: s.transacoes.map((t) => (t.recorrenciaId === id ? { ...t, recorrenciaId: null } : t)),
        })),

      gerarLancamentosDoMes: (comp) => {
        const { recorrencias, assinaturas, transacoes } = get();
        const [ano, mes] = comp.split('-').map(Number);
        const novos: Transacao[] = [];

        for (const rec of recorrencias) {
          if (!recorrenciaVenceNoMes(rec, comp)) continue;
          const jaExiste = transacoes.some((t) => t.recorrenciaId === rec.id && t.data.startsWith(comp));
          if (jaExiste) continue;
          novos.push({
            id: uid(), tipo: rec.tipo, descricao: rec.nome, valor: rec.valorPrevisto,
            data: diaSeguro(ano, mes, rec.diaVencimento),
            categoriaId: rec.categoriaId, contaId: rec.contaId, cartaoId: rec.cartaoId ?? null,
            status: 'pendente',
            observacao: rec.natureza === 'variavel' ? 'Valor estimado — confirme quando a conta chegar.' : undefined,
            etiquetas: [rec.natureza === 'fixa' ? 'conta fixa' : 'conta variável'],
            anexos: [], recorrenciaId: rec.id, criadoEm: hojeISO(),
          });
        }

        for (const ass of assinaturas) {
          if (!ass.ativa) continue;
          const marcador = `assinatura:${ass.id}`;
          const jaExiste = transacoes.some((t) => t.etiquetas.includes(marcador) && t.data.startsWith(comp));
          if (jaExiste) continue;
          novos.push({
            id: uid(), tipo: 'despesa', descricao: ass.nome, valor: ass.valor,
            data: diaSeguro(ano, mes, ass.diaCobranca),
            categoriaId: ass.categoriaId, contaId: null, cartaoId: ass.cartaoId,
            status: 'pendente', etiquetas: ['assinatura', marcador], anexos: [], criadoEm: hojeISO(),
          });
        }

        if (novos.length) {
          set((s) => ({
            transacoes: [...novos, ...s.transacoes],
            recorrenciasGeradas: Array.from(new Set([...s.recorrenciasGeradas, comp])),
          }));
        } else {
          set((s) => ({ recorrenciasGeradas: Array.from(new Set([...s.recorrenciasGeradas, comp])) }));
        }
        return novos.length;
      },

      /* ─── Assinaturas ─── */
      addAssinatura: (dados) => set((s) => ({ assinaturas: [...s.assinaturas, marcar(dados) as Assinatura] })),
      updateAssinatura: (id, m) =>
        set((s) => ({ assinaturas: s.assinaturas.map((a) => (a.id === id ? { ...a, ...m } : a)) })),
      removeAssinatura: (id) => set((s) => ({ assinaturas: s.assinaturas.filter((a) => a.id !== id) })),

      /* ─── Investimentos ─── */
      addAtivo: (dados) => set((s) => ({ ativos: [...s.ativos, marcar(dados) as Ativo] })),
      updateAtivo: (id, m) => set((s) => ({ ativos: s.ativos.map((a) => (a.id === id ? { ...a, ...m } : a)) })),
      removeAtivo: (id) => set((s) => ({ ativos: s.ativos.filter((a) => a.id !== id) })),
      aplicarCotacoes: (cotacoes) =>
        set((s) => ({
          ativos: s.ativos.map((a) => {
            const c = cotacoes[a.ticker.toUpperCase()];
            if (!c) return a;
            return {
              ...a,
              precoAtual: c.preco,
              dividendYield: c.dividendYield ?? a.dividendYield,
              atualizadoEm: new Date().toISOString(),
            };
          }),
        })),

      /* ─── Metas ─── */
      addMeta: (dados) => set((s) => ({ metas: [...s.metas, marcar(dados) as Meta] })),
      updateMeta: (id, m) => set((s) => ({ metas: s.metas.map((x) => (x.id === id ? { ...x, ...m } : x)) })),
      removeMeta: (id) => set((s) => ({ metas: s.metas.filter((m) => m.id !== id) })),
      aportarNaMeta: (id, valor) =>
        set((s) => ({
          metas: s.metas.map((m) => {
            if (m.id !== id) return m;
            const atual = Math.max(0, m.valorAtual + valor);
            return { ...m, valorAtual: atual, concluida: atual >= m.valorAlvo };
          }),
        })),

      /* ─── Dívidas ─── */
      addDivida: (dados) => set((s) => ({ dividas: [...s.dividas, marcar(dados) as Divida] })),
      updateDivida: (id, m) => set((s) => ({ dividas: s.dividas.map((d) => (d.id === id ? { ...d, ...m } : d)) })),
      removeDivida: (id) => set((s) => ({ dividas: s.dividas.filter((d) => d.id !== id) })),
      registrarPagamento: (dividaId, pagamento) =>
        set((s) => ({
          dividas: s.dividas.map((d) => {
            if (d.id !== dividaId) return d;
            const saldo = Math.max(0, Math.round((d.saldoAtual - pagamento.valor) * 100) / 100);
            return {
              ...d,
              saldoAtual: saldo,
              status: saldo <= 0 ? 'quitada' : d.status,
              negativado: saldo <= 0 ? false : d.negativado,
              parcelasRestantes: d.parcelasRestantes ? Math.max(0, d.parcelasRestantes - 1) : undefined,
              pagamentos: [...d.pagamentos, { ...pagamento, id: uid() }],
            };
          }),
        })),

      /* ─── Sistema ─── */
      updatePerfil: (m) => set((s) => ({ perfil: { ...s.perfil, ...m } })),
      alternarOcultarValores: () =>
        set((s) => ({ perfil: { ...s.perfil, ocultarValores: !s.perfil.ocultarValores } })),
      marcarHidratado: () => set({ hidratado: true }),
      importar: (estado) => set({ ...estado }),
      restaurarDemo: () => set({ ...gerarSeed() }),
      /**
       * Apaga lançamentos, contas, cartões e cadastros — mas repõe o plano de
       * categorias. Sem categoria nenhuma o formulário de lançamento abre com um
       * campo vazio e sem saída, e o sistema fica inutilizável depois da limpeza.
       */
      limparTudo: () => set({ ...ESTADO_VAZIO, categorias: categoriasPadrao(), perfil: get().perfil }),
    }),
    {
      name: CHAVE_PERSISTENCIA,
      storage: createJSONStorage(() => localStorage),
      version: 2,
      migrate: migrarCores,
      partialize: ({ hidratado: _ignorado, ...resto }) => resto,
      onRehydrateStorage: () => (estado, erro) => {
        if (erro) console.error('Falha ao ler os dados salvos:', erro);
        if (!estado) return;
        try {
          // Primeira visita: carrega a demo em vez de abrir uma tela vazia.
          if (!estado.contas.length && !estado.transacoes.length) {
            estado.importar(gerarSeed());
          } else if (!estado.categorias.length) {
            // Quem apagou tudo numa versão anterior ficou sem categoria alguma e
            // sem como criar lançamento. Repõe o plano padrão sem tocar no resto.
            estado.importar({ ...estado, categorias: categoriasPadrao() });
          }
          estado.gerarLancamentosDoMes(
            competenciaDe(new Date().getFullYear(), new Date().getMonth() + 1),
          );
        } catch (falha) {
          // Semear é conveniência, não requisito. Se falhar, a interface abre
          // vazia — nunca presa num esqueleto infinito.
          console.error('Não foi possível preparar os dados iniciais:', falha);
        } finally {
          estado.marcarHidratado();
        }
      },
    },
  ),
);

/** Seletor auxiliar: evita re-render de tela inteira ao mexer numa lista só. */
export const seletores = {
  contasAtivas: (s: StoreFinancas) => s.contas.filter((c) => !c.arquivada),
  cartoesAtivos: (s: StoreFinancas) => s.cartoes.filter((c) => !c.arquivado),
  categoriasAtivas: (s: StoreFinancas) => s.categorias.filter((c) => !c.arquivada),
  dividasAbertas: (s: StoreFinancas) => s.dividas.filter((d) => d.status !== 'quitada'),
};
