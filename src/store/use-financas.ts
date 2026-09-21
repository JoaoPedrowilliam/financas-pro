'use client';

import { create } from 'zustand';
import type {
  Ativo, Assinatura, Cartao, Categoria, Conta, Divida, EstadoFinanceiro,
  Meta, PagamentoDivida, Perfil, Recorrencia, Transacao,
} from '@/types';
import { ESTADO_VAZIO } from './seed';
import { competenciaDe, diaSeguro, hojeISO, uid } from '@/lib/utils';
import { recorrenciaVenceNoMes } from '@/lib/financas';
import { carregarEstado, garantirCategorias } from '@/services/carregar';
import { servicoPerfil } from '@/services/perfil';
import { servicoCategorias } from '@/services/categorias';
import { servicoContas } from '@/services/contas';
import { servicoCartoes } from '@/services/cartoes';
import { servicoRecorrencias } from '@/services/recorrencias';
import { servicoAssinaturas } from '@/services/assinaturas';
import { servicoTransacoes } from '@/services/transacoes';
import { servicoAtivos } from '@/services/ativos';
import { servicoMetas } from '@/services/metas';
import { servicoDividas } from '@/services/dividas';
import {
  assinaturaParaLinha, ativoParaLinha, cartaoParaLinha, categoriaParaLinha,
  contaParaLinha, dividaParaLinha, metaParaLinha, recorrenciaParaLinha,
  transacaoParaLinha,
} from '@/lib/supabase/mapear';

/**
 * Estado da aplicação.
 *
 * O que mudou nesta versão: o Supabase passou a ser a fonte persistente, e este
 * store virou cache de interface. O middleware `persist` foi removido —
 * mantê-lo faria o localStorage competir com o banco pela verdade, e numa
 * divergência ninguém saberia qual dos dois está certo.
 *
 * A chave antiga (`financas-pro:v1`) NÃO é apagada. Ela continua no navegador
 * como cópia dos dados anteriores até a migração confirmar, e é de onde
 * services/migracao.ts lê.
 *
 * Toda ação de escrita fala com o banco primeiro e só então atualiza o estado
 * local. É mais lento que otimismo, e é de propósito: nenhuma tela pode dizer
 * "salvo" antes de estar salvo.
 */

// Reexportada para não quebrar quem já importava daqui (lib/exportar.ts).
export { CHAVE_PERSISTENCIA } from './chaves';

type Novo<T> = Omit<T, 'id' | 'criadoEm'>;

interface Acoes {
  /* ciclo de vida */
  carregarDoServidor: () => Promise<void>;
  limparSessao: () => void;

  /* transações */
  addTransacao: (dados: Novo<Transacao> & { parcelas?: number }) => Promise<void>;
  updateTransacao: (id: string, mudancas: Partial<Transacao>) => Promise<void>;
  removeTransacao: (id: string) => Promise<void>;
  removeGrupoParcelas: (grupoId: string) => Promise<void>;
  alternarStatus: (id: string) => Promise<void>;

  /* cadastros */
  addConta: (dados: Novo<Conta>) => Promise<void>;
  updateConta: (id: string, mudancas: Partial<Conta>) => Promise<void>;
  removeConta: (id: string) => Promise<void>;

  addCartao: (dados: Novo<Cartao>) => Promise<void>;
  updateCartao: (id: string, mudancas: Partial<Cartao>) => Promise<void>;
  removeCartao: (id: string) => Promise<void>;

  addCategoria: (dados: Omit<Categoria, 'id'>) => Promise<void>;
  updateCategoria: (id: string, mudancas: Partial<Categoria>) => Promise<void>;
  removeCategoria: (id: string) => Promise<void>;

  addRecorrencia: (dados: Novo<Recorrencia>) => Promise<void>;
  updateRecorrencia: (id: string, mudancas: Partial<Recorrencia>) => Promise<void>;
  removeRecorrencia: (id: string) => Promise<void>;
  gerarLancamentosDoMes: (comp: string) => Promise<number>;

