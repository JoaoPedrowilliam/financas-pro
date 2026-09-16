/**
 * Chaves de armazenamento local.
 *
 * Ficam num módulo próprio para que `services/migracao.ts` possa ler a chave
 * antiga sem importar o store — o store importa os serviços, e a volta
 * fecharia um ciclo.
 */

/**
 * Onde o Zustand gravava o estado financeiro antes do Supabase.
 *
 * NÃO é mais escrita: o middleware `persist` foi removido. A chave continua
 * existindo de propósito, como cópia dos dados anteriores, e é de onde a
 * migração lê. Só o próprio usuário decide apagá-la.
 */
export const CHAVE_PERSISTENCIA = 'financas-pro:v1';
