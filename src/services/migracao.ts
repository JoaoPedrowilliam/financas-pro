import { getSupabase } from '@/lib/supabase/cliente';
import { ErroDeDados, usuarioAtual } from './base';
import { servicoDividas } from './dividas';
import { CHAVE_PERSISTENCIA } from '@/store/chaves';
import {
  assinaturaParaLinha, ativoParaLinha, cartaoParaLinha, categoriaParaLinha,
  contaParaLinha, dividaParaLinha, metaParaLinha, perfilParaLinha,
  recorrenciaParaLinha, transacaoParaLinha,
} from '@/lib/supabase/mapear';
import type { EstadoFinanceiro } from '@/types';

/**
 * Migração do localStorage para o Supabase.
 *
 * Princípios que valem mais que velocidade aqui:
 *
 * · NADA é apagado. O localStorage continua intacto depois da migração; é a
 *   única cópia dos dados da pessoa até o banco confirmar, e serve de resgate
 *   se algo der errado depois.
 *
 * · Idempotente. A marca em `migracoes_local` é gravada só no fim e nunca pode
 *   ser apagada pelo cliente (não há policy de delete). Rodar de novo não
 *   duplica.
 *
 * · Ordem de dependência. Categorias antes de transações, contas antes de
 *   cartões — senão a chave estrangeira recusa a linha.
 *
 * · Os ids são preservados. O app sempre gerou crypto.randomUUID(), então os
 *   relacionamentos continuam válidos sem nenhum remapeamento.
 */

export interface DadosLocais {
  estado: EstadoFinanceiro;
  /** Quantos registros serão enviados. Mostrado antes de confirmar. */
  registros: number;
  versao: number;
}

/** Quantos registros um estado carrega, sem contar o perfil. */
function contar(e: EstadoFinanceiro): number {
  return (
    e.categorias.length + e.contas.length + e.cartoes.length + e.recorrencias.length +
    e.transacoes.length + e.assinaturas.length + e.ativos.length + e.metas.length +
    e.dividas.length + e.dividas.reduce((s, d) => s + (d.pagamentos?.length ?? 0), 0)
  );
}

/**
 * Procura dados do Zustand no localStorage e valida o formato.
 * Devolve `null` quando não há nada aproveitável — navegador novo, por exemplo.
 */
export function lerDadosLocais(): DadosLocais | null {
  if (typeof window === 'undefined') return null;

  let bruto: string | null = null;
  try {
    bruto = window.localStorage.getItem(CHAVE_PERSISTENCIA);
  } catch {
    return null; // Armazenamento bloqueado pelo navegador.
  }
  if (!bruto) return null;

  try {
    const pacote = JSON.parse(bruto);
    // O middleware persist do Zustand grava { state, version }.
    const estado = (pacote?.state ?? pacote) as EstadoFinanceiro;

    const listas = ['categorias', 'contas', 'cartoes', 'transacoes'] as const;
    if (listas.some((c) => !Array.isArray(estado?.[c]))) return null;

    // Normaliza as listas que podem faltar em estados antigos.
    const completo: EstadoFinanceiro = {
      perfil: estado.perfil ?? {
        nome: '', email: '', moeda: 'BRL', inicioMesFinanceiro: 1, ocultarValores: false,
      },
      categorias: estado.categorias ?? [],
      contas: estado.contas ?? [],
      cartoes: estado.cartoes ?? [],
      transacoes: estado.transacoes ?? [],
      recorrencias: estado.recorrencias ?? [],
      assinaturas: estado.assinaturas ?? [],
      ativos: estado.ativos ?? [],
      metas: estado.metas ?? [],
      dividas: estado.dividas ?? [],
      recorrenciasGeradas: estado.recorrenciasGeradas ?? [],
    };

    const registros = contar(completo);
    if (registros === 0) return null;

    return { estado: completo, registros, versao: Number(pacote?.version ?? 1) };
  } catch {
    return null;
  }
}

/** A conta já importou dados alguma vez? */
export async function jaMigrou(): Promise<boolean> {
  const usuario_id = await usuarioAtual();
  const { data, error } = await getSupabase()
    .from('migracoes_local')
    .select('usuario_id')
    .eq('usuario_id', usuario_id)
    .maybeSingle();

  if (error) throw new ErroDeDados('migracoes_local', 'consultar', error);
  return Boolean(data);
}

/** A conta já tem dados? Migrar por cima duplicaria tudo. */
export async function contaVazia(): Promise<boolean> {
  const sb = getSupabase();
  const [contas, transacoes] = await Promise.all([
    sb.from('contas').select('id', { count: 'exact', head: true }),
    sb.from('transacoes').select('id', { count: 'exact', head: true }),
  ]);
  return (contas.count ?? 0) === 0 && (transacoes.count ?? 0) === 0;
}

export interface ResultadoMigracao {
  ok: boolean;
  registros: number;
  etapa?: string;
  erro?: string;
}

/**
 * Envia o estado local para o Supabase, em ordem de dependência.
 *
 * Se qualquer etapa falhar, para ali e devolve o erro com o nome da etapa. O
 * que já entrou permanece — e a marca de conclusão NÃO é gravada, então a
 * pessoa pode corrigir e tentar de novo. Como o localStorage continua intacto,
 * nada se perde nesse meio-tempo.
 */
