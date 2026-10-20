/**
 * Catálogo de instituições.
 *
 * Por que uma tabela local e não logos baixados de uma CDN:
 * - funciona offline e não quebra quando um domínio de terceiro sai do ar;
 * - não adiciona dependência nem peso de imagem ao bundle;
 * - a marca é representada por monograma sobre a cor oficial da instituição,
 *   que identifica sem redistribuir o logotipo de ninguém.
 *
 * Quem não estiver na lista cai em `BANCO_GENERICO`, com ícone de banco neutro.
 */

export interface Banco {
  id: string;
  nome: string;
  /** Monograma exibido no ícone. Uma ou duas letras. */
  sigla: string;
  /** Cor institucional — fundo do ícone. */
  cor: string;
  /** Cor do monograma sobre `cor`. Escolhida para contraste, não por estilo. */
  corTexto: string;
  /**
   * Como a instituição costuma aparecer no campo livre `instituicao` de contas
   * antigas. É o que permite reconhecer o banco de quem já usava o sistema.
   */
  apelidos?: string[];
}

export const BANCOS: Banco[] = [
  { id: 'nubank', nome: 'Nubank', sigla: 'nu', cor: '#820AD1', corTexto: '#FFFFFF', apelidos: ['nu', 'nu bank', 'nubank'] },
  { id: 'itau', nome: 'Itaú', sigla: 'itaú', cor: '#EC7000', corTexto: '#FFFFFF', apelidos: ['itau', 'itaú', 'itau unibanco'] },
  { id: 'bradesco', nome: 'Bradesco', sigla: 'bra', cor: '#CC092F', corTexto: '#FFFFFF' },
  { id: 'santander', nome: 'Santander', sigla: 'S', cor: '#EC0000', corTexto: '#FFFFFF' },
  { id: 'bb', nome: 'Banco do Brasil', sigla: 'BB', cor: '#FAE128', corTexto: '#0038A8', apelidos: ['banco do brasil', 'bb'] },
  { id: 'caixa', nome: 'Caixa', sigla: 'CAIXA', cor: '#0070AF', corTexto: '#FFFFFF', apelidos: ['caixa', 'caixa economica', 'caixa econômica'] },
  { id: 'inter', nome: 'Inter', sigla: 'inter', cor: '#FF7A00', corTexto: '#FFFFFF', apelidos: ['banco inter', 'inter'] },
  { id: 'btg', nome: 'BTG Pactual', sigla: 'btg', cor: '#0D1B2A', corTexto: '#FFFFFF', apelidos: ['btg', 'btg pactual'] },
  { id: 'xp', nome: 'XP', sigla: 'XP', cor: '#0F0F0F', corTexto: '#FFD100', apelidos: ['xp', 'xp investimentos'] },
  { id: 'c6', nome: 'C6 Bank', sigla: 'C6', cor: '#242424', corTexto: '#FFFFFF', apelidos: ['c6', 'c6 bank'] },
  { id: 'mercadopago', nome: 'Mercado Pago', sigla: 'mp', cor: '#00B1EA', corTexto: '#FFFFFF', apelidos: ['mercado pago', 'mercadopago'] },
  { id: 'picpay', nome: 'PicPay', sigla: 'picpay', cor: '#11C76F', corTexto: '#0A2E1C', apelidos: ['picpay', 'pic pay'] },
  { id: 'pagbank', nome: 'PagBank', sigla: 'pag', cor: '#12A454', corTexto: '#FFFFFF', apelidos: ['pagbank', 'pagseguro'] },
  { id: 'neon', nome: 'Neon', sigla: 'neon', cor: '#00A3FF', corTexto: '#FFFFFF' },
  { id: 'original', nome: 'Banco Original', sigla: 'orig', cor: '#00A868', corTexto: '#FFFFFF', apelidos: ['original', 'banco original'] },
  { id: 'safra', nome: 'Safra', sigla: 'safra', cor: '#003B71', corTexto: '#FFFFFF' },
  { id: 'sicredi', nome: 'Sicredi', sigla: 'sicredi', cor: '#3FA110', corTexto: '#FFFFFF' },
  { id: 'sicoob', nome: 'Sicoob', sigla: 'sicoob', cor: '#003641', corTexto: '#49B02D' },
  { id: 'will', nome: 'Will Bank', sigla: 'will', cor: '#FFD200', corTexto: '#1A1A1A', apelidos: ['will', 'will bank'] },
  // Benefícios corporativos: entram aqui porque o saldo do cartão de benefício
  // é dinheiro que a pessoa administra como qualquer outra conta.
  { id: 'flash', nome: 'Flash', sigla: 'flash', cor: '#FC2B6E', corTexto: '#FFFFFF', apelidos: ['flash', 'flash benefícios', 'flash beneficios', 'cartão flash', 'cartao flash'] },
  { id: 'caju', nome: 'Caju', sigla: 'caju', cor: '#FF5A1F', corTexto: '#FFFFFF', apelidos: ['caju', 'caju benefícios', 'caju beneficios'] },
  { id: 'alelo', nome: 'Alelo', sigla: 'alelo', cor: '#00A550', corTexto: '#FFFFFF', apelidos: ['alelo'] },
  { id: 'vr', nome: 'VR', sigla: 'VR', cor: '#009640', corTexto: '#FFFFFF', apelidos: ['vr', 'vr benefícios', 'vr beneficios'] },
  { id: 'ticket', nome: 'Ticket', sigla: 'ticket', cor: '#004B8D', corTexto: '#FFFFFF', apelidos: ['ticket', 'ticket restaurante'] },
  { id: 'sodexo', nome: 'Sodexo / Pluxee', sigla: 'pluxee', cor: '#221C35', corTexto: '#FFFFFF', apelidos: ['sodexo', 'pluxee'] },
];

