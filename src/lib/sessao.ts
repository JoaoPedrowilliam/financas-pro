/**
 * Sessão local do protótipo.
 *
 * ⚠️ Isto NÃO é autenticação. Não há servidor, não há verificação de senha e
 * os dados ficam em localStorage, legíveis por qualquer script que rode na página.
 * Serve para: dar uma tela de entrada, guardar o nome de quem está usando e
 * demonstrar o fluxo de bloqueio por PIN.
 *
 * Antes de colocar isso no ar com dados reais, troque este arquivo por um
 * provedor de verdade (Auth.js, Clerk, Supabase Auth) e mova os dados para
 * um banco com autorização por usuário. O passo a passo está em docs/SEGURANCA.md.
 */

const CHAVE = 'financas-pro:sessao';

export interface Sessao {
  nome: string;
  email: string;
  entrouEm: string;
}

export function lerSessao(): Sessao | null {
  if (typeof window === 'undefined') return null;
  try {
    const bruto = window.localStorage.getItem(CHAVE);
    return bruto ? (JSON.parse(bruto) as Sessao) : null;
  } catch {
    return null;
  }
}

export function iniciarSessao(nome: string, email: string): Sessao {
  const sessao: Sessao = { nome, email, entrouEm: new Date().toISOString() };
  window.localStorage.setItem(CHAVE, JSON.stringify(sessao));
  return sessao;
}

export function encerrarSessao() {
  window.localStorage.removeItem(CHAVE);
}

/** Comparação de PIN em tempo constante, para não vazar o tamanho pelo tempo de resposta. */
export function pinConfere(informado: string, guardado: string | null | undefined): boolean {
  if (!guardado) return true;
  if (informado.length !== guardado.length) return false;
  let diferenca = 0;
  for (let i = 0; i < guardado.length; i++) {
    diferenca |= informado.charCodeAt(i) ^ guardado.charCodeAt(i);
  }
  return diferenca === 0;
}
