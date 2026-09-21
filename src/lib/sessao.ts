/**
 * Trava local de tela (PIN).
 *
 * Este arquivo era a "sessão" do protótipo: guardava um nome no localStorage e
 * chamava aquilo de login. Isso foi substituído por autenticação real em
 * `providers/auth.tsx`, com Supabase Auth — senha, token e expiração.
 *
 * O que sobrou aqui é o PIN: uma trava de tela do aparelho, opcional, que fica
 * ANTES da interface mas DEPOIS da autenticação. Ele não protege os dados no
 * servidor (isso é papel do RLS) — protege a tela de quem passa pelo seu
 * celular destravado.
 *
 * Por isso o PIN nunca vai para o banco: guardá-lo lá seria replicar um
 * segredo em texto puro para proteger algo que a senha já protege.
 */

/** Comparação em tempo constante, para não vazar o tamanho pelo tempo de resposta. */
export function pinConfere(informado: string, guardado: string | null | undefined): boolean {
  if (!guardado) return true;
  if (informado.length !== guardado.length) return false;
  let diferenca = 0;
  for (let i = 0; i < guardado.length; i++) {
    diferenca |= informado.charCodeAt(i) ^ guardado.charCodeAt(i);
  }
  return diferenca === 0;
}
