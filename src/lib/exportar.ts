import type { EstadoFinanceiro, Transacao } from '@/types';
import { competenciaLegivel, dataCompleta, moeda } from './format';
import { CHAVE_PERSISTENCIA } from '@/store/use-financas';

/* ─────────────────────────────── CSV ─────────────────────────────── */

/** Escapa um campo conforme RFC 4180 — vírgula, aspas e quebra de linha. */
function campo(valor: unknown): string {
  const texto = valor === null || valor === undefined ? '' : String(valor);
  return /[",;\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

export function paraCSV(linhas: Record<string, unknown>[], colunas?: string[]): string {
  if (!linhas.length) return '';
  const cabecalho = colunas ?? Object.keys(linhas[0]);
  const corpo = linhas.map((l) => cabecalho.map((c) => campo(l[c])).join(';'));
  // BOM para o Excel em pt-BR abrir com acentos corretos.
  return `\uFEFF${[cabecalho.join(';'), ...corpo].join('\r\n')}`;
}

export function baixarArquivo(conteudo: BlobPart, nome: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportarTransacoesCSV(
  transacoes: Transacao[],
  nomeCategoria: (id: string | null) => string,
  nomeConta: (id: string | null | undefined) => string,
  arquivo = 'lancamentos.csv',
) {
  const linhas = transacoes.map((t) => ({
    Data: dataCompleta(t.data),
    Tipo: t.tipo,
    Descrição: t.descricao,
    Categoria: nomeCategoria(t.categoriaId),
    'Conta/Cartão': t.cartaoId ? nomeConta(t.cartaoId) : nomeConta(t.contaId),
    Valor: t.valor.toFixed(2).replace('.', ','),
    Status: t.status,
    Parcela: t.parcela ? `${t.parcela.numero}/${t.parcela.total}` : '',
    Etiquetas: t.etiquetas.join(', '),
    Observação: t.observacao ?? '',
  }));
  baixarArquivo(paraCSV(linhas), arquivo, 'text/csv;charset=utf-8');
}

/* ─────────────────────────────── PDF ─────────────────────────────── */

export interface SecaoPDF {
  titulo: string;
  colunas: string[];
  linhas: (string | number)[][];
}

/**
 * Relatório em PDF. jspdf e autotable são carregados sob demanda:
 * são ~350 KB que não precisam entrar no bundle inicial.
 */
export async function gerarPDF(opcoes: {
  titulo: string;
  subtitulo?: string;
  resumo?: { rotulo: string; valor: string }[];
  secoes: SecaoPDF[];
  arquivo: string;
}) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margem = 40;
  let y = 56;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(16, 26, 46);
  doc.text(opcoes.titulo, margem, y);

  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(110, 120, 138);
  doc.text(opcoes.subtitulo ?? `Gerado em ${new Date().toLocaleString('pt-BR')}`, margem, y);

  if (opcoes.resumo?.length) {
    y += 26;
    const largura = (doc.internal.pageSize.getWidth() - margem * 2) / opcoes.resumo.length;
    opcoes.resumo.forEach((item, i) => {
      const x = margem + largura * i;
      doc.setFontSize(8);
      doc.setTextColor(110, 120, 138);
      doc.text(item.rotulo, x, y);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(16, 26, 46);
      doc.text(item.valor, x, y + 16);
      doc.setFont('helvetica', 'normal');
    });
    y += 34;
  }

  for (const secao of opcoes.secoes) {
    y += 22;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(16, 26, 46);
    doc.text(secao.titulo, margem, y);

    autoTable(doc, {
      startY: y + 8,
      head: [secao.colunas],
      body: secao.linhas.map((l) => l.map(String)),
      margin: { left: margem, right: margem },
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 6, textColor: [40, 50, 70] },
      headStyles: { fillColor: [22, 100, 76], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [246, 248, 250] },
      theme: 'grid',
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  }

  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 158, 172);
    doc.text(
      `Finanças Pro · página ${i} de ${paginas}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 24,
      { align: 'center' },
    );
  }

  doc.save(opcoes.arquivo);
}

export function linhasDeTransacoes(
  transacoes: Transacao[],
  nomeCategoria: (id: string | null) => string,
): SecaoPDF {
  return {
    titulo: 'Lançamentos',
    colunas: ['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor'],
    linhas: transacoes.map((t) => [
      dataCompleta(t.data),
      t.descricao,
      nomeCategoria(t.categoriaId),
      t.tipo === 'receita' ? 'Receita' : t.tipo === 'despesa' ? 'Despesa' : 'Transferência',
      moeda(t.valor),
    ]),
  };
}

/* ─────────────────────────── Backup e restauração ─────────────────────────── */

export function exportarBackup(estado: EstadoFinanceiro) {
  const pacote = {
    aplicacao: 'financas-pro',
    versao: 1,
    exportadoEm: new Date().toISOString(),
    dados: estado,
  };
  const data = new Date().toISOString().slice(0, 10);
  baixarArquivo(JSON.stringify(pacote, null, 2), `backup-financas-${data}.json`, 'application/json');
}

export interface ResultadoImportacao {
  ok: boolean;
  erro?: string;
  dados?: EstadoFinanceiro;
}

/** Valida um arquivo de backup antes de deixá-lo sobrescrever os dados do usuário. */
export function lerBackup(texto: string): ResultadoImportacao {
  try {
    const pacote = JSON.parse(texto);
    const dados = pacote?.dados ?? pacote;
    const obrigatorios = ['contas', 'transacoes', 'categorias', 'cartoes'];
    const faltando = obrigatorios.filter((c) => !Array.isArray(dados?.[c]));
    if (faltando.length) {
      return { ok: false, erro: `O arquivo não parece um backup do Finanças Pro. Faltam: ${faltando.join(', ')}.` };
    }
    return { ok: true, dados: dados as EstadoFinanceiro };
  } catch {
    return { ok: false, erro: 'Não foi possível ler o arquivo. Confira se é o .json gerado pela exportação.' };
  }
}

export { competenciaLegivel, CHAVE_PERSISTENCIA };
