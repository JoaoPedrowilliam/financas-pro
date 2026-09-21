/**
 * Espia o que está realmente gravado no Postgres.
 * Serve para confirmar que uma ação feita na interface chegou ao banco — e não
 * ficou só no estado da tela.
 *
 *   node scripts/conferir-banco.mjs [email] [senha]
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.trim() && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const email = process.argv[2] ?? 'teste-a@example.com';
const senha = process.argv[3] ?? 'Teste!2026#pro';

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

const { error } = await sb.auth.signInWithPassword({ email, password: senha });
if (error) {
  console.error(`Login falhou: ${error.message}`);
  process.exit(1);
}

const { data: transacoes } = await sb
  .from('transacoes')
  .select('descricao,valor,data,competencia,tipo,status')
  .order('criado_em', { ascending: false })
  .limit(5);

console.log(`\nLançamentos de ${email} no Postgres:\n`);
for (const t of transacoes ?? []) {
  console.log(`  ${t.data}  ${t.competencia}  ${t.tipo.padEnd(13)} R$ ${String(t.valor).padStart(9)}  ${t.descricao}`);
}

for (const tabela of ['contas', 'cartoes', 'categorias', 'metas', 'dividas', 'ativos']) {
  const { count } = await sb.from(tabela).select('id', { count: 'exact', head: true });
  console.log(`  ${tabela.padEnd(12)} ${count} registro(s)`);
}
console.log('');
