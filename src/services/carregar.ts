import { getSupabase } from '@/lib/supabase/cliente';
import { ErroDeDados, usuarioAtual } from './base';
import { servicoPerfil } from './perfil';
import { servicoCategorias } from './categorias';
import { servicoContas } from './contas';
import { servicoCartoes } from './cartoes';
import { servicoRecorrencias } from './recorrencias';
import { servicoAssinaturas } from './assinaturas';
import { servicoTransacoes } from './transacoes';
import { servicoAtivos } from './ativos';
import { servicoMetas } from './metas';
import { servicoDividas } from './dividas';
import { categoriasPadrao } from '@/store/seed';
import { categoriaParaLinha } from '@/lib/supabase/mapear';
import type { EstadoFinanceiro } from '@/types';

/**
 * Carrega o estado financeiro inteiro do usuário autenticado.
 *
 * Tudo em paralelo: são dez consultas independentes, e encadeá-las somaria dez
 * latências de rede numa tela que a pessoa está esperando abrir.
 *
 * O formato devolvido é exatamente o `EstadoFinanceiro` que o app já usava.
 * Nenhuma tela, nenhum cálculo de financas.ts e nenhum gráfico precisa saber
 * que a origem mudou de localStorage para Postgres.
 */
export async function carregarEstado(): Promise<EstadoFinanceiro> {
  const [
    perfil, categorias, contas, cartoes, recorrencias,
    assinaturas, transacoes, ativos, metas, dividas, recorrenciasGeradas,
  ] = await Promise.all([
    servicoPerfil.carregar(),
    servicoCategorias.listar(),
    servicoContas.listar(),
    servicoCartoes.listar(),
    servicoRecorrencias.listar(),
    servicoAssinaturas.listar(),
    servicoTransacoes.listar(),
    servicoAtivos.listar(),
    servicoMetas.listar(),
    servicoDividas.listar(),
    servicoTransacoes.competenciasGeradas(),
  ]);

  return {
    perfil, categorias, contas, cartoes, transacoes,
    recorrencias, assinaturas, ativos, metas, dividas, recorrenciasGeradas,
  };
}

/**
 * Instala as categorias padrão numa conta que ainda não tem nenhuma.
 *
 * Mesma razão do store local: sem categoria, o formulário de lançamento abre
 * sem saída. Aqui a condição é verificada no banco, então rodar duas vezes não
 * duplica nada.
 *
 * Note que isto NÃO carrega a carteira de exemplo. Semear dados financeiros
 * falsos num banco real obrigaria a pessoa a apagá-los um a um; a demo continua
 * disponível sob demanda em Configurações.
 */
export async function garantirCategorias(): Promise<number> {
  const { count, error } = await getSupabase()
    .from('categorias')
    .select('id', { count: 'exact', head: true });

  if (error) throw new ErroDeDados('categorias', 'contar', error);
  if ((count ?? 0) > 0) return 0;

  const usuario_id = await usuarioAtual();
  const linhas = categoriasPadrao().map((c) => ({ ...categoriaParaLinha(c), usuario_id }));

  const { error: erroInsert } = await getSupabase().from('categorias').insert(linhas);
  if (erroInsert) throw new ErroDeDados('categorias', 'semear padrão', erroInsert);
  return linhas.length;
}
