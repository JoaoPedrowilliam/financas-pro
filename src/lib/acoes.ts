'use client';

import * as React from 'react';
import { toast } from 'sonner';

/**
 * Execução de uma ação que fala com o banco.
 *
 * Existe por causa de uma regra que a versão local não precisava respeitar:
 * agora a gravação pode falhar. Antes, `addConta(...)` seguido de
 * `toast.success('Conta cadastrada')` era verdade por construção — a escrita
 * era síncrona e em memória. Com rede no meio, esse par vira mentira sempre que
 * a conexão cai.
 *
 * Aqui o sucesso só aparece depois que a promessa resolve, e a falha mostra o
 * motivo real em vez de um "erro" genérico. Quem chama recebe `false` e mantém
 * o formulário aberto com o que a pessoa digitou.
 */
export async function executarAcao(
  acao: () => Promise<unknown>,
  opcoes: {
    /** Mensagem de sucesso. Só aparece se a ação realmente concluir. */
    sucesso?: string;
    descricao?: string;
    /** Título do erro. O motivo técnico vai na descrição. */
    aoFalhar?: string;
  } = {},
): Promise<boolean> {
  try {
    await acao();
    if (opcoes.sucesso) toast.success(opcoes.sucesso, { description: opcoes.descricao });
    return true;
  } catch (falha) {
    const motivo =
      falha instanceof Error ? falha.message : 'Tente de novo em alguns instantes.';
    toast.error(opcoes.aoFalhar ?? 'Não foi possível salvar', {
      description: motivo,
      duration: 8000,
    });
    return false;
  }
}

/**
 * Versão com estado de carregamento, para desabilitar o botão enquanto grava.
 * Evita o clique duplo que criaria dois lançamentos iguais.
 */
export function useAcao() {
  const [executando, setExecutando] = React.useState(false);

  const executar = React.useCallback(
    async (acao: () => Promise<unknown>, opcoes?: Parameters<typeof executarAcao>[1]) => {
      setExecutando(true);
      try {
        return await executarAcao(acao, opcoes);
      } finally {
        setExecutando(false);
      }
    },
    [],
  );

  return { executando, executar };
}
