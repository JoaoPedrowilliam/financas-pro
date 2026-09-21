import { getSupabase } from '@/lib/supabase/cliente';
import { criarServico, ErroDeDados, usuarioAtual } from './base';
import { transacaoDeLinha, transacaoParaLinha } from '@/lib/supabase/mapear';
import { gerarParcelas } from '@/lib/financas';
import { uid } from '@/lib/utils';
import type { Transacao } from '@/types';

/**
 * Lançamentos — a entidade mais movimentada do sistema.
 *
 * O que muda em relação ao store local: parcelamento e geração de recorrências
 * deixam de ser "várias escritas em sequência" e passam a ser um insert único
 * em lote. Se o lote falhar, nenhuma parcela entra — antes, uma falha no meio
 * deixaria a compra pela metade.
 */

const base = criarServico<Transacao>('transacoes', transacaoDeLinha, {
  coluna: 'data',
  crescente: false,
});

export const servicoTransacoes = {
  listar: base.listar,
  atualizar: base.atualizar,
  excluir: base.excluir,
  criarVarios: base.criarVarios,

  /**
   * Cria um lançamento ou, quando `parcelas > 1`, a compra parcelada inteira.
   * A divisão de centavos continua sendo a de gerarParcelas() — não foi
   * reimplementada aqui para que o valor total nunca divirja do que o sistema
   * mostrava antes.
   */
  async criar(dados: Omit<Transacao, 'id' | 'criadoEm'>, parcelas?: number): Promise<Transacao[]> {
    const usuario_id = await usuarioAtual();

    if (parcelas && parcelas > 1) {
      const grupoId = uid();
      const partes = gerarParcelas(dados.valor, parcelas, dados.data);

      const linhas = partes.map((p) => ({
        ...transacaoParaLinha({
          ...dados,
          valor: p.valor,
          data: p.data,
          descricao: `${dados.descricao} (${p.numero}/${parcelas})`,
          status: p.numero === 1 ? dados.status : 'pendente',
          parcela: { numero: p.numero, total: parcelas, grupoId },
        }),
        id: uid(),
        usuario_id,
      }));

      const { data, error } = await getSupabase().from('transacoes').insert(linhas).select();
      if (error) throw new ErroDeDados('transacoes', 'criar parcelas', error);
      return (data ?? []).map(transacaoDeLinha);
    }

    const { data, error } = await getSupabase()
      .from('transacoes')
      .insert({ ...transacaoParaLinha(dados), id: uid(), usuario_id })
      .select()
      .single();

    if (error) throw new ErroDeDados('transacoes', 'criar', error);
    return [transacaoDeLinha(data)];
  },

  /** Apaga todas as parcelas de uma compra de uma vez. */
  async excluirGrupoParcelas(grupoId: string): Promise<void> {
    const { error } = await getSupabase()
      .from('transacoes')
      .delete()
      .eq('parcela_grupo_id', grupoId);
    if (error) throw new ErroDeDados('transacoes', 'excluir parcelas', error);
  },

  /** Alterna pago ↔ pendente. Devolve o registro já com o status novo. */
  async alternarStatus(id: string, statusAtual: Transacao['status']): Promise<Transacao> {
    const novo = statusAtual === 'pago' ? 'pendente' : 'pago';
    return base.atualizar(id, { status: novo });
  },

  /**
   * Gera os lançamentos previstos de uma competência.
   *
   * A idempotência não depende mais de conferir antes de gravar. O índice único
   * (recorrencia_id, competência) recusa a duplicata no banco, então duas abas
   * abertas ao mesmo tempo não conseguem criar o mesmo lançamento duas vezes —
   * coisa que a checagem otimista do store local não garantia.
   *
   * `ignoreDuplicates` faz o Postgres descartar o que já existe em vez de
   * abortar o lote inteiro.
   */
  async gerarDoMes(linhas: Record<string, unknown>[], competencia: string): Promise<number> {
    const usuario_id = await usuarioAtual();
    const sb = getSupabase();

    let criados = 0;
    if (linhas.length) {
      const { data, error } = await sb
        .from('transacoes')
        .upsert(
          linhas.map((l) => ({ ...l, usuario_id })),
          { onConflict: 'recorrencia_id,competencia', ignoreDuplicates: true },
        )
        .select();

      if (error) throw new ErroDeDados('transacoes', 'gerar do mês', error);
      criados = data?.length ?? 0;
    }

    // Marca a competência como processada. Insert idempotente pela PK composta.
    const { error: erroMarca } = await sb
      .from('competencias_geradas')
      .upsert({ usuario_id, competencia }, { onConflict: 'usuario_id,competencia', ignoreDuplicates: true });

    if (erroMarca) throw new ErroDeDados('competencias_geradas', 'marcar', erroMarca);
    return criados;
  },

  /** Competências que já tiveram a geração automática executada. */
  async competenciasGeradas(): Promise<string[]> {
    const { data, error } = await getSupabase()
      .from('competencias_geradas')
      .select('competencia');
    if (error) throw new ErroDeDados('competencias_geradas', 'listar', error);
    return (data ?? []).map((l) => l.competencia as string);
  },
};

export { transacaoParaLinha };
