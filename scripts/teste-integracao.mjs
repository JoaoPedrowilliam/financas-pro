/**
 * Bateria de integração contra o Supabase real.
 *
 * Exercita o que só aparece com banco de verdade: autenticação, CRUD de todas
 * as entidades, as constraints do domínio, a idempotência das recorrências e —
 * o mais importante — o isolamento entre dois usuários.
 *
 * Lê as credenciais de .env.local. Usa apenas a chave publicável: se algum
 * teste passasse por causa de privilégio administrativo, ele não estaria
 * testando o que o app realmente faz.
 *
 *   node scripts/teste-integracao.mjs
 */

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

/* ─────────────────────────── preparação ─────────────────────────── */

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.trim() && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const URL_SB = env.NEXT_PUBLIC_SUPABASE_URL;
const CHAVE = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const cliente = () =>
  createClient(URL_SB, CHAVE, { auth: { persistSession: false, autoRefreshToken: false } });

let passou = 0;
let falhou = 0;
const pendentes = [];

function ok(nome, condicao, detalhe = '') {
  if (condicao) {
    passou++;
    console.log(`  PASSOU  ${nome}`);
  } else {
    falhou++;
    console.log(`  FALHOU  ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
  }
}

function pendente(nome, motivo) {
  pendentes.push(`${nome} — ${motivo}`);
  console.log(`  PULOU   ${nome} — ${motivo}`);
}

/** Esvazia a conta antes de começar, para que rodar duas vezes dê o mesmo resultado. */
async function limparConta(sb, id) {
  for (const tabela of [
    'pagamentos_divida', 'anexos', 'transacoes', 'assinaturas', 'recorrencias',
    'dividas', 'metas', 'ativos', 'cartoes', 'contas', 'categorias', 'competencias_geradas',
  ]) {
    await sb.from(tabela).delete().eq('usuario_id', id);
  }
}

/**
 * Contas de teste. Endereços fixos (sem sufixo aleatório) para que possam ser
 * criadas uma vez pelo painel do Supabase e reaproveitadas — o que evita
 * esbarrar no limite de envio de e-mail a cada execução.
 *
 * Sobrescreva com TESTE_EMAIL_A / TESTE_EMAIL_B se quiser outros endereços.
 */
const contaA = {
  email: process.env.TESTE_EMAIL_A ?? 'teste-a@example.com',
  senha: process.env.TESTE_SENHA ?? 'Teste!2026#pro',
};
const contaB = {
  email: process.env.TESTE_EMAIL_B ?? 'teste-b@example.com',
  senha: process.env.TESTE_SENHA ?? 'Teste!2026#pro',
};

/* ──────────────────────── 1. autenticação ──────────────────────── */

/**
 * Entra numa conta, criando-a se ainda não existir.
 *
 * Tenta o login primeiro de propósito: permite rodar a bateria tanto num
 * projeto com confirmação de e-mail desligada (onde o cadastro já devolve
 * sessão) quanto num projeto onde as contas de teste foram criadas à mão pelo
 * painel, com "Auto Confirm User" — caso em que o cadastro nem é tentado e o
 * limite de envio de e-mail não entra na jogada.
 */
async function criarConta(sb, conta, nome) {
  const login = await sb.auth.signInWithPassword({
    email: conta.email,
    password: conta.senha,
  });
  if (login.data?.session) return login.data;

  const { data, error } = await sb.auth.signUp({
    email: conta.email,
    password: conta.senha,
    options: { data: { nome } },
  });
  if (error) {
    // Os dois erros que aparecem quando a confirmação de e-mail está ligada.
    // Vale distinguir: sem isso, "invalid" parece problema no endereço quando
    // na verdade é configuração do projeto.
    if (error.message.includes('rate limit')) {
      throw new Error(
        'limite de envio de e-mail estourado — o SMTP padrão do Supabase manda poucas ' +
          'mensagens por hora. Desligue "Confirm email" em Authentication → Sign In / Providers.',
      );
    }
    if (error.message.includes('invalid')) {
      throw new Error(
        `${error.message} — com "Confirm email" ligado, o Supabase exige um domínio que receba ` +
          'mensagem de verdade. Desligue a confirmação para rodar a bateria.',
      );
    }
    throw new Error(`signUp: ${error.message}`);
  }
  return data;
}

console.log('\n── Autenticação ──');

const sbA = cliente();
let dadosA;
try {
  dadosA = await criarConta(sbA, contaA, 'Usuário A');
  ok('criar usuário', Boolean(dadosA.user), 'sem usuário no retorno');
} catch (e) {
  ok('criar usuário', false, e.message);
  console.log('\nSem conta criada, o resto da bateria não tem o que testar.');
  process.exit(1);
}

if (!dadosA.session) {
  console.log(
    '\n  A confirmação de e-mail está LIGADA no projeto.\n' +
      '  Para rodar a bateria, desligue temporariamente em\n' +
      '  Authentication → Sign In / Providers → Email → "Confirm email".\n',
  );
  pendente('todos os testes de dados', 'signUp não devolveu sessão (confirmação de e-mail ligada)');
  console.log(`\nResultado: ${passou} passaram, ${falhou} falharam, ${pendentes.length} pulados.`);
  process.exit(falhou > 0 ? 1 : 0);
}

ok('sessão ativa', Boolean(dadosA.session.access_token));
const idA = dadosA.user.id;

await limparConta(sbA, idA);

/* O trigger deve ter criado o perfil automaticamente. */
{
  const { data, error } = await sbA.from('perfis').select('*').eq('id', idA).maybeSingle();
  ok('perfil criado pelo trigger', Boolean(data) && !error, error?.message ?? 'perfil ausente');
  ok('nome veio do cadastro', data?.nome === 'Usuário A', `recebido: ${data?.nome}`);
}

/* ───────────────────────── 2. CRUD ───────────────────────── */

console.log('\n── CRUD ──');

const criados = {};

/* categoria */
{
  const { data, error } = await sbA
    .from('categorias')
    .insert({ usuario_id: idA, nome: 'Mercado', tipo: 'despesa', cor: '#D97706', icone: 'Cart' })
    .select()
    .single();
  ok('criar categoria', Boolean(data) && !error, error?.message);
  criados.categoria = data?.id;
}

/* conta */
{
  const { data, error } = await sbA
    .from('contas')
    .insert({ usuario_id: idA, nome: 'Conta corrente', banco_id: 'nubank', tipo: 'digital', saldo_inicial: 1000, cor: '#820AD1' })
    .select()
    .single();
  ok('criar conta', Boolean(data) && !error, error?.message);
  criados.conta = data?.id;

  const { data: dest } = await sbA
    .from('contas')
    .insert({ usuario_id: idA, nome: 'Poupança', tipo: 'poupanca', saldo_inicial: 500, cor: '#16A34A' })
    .select()
    .single();
  criados.contaDestino = dest?.id;
}

/* cartão */
{
  const { data, error } = await sbA
    .from('cartoes')
    .insert({
      usuario_id: idA, nome: 'Nubank', bandeira: 'Mastercard', banco_id: 'nubank',
      final: '4521', tipo: 'credito', limite: 5000, dia_fechamento: 14,
      dia_vencimento: 20, cor: '#2A2A2A', conta_pagamento_id: criados.conta,
    })
    .select()
    .single();
  ok('criar cartão', Boolean(data) && !error, error?.message);
  criados.cartao = data?.id;
}

/* receita, despesa e transferência */
{
  const { data, error } = await sbA
    .from('transacoes')
    .insert({
      usuario_id: idA, tipo: 'receita', descricao: 'Salário', valor: 7400,
      data: '2026-09-05', conta_id: criados.conta, status: 'pago', etiquetas: [],
    })
    .select()
    .single();
  ok('criar receita', Boolean(data) && !error, error?.message);
  ok('competência derivada pelo trigger', data?.competencia === '2026-09', `recebido: ${data?.competencia}`);
  ok('dinheiro volta com 2 casas', Number(data?.valor) === 7400, `recebido: ${data?.valor}`);
  ok('data sem deslocamento de fuso', data?.data === '2026-09-05', `recebido: ${data?.data}`);
  criados.receita = data?.id;
}

{
  const { data, error } = await sbA
    .from('transacoes')
    .insert({
      usuario_id: idA, tipo: 'despesa', descricao: 'Mercado', valor: 320.55,
      data: '2026-09-08', conta_id: criados.conta, categoria_id: criados.categoria,
      status: 'pago', etiquetas: ['mensal'],
    })
    .select()
    .single();
  ok('criar despesa', Boolean(data) && !error, error?.message);
  ok('centavos preservados', Number(data?.valor) === 320.55, `recebido: ${data?.valor}`);
  criados.despesa = data?.id;
}

{
  const { data, error } = await sbA
    .from('transacoes')
    .insert({
      usuario_id: idA, tipo: 'transferencia', descricao: 'Para a poupança', valor: 200,
      data: '2026-09-10', conta_id: criados.conta, conta_destino_id: criados.contaDestino,
      status: 'pago', etiquetas: [],
    })
    .select()
    .single();
  ok('criar transferência', Boolean(data) && !error, error?.message);
}

/* editar e excluir */
{
  const { data, error } = await sbA
    .from('transacoes')
    .update({ valor: 999.99, descricao: 'Mercado (corrigido)' })
    .eq('id', criados.despesa)
    .select()
    .single();
  ok('editar lançamento', Number(data?.valor) === 999.99 && !error, error?.message);
}

/* ─────────────────── 3. constraints do domínio ─────────────────── */

console.log('\n── Constraints ──');

{
  const { error } = await sbA.from('transacoes').insert({
    usuario_id: idA, tipo: 'transferencia', descricao: 'Para si mesma', valor: 10,
    data: '2026-09-11', conta_id: criados.conta, conta_destino_id: criados.conta,
    status: 'pago', etiquetas: [],
  });
  ok('recusa transferência para a mesma conta', Boolean(error), 'gravou');
}

{
  const { error } = await sbA.from('transacoes').insert({
    usuario_id: idA, tipo: 'receita', descricao: 'Com destino', valor: 10,
    data: '2026-09-11', conta_id: criados.conta, conta_destino_id: criados.contaDestino,
    status: 'pago', etiquetas: [],
  });
  ok('recusa destino em receita', Boolean(error), 'gravou');
}

{
  const { error } = await sbA.from('transacoes').insert({
    usuario_id: idA, tipo: 'despesa', descricao: 'Valor negativo', valor: -50,
    data: '2026-09-11', conta_id: criados.conta, status: 'pago', etiquetas: [],
  });
  ok('recusa valor negativo', Boolean(error), 'gravou');
}

{
  const { error } = await sbA.from('cartoes').insert({
    usuario_id: idA, nome: 'Número inteiro', bandeira: 'Visa', final: '4521999888',
    tipo: 'credito', limite: 100, dia_fechamento: 1, dia_vencimento: 10, cor: '#000',
  });
  ok('recusa número de cartão completo', Boolean(error), 'gravou');
}

/* lançamento órfão precisa ser aceito: removeConta() depende disso */
{
  const { data, error } = await sbA
    .from('transacoes')
    .insert({
      usuario_id: idA, tipo: 'despesa', descricao: 'Órfã', valor: 25,
      data: '2026-09-12', conta_id: null, cartao_id: null, status: 'pago', etiquetas: [],
    })
    .select()
    .single();
  ok('aceita lançamento órfão (sem conta nem cartão)', Boolean(data) && !error, error?.message);
  if (data?.id) await sbA.from('transacoes').delete().eq('id', data.id);
}

/* ─────────────── 4. idempotência das recorrências ─────────────── */

console.log('\n── Idempotência ──');

{
  const { data: rec } = await sbA
    .from('recorrencias')
    .insert({
      usuario_id: idA, nome: 'Aluguel', natureza: 'fixa', tipo: 'despesa',
      valor_previsto: 1850, conta_id: criados.conta, dia_vencimento: 10,
      periodicidade: 'mensal', inicio_em: '2026-01-10', lembrete_dias: 3, ativa: true,
    })
    .select()
    .single();
  ok('criar recorrência', Boolean(rec));

  const linha = {
    usuario_id: idA, tipo: 'despesa', descricao: 'Aluguel', valor: 1850,
    data: '2026-10-10', conta_id: criados.conta, recorrencia_id: rec.id,
    status: 'pendente', etiquetas: ['conta fixa'],
  };

  const primeira = await sbA.from('transacoes').insert(linha).select();
  ok('primeira geração grava', primeira.data?.length === 1, primeira.error?.message);

  const segunda = await sbA.from('transacoes').insert(linha).select();
  ok('segunda geração é recusada pela constraint única', Boolean(segunda.error), 'duplicou');

  const terceira = await sbA
    .from('transacoes')
    .upsert(linha, { onConflict: 'recorrencia_id,competencia', ignoreDuplicates: true })
    .select();
  ok(
    'upsert com ignoreDuplicates não duplica',
    !terceira.error && (terceira.data?.length ?? 0) === 0,
    terceira.error?.message ?? `retornou ${terceira.data?.length} linhas`,
  );
}

/* ──────────────── 5. isolamento entre usuários ──────────────── */

console.log('\n── Isolamento entre usuários ──');

const sbB = cliente();
let idB;
try {
  const dadosB = await criarConta(sbB, contaB, 'Usuário B');
  idB = dadosB.user?.id;
  ok('criar segundo usuário', Boolean(dadosB.session), 'sem sessão');
} catch (e) {
  ok('criar segundo usuário', false, e.message);
}

if (idB) {
  {
    const { data } = await sbB.from('transacoes').select('*');
    ok('B não enxerga lançamentos de A', (data?.length ?? 0) === 0, `viu ${data?.length} linhas`);
  }
  {
    const { data } = await sbB.from('contas').select('*');
    ok('B não enxerga contas de A', (data?.length ?? 0) === 0, `viu ${data?.length} linhas`);
  }
  {
    const { data } = await sbB.from('perfis').select('*');
    ok('B só enxerga o próprio perfil', data?.length === 1 && data[0].id === idB);
  }
  {
    const { data, error } = await sbB
      .from('transacoes')
      .update({ valor: 1 })
      .eq('id', criados.receita)
      .select();
    ok('B não consegue alterar lançamento de A', (data?.length ?? 0) === 0, error?.message ?? 'alterou');
  }
  {
    const { data } = await sbB.from('transacoes').delete().eq('id', criados.receita).select();
    ok('B não consegue excluir lançamento de A', (data?.length ?? 0) === 0, 'excluiu');
  }
  {
    const { error } = await sbB
      .from('contas')
      .insert({ usuario_id: idA, nome: 'Plantada por B', tipo: 'corrente', saldo_inicial: 0, cor: '#000' });
    ok('B não consegue gravar em nome de A', Boolean(error), 'gravou');
  }
}

/* ──────────────── 6. persistência e sessão ──────────────── */

console.log('\n── Persistência ──');

{
  // Cliente novo, login do zero: equivale a fechar e reabrir o navegador.
  const sbNovo = cliente();
  const { data: login, error } = await sbNovo.auth.signInWithPassword({
    email: contaA.email,
    password: contaA.senha,
  });
  ok('login com e-mail e senha', Boolean(login?.session) && !error, error?.message);

  const { data } = await sbNovo.from('transacoes').select('*');
  ok('dados continuam lá depois de novo login', (data?.length ?? 0) >= 3, `encontrou ${data?.length}`);

  const { error: erroSair } = await sbNovo.auth.signOut();
  ok('logout', !erroSair, erroSair?.message);

  const { data: depois } = await sbNovo.from('transacoes').select('*');
  ok('depois do logout não lê mais nada', (depois?.length ?? 0) === 0, `ainda via ${depois?.length}`);
}

/* ──────────────── 7. exclusão ──────────────── */

console.log('\n── Exclusão ──');

{
  const { data } = await sbA.from('transacoes').delete().eq('id', criados.receita).select();
  ok('excluir lançamento', data?.length === 1);
}
{
  // on delete set null: o cartão sobrevive à exclusão da conta de pagamento.
  await sbA.from('contas').delete().eq('id', criados.conta);
  const { data } = await sbA.from('cartoes').select('*').eq('id', criados.cartao).single();
  ok('excluir conta não apaga o cartão', Boolean(data));
  ok('vínculo do cartão foi zerado', data?.conta_pagamento_id === null, `ficou ${data?.conta_pagamento_id}`);

  const { data: orfas } = await sbA.from('transacoes').select('*').is('conta_id', null);
  ok('lançamentos viraram órfãos em vez de sumir', (orfas?.length ?? 0) > 0);
}

/* ──────────────── resultado ──────────────── */

console.log(`\n${'─'.repeat(52)}`);
console.log(`${passou} passaram · ${falhou} falharam · ${pendentes.length} pulados`);
if (falhou > 0) console.log('\nHá falhas acima que precisam de correção.');
console.log(`\nContas de teste criadas: ${contaA.email} e ${contaB.email}`);
console.log('Apague-as em Authentication → Users quando terminar.\n');

process.exit(falhou > 0 ? 1 : 0);