/** Fallback para instituição não catalogada — desenha um ícone de banco em vez de monograma. */
export const BANCO_GENERICO: Banco = {
  id: 'outro',
  nome: 'Outro banco',
  sigla: '',
  cor: 'hsl(var(--aco))',
  corTexto: 'hsl(var(--surface-raised))',
};

/** Lista pronta para popular um <Select>: catálogo + a opção "Outro". */
export const OPCOES_BANCO: Banco[] = [...BANCOS, BANCO_GENERICO];

export function bancoPorId(id?: string | null): Banco | null {
  if (!id) return null;
  if (id === BANCO_GENERICO.id) return BANCO_GENERICO;
  return BANCOS.find((b) => b.id === id) ?? null;
}

const normalizar = (texto: string) =>
  texto
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/** Tenta reconhecer o banco a partir do texto livre digitado como instituição. */
export function bancoPorNome(instituicao?: string | null): Banco | null {
  if (!instituicao) return null;
  const alvo = normalizar(instituicao);
  if (!alvo || alvo === '—' || alvo === '-') return null;
  return (
    BANCOS.find(
      (b) =>
        normalizar(b.nome) === alvo ||
        (b.apelidos ?? []).some((a) => normalizar(a) === alvo),
    ) ??
    // Só depois da igualdade exata tentamos "contém": evita 'Banco do Brasil' virar 'Banco Inter'.
    BANCOS.find((b) => alvo.includes(normalizar(b.nome))) ??
    null
  );
}

/**
 * Resolve o banco de uma conta ou cartão.
 * `bancoId` é o campo novo; `instituicao` é o texto livre de quem já usava o
 * sistema antes deste campo existir — por isso a busca por nome fica de reserva.
 */
export function resolverBanco(registro: { bancoId?: string | null; instituicao?: string | null }): Banco {
  return bancoPorId(registro.bancoId) ?? bancoPorNome(registro.instituicao) ?? BANCO_GENERICO;
}

/** Nome a exibir: o do catálogo quando reconhecido, senão o que a pessoa digitou. */
export function nomeInstituicao(registro: { bancoId?: string | null; instituicao?: string | null }): string {
  const banco = resolverBanco(registro);
  if (banco.id !== BANCO_GENERICO.id) return banco.nome;
  const livre = registro.instituicao?.trim();
  return livre && livre !== '—' ? livre : BANCO_GENERICO.nome;
}