  addAssinatura: (dados: Novo<Assinatura>) => Promise<void>;
  updateAssinatura: (id: string, mudancas: Partial<Assinatura>) => Promise<void>;
  removeAssinatura: (id: string) => Promise<void>;

  addAtivo: (dados: Novo<Ativo>) => Promise<void>;
  updateAtivo: (id: string, mudancas: Partial<Ativo>) => Promise<void>;
  removeAtivo: (id: string) => Promise<void>;
  aplicarCotacoes: (cotacoes: Record<string, { preco: number; dividendYield?: number }>) => Promise<void>;

  addMeta: (dados: Novo<Meta>) => Promise<void>;
  updateMeta: (id: string, mudancas: Partial<Meta>) => Promise<void>;
  removeMeta: (id: string) => Promise<void>;
  aportarNaMeta: (id: string, valor: number) => Promise<void>;

  addDivida: (dados: Novo<Divida>) => Promise<void>;
  updateDivida: (id: string, mudancas: Partial<Divida>) => Promise<void>;
  removeDivida: (id: string) => Promise<void>;
  registrarPagamento: (dividaId: string, pagamento: Omit<PagamentoDivida, 'id'>) => Promise<void>;

  /* sistema */
  updatePerfil: (mudancas: Partial<Perfil>) => Promise<void>;
  alternarOcultarValores: () => Promise<void>;
  restaurarDemo: () => Promise<void>;
  limparTudo: () => Promise<void>;
}

export type StoreFinancas = EstadoFinanceiro & Acoes & {
  /** Primeira carga concluída (com ou sem dados). */
  hidratado: boolean;
  /** Busca em andamento. */
  carregando: boolean;
  /** Falha na última carga. A interface oferece "tentar de novo". */
  erro: string | null;
};

const texto = (falha: unknown) =>
  falha instanceof Error ? falha.message : 'Não foi possível concluir a operação.';

