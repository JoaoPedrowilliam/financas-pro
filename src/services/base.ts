import { getSupabase, mensagemDeErro } from '@/lib/supabase/cliente';

/**
 * Base dos serviços de dados.
 *
 * Existe para que as dez entidades não repitam o mesmo CRUD dez vezes, e para
 * concentrar num lugar só duas decisões que valem para todas elas:
 *
 * · `usuario_id` é preenchido aqui, nunca pelo componente. Mesmo com o RLS
 *   barrando escrita alheia, deixar o dono como responsabilidade de quem chama
 *   convida a esquecer — e o erro apareceria como "permissão negada" no lugar
 *   mais confuso possível.
 *
 * · erro nunca vira silêncio. Se o banco recusou, o serviço lança. Quem chama
 *   decide o que mostrar, mas ninguém consegue exibir "salvo" sem ter salvo.
 */

/** Erro de persistência com mensagem já legível para a interface. */
export class ErroDeDados extends Error {
  readonly operacao: string;
  readonly tabela: string;

  constructor(tabela: string, operacao: string, causa: unknown) {
    super(mensagemDeErro(causa));
    this.name = 'ErroDeDados';
    this.tabela = tabela;
    this.operacao = operacao;
  }
}

/** Id do usuário autenticado. Lança se não houver sessão. */
export async function usuarioAtual(): Promise<string> {
  const { data, error } = await getSupabase().auth.getUser();
  if (error || !data.user) {
    throw new Error('Sessão expirada. Entre novamente para continuar.');
  }
  return data.user.id;
}

type Linha = Record<string, unknown>;

export interface Servico<T> {
  listar(): Promise<T[]>;
  criar(dados: Linha): Promise<T>;
  atualizar(id: string, dados: Linha): Promise<T>;
  excluir(id: string): Promise<void>;
  /** Grava várias linhas de uma vez. Usado pela migração e pela importação. */
  criarVarios(linhas: Linha[]): Promise<number>;
}

export function criarServico<T>(
  tabela: string,
  deLinha: (l: Linha) => T,
  ordem: { coluna: string; crescente?: boolean } = { coluna: 'criado_em', crescente: false },
): Servico<T> {
  return {
    async listar() {
      const { data, error } = await getSupabase()
        .from(tabela)
        .select('*')
        .order(ordem.coluna, { ascending: ordem.crescente ?? true });

      if (error) throw new ErroDeDados(tabela, 'listar', error);
      return (data ?? []).map(deLinha);
    },

    async criar(dados) {
      const usuario_id = await usuarioAtual();
      const { data, error } = await getSupabase()
        .from(tabela)
        .insert({ ...dados, usuario_id })
        .select()
        .single();

      if (error) throw new ErroDeDados(tabela, 'criar', error);
      return deLinha(data);
    },

    async atualizar(id, dados) {
      // usuario_id nunca é atualizável: trocá-lo transferiria a linha para
      // outra conta. O RLS recusaria, mas é melhor nem tentar.
      const { usuario_id: _ignorado, id: _idIgnorado, ...seguro } = dados;

      const { data, error } = await getSupabase()
        .from(tabela)
        .update(seguro)
        .eq('id', id)
        .select()
        .single();

      if (error) throw new ErroDeDados(tabela, 'atualizar', error);
      return deLinha(data);
    },

    async excluir(id) {
      const { error } = await getSupabase().from(tabela).delete().eq('id', id);
      if (error) throw new ErroDeDados(tabela, 'excluir', error);
    },

    async criarVarios(linhas) {
      if (!linhas.length) return 0;
      const usuario_id = await usuarioAtual();
      const comDono = linhas.map((l) => ({ ...l, usuario_id }));

      // Lotes de 500: o PostgREST tem limite de payload, e uma carteira com
      // anos de histórico passa disso com folga.
      let gravados = 0;
      for (let i = 0; i < comDono.length; i += 500) {
        const lote = comDono.slice(i, i + 500);
        const { error } = await getSupabase().from(tabela).insert(lote);
        if (error) throw new ErroDeDados(tabela, 'criar em lote', error);
        gravados += lote.length;
      }
      return gravados;
    },
  };
}
