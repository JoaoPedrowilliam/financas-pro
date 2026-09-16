import { getSupabase } from '@/lib/supabase/cliente';
import { criarServico, ErroDeDados, usuarioAtual } from './base';
import { dividaDeLinha, dividaParaLinha, pagamentoDeLinha } from '@/lib/supabase/mapear';
import { arredondar } from '@/lib/financas';
import type { Divida, PagamentoDivida } from '@/types';

/**
 * Dívidas e seus pagamentos.
 *
 * `pagamentos` saiu de dentro do registro e virou tabela própria. A leitura
 * remonta a lista aninhada que o domínio espera, para que nenhuma tela precise
 * mudar.
 *
 * Registrar pagamento continua com a MESMA regra de antes (abate o saldo, zera
 * a negativação quando quita, decrementa parcelas). O cálculo foi copiado do
 * store, não reescrito: mudar a aritmética aqui mexeria no saldo devedor real
 * das pessoas.
 */

const base = criarServico<Divida>('dividas', (l) => dividaDeLinha(l), {
  coluna: 'criado_em',
  crescente: true,
});

export const servicoDividas = {
  criar: base.criar,
  atualizar: base.atualizar,
  excluir: base.excluir,
  criarVarios: base.criarVarios,

  /** Traz as dívidas com os pagamentos já aninhados, como o domínio espera. */
  async listar(): Promise<Divida[]> {
    const sb = getSupabase();

    const [{ data: dividas, error: erroD }, { data: pagamentos, error: erroP }] = await Promise.all([
      sb.from('dividas').select('*').order('criado_em', { ascending: true }),
      sb.from('pagamentos_divida').select('*').order('data', { ascending: true }),
    ]);

    if (erroD) throw new ErroDeDados('dividas', 'listar', erroD);
    if (erroP) throw new ErroDeDados('pagamentos_divida', 'listar', erroP);

    const porDivida = new Map<string, PagamentoDivida[]>();
    for (const linha of pagamentos ?? []) {
      const chave = linha.divida_id as string;
      const lista = porDivida.get(chave) ?? [];
      lista.push(pagamentoDeLinha(linha));
      porDivida.set(chave, lista);
    }

    return (dividas ?? []).map((l) => dividaDeLinha(l, porDivida.get(l.id as string) ?? []));
  },

  /**
   * Registra um pagamento e abate o saldo, na mesma ordem do store original.
   *
   * São duas escritas sem transação — o PostgREST não expõe transação entre
   * chamadas. Se a segunda falhar, o pagamento fica gravado e o saldo não
   * baixa; por isso o erro é propagado para a interface avisar, em vez de
   * mostrar sucesso. O saldo pode ser corrigido editando a dívida.
   */
  async registrarPagamento(
    divida: Divida,
    pagamento: Omit<PagamentoDivida, 'id'>,
  ): Promise<Divida> {
    const usuario_id = await usuarioAtual();
    const sb = getSupabase();

    const { error: erroPagamento } = await sb.from('pagamentos_divida').insert({
      usuario_id,
      divida_id: divida.id,
      data: pagamento.data,
      valor: pagamento.valor,
      observacao: pagamento.observacao ?? null,
    });
    if (erroPagamento) throw new ErroDeDados('pagamentos_divida', 'registrar', erroPagamento);

    // Mesma aritmética do store: arredonda em centavos e nunca deixa negativo.
    const saldo = Math.max(0, arredondar(divida.saldoAtual - pagamento.valor));

    const { data, error } = await sb
      .from('dividas')
      .update({
        saldo_atual: saldo,
        status: saldo <= 0 ? 'quitada' : divida.status,
        negativado: saldo <= 0 ? false : divida.negativado,
        parcelas_restantes: divida.parcelasRestantes
          ? Math.max(0, divida.parcelasRestantes - 1)
          : null,
      })
      .eq('id', divida.id)
      .select()
      .single();

    if (error) throw new ErroDeDados('dividas', 'abater saldo', error);

    return dividaDeLinha(data, [
      ...divida.pagamentos,
      { ...pagamento, id: crypto.randomUUID() },
    ]);
  },

  /** Usado pela migração: grava os pagamentos que vinham aninhados no JSON. */
  async criarPagamentos(linhas: Record<string, unknown>[]): Promise<number> {
    if (!linhas.length) return 0;
    const usuario_id = await usuarioAtual();
    const { error } = await getSupabase()
      .from('pagamentos_divida')
      .insert(linhas.map((l) => ({ ...l, usuario_id })));
    if (error) throw new ErroDeDados('pagamentos_divida', 'criar em lote', error);
    return linhas.length;
  },
};

export { dividaParaLinha };