export const useFinancas = create<StoreFinancas>()((set, get) => ({
  ...ESTADO_VAZIO,
  hidratado: false,
  carregando: false,
  erro: null,

  /* ─────────────────────── ciclo de vida ─────────────────────── */

  carregarDoServidor: async () => {
    set({ carregando: true, erro: null });
    try {
      // Conta nova recebe o plano de categorias; sem ele o formulário de
      // lançamento abre sem saída, como acontecia na versão local.
      await garantirCategorias();
      const estado = await carregarEstado();
      set({ ...estado, hidratado: true, carregando: false, erro: null });
    } catch (falha) {
      // Não marca `hidratado`: a tela mostra o erro com opção de recarregar,
      // em vez de fingir uma carteira vazia que não é a da pessoa.
      set({ carregando: false, erro: texto(falha) });
    }
  },

  /** Ao sair, zera o cache para que a próxima conta não veja dados da anterior. */
  limparSessao: () => set({ ...ESTADO_VAZIO, hidratado: false, carregando: false, erro: null }),

  /* ─────────────────────────── Transações ─────────────────────────── */

  addTransacao: async ({ parcelas, ...dados }) => {
    const criadas = await servicoTransacoes.criar(dados, parcelas);
    set((s) => ({ transacoes: [...criadas, ...s.transacoes] }));
  },

  updateTransacao: async (id, mudancas) => {
    const atualizada = await servicoTransacoes.atualizar(id, transacaoParaLinha(mudancas));
    set((s) => ({ transacoes: s.transacoes.map((t) => (t.id === id ? atualizada : t)) }));
  },

  removeTransacao: async (id) => {
    await servicoTransacoes.excluir(id);
    set((s) => ({ transacoes: s.transacoes.filter((t) => t.id !== id) }));
  },

  removeGrupoParcelas: async (grupoId) => {
    await servicoTransacoes.excluirGrupoParcelas(grupoId);
    set((s) => ({ transacoes: s.transacoes.filter((t) => t.parcela?.grupoId !== grupoId) }));
  },

  alternarStatus: async (id) => {
    const atual = get().transacoes.find((t) => t.id === id);
    if (!atual) return;
    const atualizada = await servicoTransacoes.alternarStatus(id, atual.status);
    set((s) => ({ transacoes: s.transacoes.map((t) => (t.id === id ? atualizada : t)) }));
  },

  /* ───────────────────────────── Contas ───────────────────────────── */

  addConta: async (dados) => {
    const nova = await servicoContas.criar(contaParaLinha(dados as Conta));
    set((s) => ({ contas: [...s.contas, nova] }));
  },

  updateConta: async (id, m) => {
    const atualizada = await servicoContas.atualizar(id, contaParaLinha(m));
    set((s) => ({ contas: s.contas.map((c) => (c.id === id ? atualizada : c)) }));
  },

  removeConta: async (id) => {
    await servicoContas.excluir(id);
    // O banco zera os vínculos por `on delete set null`. Recarregar é a forma
    // de o estado local refletir esses efeitos colaterais sem recalculá-los
    // à mão — e sem arriscar divergir do que ficou gravado.
    await get().carregarDoServidor();
  },

  /* ───────────────────────────── Cartões ──────────────────────────── */

  addCartao: async (dados) => {
    const novo = await servicoCartoes.criar(cartaoParaLinha(dados as Cartao));
    set((s) => ({ cartoes: [...s.cartoes, novo] }));
  },

  updateCartao: async (id, m) => {
    const atualizado = await servicoCartoes.atualizar(id, cartaoParaLinha(m));
    set((s) => ({ cartoes: s.cartoes.map((c) => (c.id === id ? atualizado : c)) }));
  },

  removeCartao: async (id) => {
    await servicoCartoes.excluir(id);
    await get().carregarDoServidor();
  },

  /* ──────────────────────────── Categorias ────────────────────────── */

  addCategoria: async (dados) => {
    const nova = await servicoCategorias.criar(categoriaParaLinha(dados as Categoria));
    set((s) => ({ categorias: [...s.categorias, nova] }));
  },

  updateCategoria: async (id, m) => {
    const atualizada = await servicoCategorias.atualizar(id, categoriaParaLinha(m));
    set((s) => ({ categorias: s.categorias.map((c) => (c.id === id ? atualizada : c)) }));
  },

  removeCategoria: async (id) => {
    await servicoCategorias.excluir(id);
    // Subcategorias sobem de nível e lançamentos ficam sem categoria, pelo
    // `on delete set null`. Recarrega para refletir os dois efeitos.
    await get().carregarDoServidor();
  },

  /* ─────────────────────────── Recorrências ───────────────────────── */

  addRecorrencia: async (dados) => {
    const nova = await servicoRecorrencias.criar(recorrenciaParaLinha(dados as Recorrencia));
    set((s) => ({ recorrencias: [...s.recorrencias, nova] }));
  },

  updateRecorrencia: async (id, m) => {
    const atualizada = await servicoRecorrencias.atualizar(id, recorrenciaParaLinha(m));
    set((s) => ({ recorrencias: s.recorrencias.map((r) => (r.id === id ? atualizada : r)) }));
  },

  removeRecorrencia: async (id) => {
    await servicoRecorrencias.excluir(id);
    await get().carregarDoServidor();
  },

  /**
   * Gera os lançamentos previstos da competência.
   *
   * A regra de quais recorrências vencem no mês continua sendo a de
   * `recorrenciaVenceNoMes` — não foi reescrita. O que mudou é a garantia de
   * não duplicar: agora é a constraint única (recorrencia_id, competencia) no
   * banco, e não uma conferência otimista que duas abas abertas driblariam.
   */
  gerarLancamentosDoMes: async (comp) => {
    const { recorrencias, assinaturas, transacoes } = get();
    const [ano, mes] = comp.split('-').map(Number);
    const linhas: Record<string, unknown>[] = [];

    for (const rec of recorrencias) {
      if (!recorrenciaVenceNoMes(rec, comp)) continue;
      linhas.push({
        ...transacaoParaLinha({
          tipo: rec.tipo,
          descricao: rec.nome,
          valor: rec.valorPrevisto,
          data: diaSeguro(ano, mes, rec.diaVencimento),
          categoriaId: rec.categoriaId,
          contaId: rec.contaId,
          cartaoId: rec.cartaoId ?? null,
          status: 'pendente',
          observacao:
            rec.natureza === 'variavel' ? 'Valor estimado — confirme quando a conta chegar.' : undefined,
          etiquetas: [rec.natureza === 'fixa' ? 'conta fixa' : 'conta variável'],
          recorrenciaId: rec.id,
        }),
        id: uid(),
      });
    }

    // Assinaturas não têm coluna de vínculo; a etiqueta marcadora continua
    // sendo o que evita repetir a cobrança, como na versão local.
    for (const ass of assinaturas) {
      if (!ass.ativa) continue;
      const marcador = `assinatura:${ass.id}`;
      const jaExiste = transacoes.some(
        (t) => t.etiquetas.includes(marcador) && t.data.startsWith(comp),
      );
      if (jaExiste) continue;
      linhas.push({
        ...transacaoParaLinha({
          tipo: 'despesa',
          descricao: ass.nome,
          valor: ass.valor,
          data: diaSeguro(ano, mes, ass.diaCobranca),
          categoriaId: ass.categoriaId,
          contaId: null,
          cartaoId: ass.cartaoId,
          status: 'pendente',
          etiquetas: ['assinatura', marcador],
        }),
        id: uid(),
      });
    }

    const criados = await servicoTransacoes.gerarDoMes(linhas, comp);
    if (criados > 0) await get().carregarDoServidor();
    else set((s) => ({ recorrenciasGeradas: Array.from(new Set([...s.recorrenciasGeradas, comp])) }));
    return criados;
  },

  /* ─────────────────────────── Assinaturas ───────────────────────── */

  addAssinatura: async (dados) => {
    const nova = await servicoAssinaturas.criar(assinaturaParaLinha(dados as Assinatura));
    set((s) => ({ assinaturas: [...s.assinaturas, nova] }));
  },

  updateAssinatura: async (id, m) => {
    const atualizada = await servicoAssinaturas.atualizar(id, assinaturaParaLinha(m));
    set((s) => ({ assinaturas: s.assinaturas.map((a) => (a.id === id ? atualizada : a)) }));
  },

  removeAssinatura: async (id) => {
    await servicoAssinaturas.excluir(id);
    set((s) => ({ assinaturas: s.assinaturas.filter((a) => a.id !== id) }));
  },

  /* ────────────────────────── Investimentos ──────────────────────── */

  addAtivo: async (dados) => {
    const novo = await servicoAtivos.criar(ativoParaLinha(dados as Ativo));
    set((s) => ({ ativos: [...s.ativos, novo] }));
  },

  updateAtivo: async (id, m) => {
    const atualizado = await servicoAtivos.atualizar(id, ativoParaLinha(m));
    set((s) => ({ ativos: s.ativos.map((a) => (a.id === id ? atualizado : a)) }));
  },

  removeAtivo: async (id) => {
    await servicoAtivos.excluir(id);
    set((s) => ({ ativos: s.ativos.filter((a) => a.id !== id) }));
  },

  aplicarCotacoes: async (cotacoes) => {
    const ativos = get().ativos;
    await servicoAtivos.aplicarCotacoes(cotacoes, ativos);
    const agora = new Date().toISOString();
    set({
      ativos: ativos.map((a) => {
        const c = cotacoes[a.ticker.toUpperCase()];
        if (!c) return a;
        return {
          ...a,
          precoAtual: c.preco,
          dividendYield: c.dividendYield ?? a.dividendYield,
          atualizadoEm: agora,
        };
      }),
    });
  },

  /* ──────────────────────────────  Metas ─────────────────────────── */

  addMeta: async (dados) => {
    const nova = await servicoMetas.criar(metaParaLinha(dados as Meta));
    set((s) => ({ metas: [...s.metas, nova] }));
  },

  updateMeta: async (id, m) => {
    const atualizada = await servicoMetas.atualizar(id, metaParaLinha(m));
    set((s) => ({ metas: s.metas.map((x) => (x.id === id ? atualizada : x)) }));
  },

  removeMeta: async (id) => {
    await servicoMetas.excluir(id);
    set((s) => ({ metas: s.metas.filter((m) => m.id !== id) }));
  },

  aportarNaMeta: async (id, valor) => {
    const meta = get().metas.find((m) => m.id === id);
    if (!meta) return;
    // Mesma regra de antes: nunca negativo, conclui ao atingir o alvo.
    const atual = Math.max(0, meta.valorAtual + valor);
    const atualizada = await servicoMetas.atualizar(id, {
      valor_atual: atual,
      concluida: atual >= meta.valorAlvo,
    });
    set((s) => ({ metas: s.metas.map((m) => (m.id === id ? atualizada : m)) }));
  },

  /* ────────────────────────────── Dívidas ────────────────────────── */

  addDivida: async (dados) => {
    const nova = await servicoDividas.criar(dividaParaLinha(dados as Divida));
    set((s) => ({ dividas: [...s.dividas, { ...nova, pagamentos: [] }] }));
  },

  updateDivida: async (id, m) => {
    const atualizada = await servicoDividas.atualizar(id, dividaParaLinha(m));
    set((s) => ({
      dividas: s.dividas.map((d) =>
        d.id === id ? { ...atualizada, pagamentos: d.pagamentos } : d,
      ),
    }));
  },

  removeDivida: async (id) => {
    await servicoDividas.excluir(id);
    set((s) => ({ dividas: s.dividas.filter((d) => d.id !== id) }));
  },

  registrarPagamento: async (dividaId, pagamento) => {
    const divida = get().dividas.find((d) => d.id === dividaId);
    if (!divida) return;
    const atualizada = await servicoDividas.registrarPagamento(divida, pagamento);
    set((s) => ({ dividas: s.dividas.map((d) => (d.id === dividaId ? atualizada : d)) }));
  },

  /* ─────────────────────────────── Sistema ───────────────────────── */

  updatePerfil: async (m) => {
    await servicoPerfil.atualizar(m);
    set((s) => ({ perfil: { ...s.perfil, ...m } }));
  },

  alternarOcultarValores: async () => {
    const novo = !get().perfil.ocultarValores;
    // Atualiza a tela primeiro: é preferência de exibição, não dado financeiro,
    // e esperar a rede para esconder um valor seria estranho de usar.
    set((s) => ({ perfil: { ...s.perfil, ocultarValores: novo } }));
    try {
      await servicoPerfil.atualizar({ ocultarValores: novo });
    } catch {
      set((s) => ({ perfil: { ...s.perfil, ocultarValores: !novo } }));
    }
  },

  restaurarDemo: async () => {
    const { gerarSeed } = await import('./seed');
    const { importarBackup } = await import('@/services/migracao');
    await get().limparTudo();
    const resultado = await importarBackup(gerarSeed());
    if (!resultado.ok) throw new Error(resultado.erro ?? 'Falha ao carregar a demonstração.');
    await get().carregarDoServidor();
  },

  limparTudo: async () => {
    const { apagarTudoDoUsuario } = await import('@/services/limpeza');
    await apagarTudoDoUsuario();
    await get().carregarDoServidor();
  },
}));

/** Seletor auxiliar: evita re-render de tela inteira ao mexer numa lista só. */
export const seletores = {
  contasAtivas: (s: StoreFinancas) => s.contas.filter((c) => !c.arquivada),
  cartoesAtivos: (s: StoreFinancas) => s.cartoes.filter((c) => !c.arquivado),
  categoriasAtivas: (s: StoreFinancas) => s.categorias.filter((c) => !c.arquivada),
  dividasAbertas: (s: StoreFinancas) => s.dividas.filter((d) => d.status !== 'quitada'),
};