export async function migrarParaSupabase(
  estado: EstadoFinanceiro,
  /**
   * Gravar a marca de "localStorage já importado" ao final.
   *
   * Verdadeiro só na migração de verdade. A importação de backup e a
   * restauração da demo reutilizam este mesmo caminho de gravação, mas não
   * podem carimbar a marca: ela é única por usuário e serve para impedir que a
   * importação automática rode duas vezes.
   */
  marcarConcluida = true,
): Promise<ResultadoMigracao> {
  const sb = getSupabase();
  const usuario_id = await usuarioAtual();
  let enviados = 0;

  const gravar = async (
    etapa: string,
    tabela: string,
    linhas: Record<string, unknown>[],
  ): Promise<string | null> => {
    if (!linhas.length) return null;
    const comDono = linhas.map((l) => ({ ...l, usuario_id }));
    for (let i = 0; i < comDono.length; i += 500) {
      const { error } = await sb.from(tabela).insert(comDono.slice(i, i + 500));
      if (error) return error.message;
    }
    enviados += linhas.length;
    return null;
  };

  // A ordem abaixo é a ordem das chaves estrangeiras. Não reordene.
  const etapas: { nome: string; tabela: string; linhas: Record<string, unknown>[] }[] = [
    {
      nome: 'categorias',
      tabela: 'categorias',
      // Mães primeiro: a auto-relação pai_id exige a linha da mãe existindo.
      linhas: [...estado.categorias]
        .sort((a, b) => Number(Boolean(a.paiId)) - Number(Boolean(b.paiId)))
        .map((c) => ({ ...categoriaParaLinha(c), id: c.id })),
    },
    {
      nome: 'contas',
      tabela: 'contas',
      linhas: estado.contas.map((c) => ({ ...contaParaLinha(c), id: c.id })),
    },
    {
      nome: 'cartões',
      tabela: 'cartoes',
      linhas: estado.cartoes.map((c) => ({ ...cartaoParaLinha(c), id: c.id })),
    },
    {
      nome: 'recorrências',
      tabela: 'recorrencias',
      linhas: estado.recorrencias.map((r) => ({ ...recorrenciaParaLinha(r), id: r.id })),
    },
    {
      nome: 'lançamentos',
      tabela: 'transacoes',
      linhas: estado.transacoes.map((t) => ({ ...transacaoParaLinha(t), id: t.id })),
    },
    {
      nome: 'assinaturas',
      tabela: 'assinaturas',
      linhas: estado.assinaturas.map((a) => ({ ...assinaturaParaLinha(a), id: a.id })),
    },
    {
      nome: 'investimentos',
      tabela: 'ativos',
      linhas: estado.ativos.map((a) => ({ ...ativoParaLinha(a), id: a.id })),
    },
    {
      nome: 'metas',
      tabela: 'metas',
      linhas: estado.metas.map((m) => ({ ...metaParaLinha(m), id: m.id })),
    },
    {
      nome: 'dívidas',
      tabela: 'dividas',
      linhas: estado.dividas.map((d) => ({ ...dividaParaLinha(d), id: d.id })),
    },
  ];

  for (const etapa of etapas) {
    const erro = await gravar(etapa.nome, etapa.tabela, etapa.linhas);
    if (erro) return { ok: false, registros: enviados, etapa: etapa.nome, erro };
  }

  // Pagamentos saem de dentro das dívidas; por isso vêm depois delas.
  const pagamentos = estado.dividas.flatMap((d) =>
    (d.pagamentos ?? []).map((p) => ({
      id: p.id,
      divida_id: d.id,
      data: p.data,
      valor: p.valor,
      observacao: p.observacao ?? null,
    })),
  );
  if (pagamentos.length) {
    try {
      enviados += await servicoDividas.criarPagamentos(pagamentos);
    } catch (falha) {
      return {
        ok: false,
        registros: enviados,
        etapa: 'pagamentos de dívida',
        erro: falha instanceof Error ? falha.message : String(falha),
      };
    }
  }

  // Competências já geradas, para a automação não recriar lançamentos antigos.
  if (estado.recorrenciasGeradas.length) {
    const { error } = await sb.from('competencias_geradas').upsert(
      estado.recorrenciasGeradas.map((competencia) => ({ usuario_id, competencia })),
      { onConflict: 'usuario_id,competencia', ignoreDuplicates: true },
    );
    if (error) {
      return { ok: false, registros: enviados, etapa: 'competências', erro: error.message };
    }
  }

  // Perfil: atualiza a linha que o trigger já criou.
  const linhaPerfil = perfilParaLinha(estado.perfil);
  if (Object.keys(linhaPerfil).length) {
    const { error } = await sb.from('perfis').update(linhaPerfil).eq('id', usuario_id);
    if (error) return { ok: false, registros: enviados, etapa: 'perfil', erro: error.message };
  }

  // Só agora a migração é marcada como concluída. Antes disso, uma falha deixa
  // a porta aberta para tentar outra vez.
  if (marcarConcluida) {
    const { error: erroMarca } = await sb
      .from('migracoes_local')
      .insert({ usuario_id, origem: 'localStorage', registros: enviados });

    if (erroMarca) {
      return { ok: false, registros: enviados, etapa: 'marcar conclusão', erro: erroMarca.message };
    }
  }

  return { ok: true, registros: enviados };
}

/**
 * Importa um arquivo de backup (.json) para a conta autenticada.
 *
 * Segunda estratégia de migração, como pede a Etapa 8: quem usa outro
 * navegador ou já limpou o localStorage pode exportar de lá e importar aqui.
 * Reutiliza exatamente o mesmo caminho de gravação.
 */
export async function importarBackup(estado: EstadoFinanceiro): Promise<ResultadoMigracao> {
  // `false`: importar um backup não é "o localStorage foi migrado". Carimbar a
  // marca aqui bloquearia a migração real depois.
  return migrarParaSupabase(estado, false);
}
