import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Hoje em ISO curto, no fuso local (não em UTC). */
export function hojeISO(): string {
  const d = new Date();
  return isoDe(d);
}

export function isoDe(d: Date): string {
  const mes = `${d.getMonth() + 1}`.padStart(2, '0');
  const dia = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/** Converte 'YYYY-MM-DD' para Date local, sem deslocamento de fuso. */
export function dataDe(iso: string): Date {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, (m ?? 1) - 1, d ?? 1);
}

/** Chave de competência 'YYYY-MM'. */
export function competencia(iso: string): string {
  return iso.slice(0, 7);
}

export function competenciaDe(ano: number, mes: number): string {
  return `${ano}-${`${mes}`.padStart(2, '0')}`;
}

export function mesAnterior(comp: string): string {
  const [a, m] = comp.split('-').map(Number);
  return m === 1 ? competenciaDe(a - 1, 12) : competenciaDe(a, m - 1);
}

export function mesSeguinte(comp: string): string {
  const [a, m] = comp.split('-').map(Number);
  return m === 12 ? competenciaDe(a + 1, 1) : competenciaDe(a, m + 1);
}

export function diasNoMes(ano: number, mes: number): number {
  return new Date(ano, mes, 0).getDate();
}

/** Ajusta o dia ao tamanho do mês: dia 31 em fevereiro vira 28/29. */
export function diaSeguro(ano: number, mes: number, dia: number): string {
  return `${ano}-${`${mes}`.padStart(2, '0')}-${`${Math.min(dia, diasNoMes(ano, mes))}`.padStart(2, '0')}`;
}

export const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
] as const;

export const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'] as const;

export const SLUGS_MES = [
  'janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
] as const;

export function mesDoSlug(slug: string): number | null {
  const i = SLUGS_MES.indexOf(slug as (typeof SLUGS_MES)[number]);
  return i === -1 ? null : i + 1;
}

export function agrupar<T, K extends string | number>(itens: T[], chave: (item: T) => K): Record<K, T[]> {
  return itens.reduce((acc, item) => {
    const k = chave(item);
    (acc[k] ||= []).push(item);
    return acc;
  }, {} as Record<K, T[]>);
}

export function somar<T>(itens: T[], valor: (item: T) => number): number {
  return itens.reduce((total, item) => total + valor(item), 0);
}

/** Variação percentual protegida contra divisão por zero. */
export function variacao(atual: number, anterior: number): number | null {
  if (!anterior) return atual ? null : 0;
  return ((atual - anterior) / Math.abs(anterior)) * 100;
}
