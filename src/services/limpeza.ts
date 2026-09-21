import { getSupabase } from '@/lib/supabase/cliente';
import { ErroDeDados, usuarioAtual } from './base';

/**
 * Apaga todos os dados financeiros da conta autenticada.
 *
 * Usado por "Apagar todos os dados" e como primeiro passo de "Restaurar
 * demonstração". Só alcança as linhas do próprio usuário: o filtro é explícito
 * e o RLS recusaria o resto de qualquer forma.
 *
 * A ordem é a inversa das chaves estrangeiras. Mesmo com `on delete cascade` e
 * `set null` cobrindo a maior parte, apagar de trás para frente evita depender
 * do comportamento de cascata para saber o que sobrou.
 *
 * O que NÃO é apagado:
 *  · o perfil — a conta continua existindo, só fica sem dados;
 *  · a marca em `migracoes_local` — apagá-la faria a importação do localStorage
 *    rodar de novo e ressuscitar tudo que a pessoa acabou de excluir;
 *  · o localStorage antigo — continua intocado no navegador.
 */
export async function apagarTudoDoUsuario(): Promise<void> {
  const usuario_id = await usuarioAtual();
  const sb = getSupabase();

  const ordem = [
    'pagamentos_divida',
    'anexos',
    'transacoes',
    'assinaturas',
    'recorrencias',
    'dividas',
    'metas',
    'ativos',
    'cartoes',
    'contas',
    'categorias',
    'competencias_geradas',
  ];

  for (const tabela of ordem) {
    const { error } = await sb.from(tabela).delete().eq('usuario_id', usuario_id);
    if (error) throw new ErroDeDados(tabela, 'apagar', error);
  }
}
