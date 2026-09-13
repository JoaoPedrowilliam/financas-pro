import { dataDe, MESES } from './utils';

const moedaBRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
});

const moedaCompacta = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});

export function moeda(valor: number, opcoes?: { compacto?: boolean; oculto?: boolean; sinal?: boolean }) {
  if (opcoes?.oculto) return 'R$ ••••';
  const base = opcoes?.compacto && Math.abs(valor) >= 10000 ? moedaCompacta.format(valor) : moedaBRL.format(valor);
  if (opcoes?.sinal && valor > 0) return `+${base}`;
  return base;
}

export function percentual(valor: number | null, casas = 1) {
  if (valor === null || !Number.isFinite(valor)) return '—';
  const sinal = valor > 0 ? '+' : '';
  return `${sinal}${valor.toFixed(casas).replace('.', ',')}%`;
}

export function numero(valor: number, casas = 2) {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: casas,
  }).format(valor);
}

export function dataCurta(iso: string) {
  const d = dataDe(iso);
  return `${`${d.getDate()}`.padStart(2, '0')}/${`${d.getMonth() + 1}`.padStart(2, '0')}`;
}

export function dataLonga(iso: string) {
  const d = dataDe(iso);
  return `${d.getDate()} de ${MESES[d.getMonth()].toLowerCase()} de ${d.getFullYear()}`;
}

export function dataCompleta(iso: string) {
  const d = dataDe(iso);
  return d.toLocaleDateString('pt-BR');
}

/** "em 3 dias", "hoje", "há 2 dias" — para lembretes de vencimento. */
export function distanciaEmDias(iso: string, referencia = new Date()) {
  const alvo = dataDe(iso);
  const base = new Date(referencia.getFullYear(), referencia.getMonth(), referencia.getDate());
  const dias = Math.round((alvo.getTime() - base.getTime()) / 86_400_000);
  if (dias === 0) return { dias, texto: 'hoje' };
  if (dias === 1) return { dias, texto: 'amanhã' };
  if (dias === -1) return { dias, texto: 'ontem' };
  if (dias > 0) return { dias, texto: `em ${dias} dias` };
  return { dias, texto: `há ${Math.abs(dias)} dias` };
}

export function competenciaLegivel(comp: string) {
  const [ano, mes] = comp.split('-').map(Number);
  return `${MESES[mes - 1]} de ${ano}`;
}

/** Converte texto digitado ("1.234,56", "R$ 80") em número. */
export function parseValor(texto: string): number {
  const limpo = texto
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');
  const n = Number.parseFloat(limpo);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

export function iniciais(nome: string) {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}
