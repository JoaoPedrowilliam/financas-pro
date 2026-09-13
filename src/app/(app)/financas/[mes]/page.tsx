import { MESES, SLUGS_MES, mesDoSlug } from '@/lib/utils';
import { MesDetalhado } from '@/components/transacoes/mes-detalhado';

/**
 * Páginas mensais: /financas/janeiro … /financas/dezembro
 *
 * `dynamicParams = false` + `generateStaticParams` fazem o Next responder 404 de
 * verdade para qualquer slug fora da lista, na camada de roteamento. Chamar
 * `notFound()` dentro da página renderizava a tela certa mas respondia 200.
 *
 * O ano vem por query string e é lido no cliente. Se fosse lido aqui via
 * `searchParams`, a rota viraria dinâmica e o 404 acima deixaria de valer.
 */

export const dynamicParams = false;

export function generateStaticParams() {
  return SLUGS_MES.map((mes) => ({ mes }));
}

export async function generateMetadata({ params }: { params: Promise<{ mes: string }> }) {
  const { mes } = await params;
  const numero = mesDoSlug(mes);
  return { title: numero ? MESES[numero - 1] : 'Mês' };
}

export default async function PaginaMes({ params }: { params: Promise<{ mes: string }> }) {
  const { mes } = await params;
  // O slug já foi validado pelo roteador; o `?? 1` só satisfaz o tipo.
  return <MesDetalhado mes={mesDoSlug(mes) ?? 1} />;
}
