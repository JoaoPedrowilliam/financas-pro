'use client';

import * as React from 'react';
import { toast } from 'sonner';
import {
  Database, Download, Lock, Pencil, Plus, RotateCcw, ShieldAlert, Tag, Trash2, Upload, UserRound,
} from 'lucide-react';
import { CabecalhoPagina } from '@/components/shared/cabecalho-pagina';
import { Confirmar } from '@/components/shared/confirmar';
import { CampoValor } from '@/components/shared/campo-valor';
import { CORES_CARTAO } from '@/components/cartoes/dialogs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useFinancas } from '@/store/use-financas';
import { exportarBackup, lerBackup } from '@/lib/exportar';
import { useAcao } from '@/lib/acoes';
import { moeda } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Categoria } from '@/types';

export default function PaginaConfiguracoes() {
  const estado = useFinancas();
  const {
    perfil, categorias, transacoes, updatePerfil, restaurarDemo, limparTudo,
    removeCategoria, carregarDoServidor,
  } = estado;
  const { executando, executar } = useAcao();

  const [nome, setNome] = React.useState(perfil.nome);
  const [email, setEmail] = React.useState(perfil.email);
  const [pin, setPin] = React.useState('');
  const [catDialog, setCatDialog] = React.useState(false);
  const [catEditando, setCatEditando] = React.useState<Categoria | null>(null);
  const [excluirCat, setExcluirCat] = React.useState<Categoria | null>(null);
  const [confirmarLimpeza, setConfirmarLimpeza] = React.useState(false);
  const [confirmarDemo, setConfirmarDemo] = React.useState(false);

  React.useEffect(() => {
    setNome(perfil.nome);
    setEmail(perfil.email);
  }, [perfil.nome, perfil.email]);

  /**
   * Importa um backup para a conta autenticada.
   *
   * A validação do arquivo continua sendo a de lerBackup(). O que mudou é o
   * destino: em vez de sobrescrever o estado em memória, os registros são
   * gravados no banco. Por isso a conta é esvaziada antes — importar por cima
   * de dados existentes duplicaria tudo, já que os ids do arquivo são os
   * mesmos que já estariam lá.
   */
  const importarArquivo = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    const resultado = lerBackup(await arquivo.text());
    if (!resultado.ok || !resultado.dados) {
      toast.error('Backup não importado', { description: resultado.erro });
      return;
    }
    const dados = resultado.dados;

    await executar(
      async () => {
        const { apagarTudoDoUsuario } = await import('@/services/limpeza');
        const { importarBackup } = await import('@/services/migracao');
        await apagarTudoDoUsuario();
        const envio = await importarBackup(dados);
        if (!envio.ok) {
          throw new Error(`Falhou em "${envio.etapa}": ${envio.erro}`);
        }
        await carregarDoServidor();
      },
      {
        sucesso: 'Backup restaurado',
        descricao: `${dados.transacoes.length} lançamentos carregados.`,
        aoFalhar: 'Backup não importado',
      },
    );
  };

  const raizes = categorias.filter((c) => !c.paiId);

  const totalGasto = (categoriaId: string) =>
    transacoes
      .filter((t) => t.categoriaId === categoriaId && t.tipo === 'despesa')
      .reduce((s, t) => s + t.valor, 0);

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Configurações"
        descricao="Perfil, categorias, orçamentos, backup e segurança."
      />

      <Tabs defaultValue="perfil">
        <TabsList>
          <TabsTrigger value="perfil">Perfil</TabsTrigger>
          <TabsTrigger value="categorias">Categorias</TabsTrigger>
          <TabsTrigger value="dados">Dados e backup</TabsTrigger>
          <TabsTrigger value="seguranca">Segurança</TabsTrigger>
        </TabsList>

        <TabsContent value="perfil">
          <Card>
            <CardHeader>
              <CardTitle>Seus dados</CardTitle>
              <CardDescription>Usados nos relatórios exportados e na saudação do dashboard.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="perfil-nome">Nome</Label>
                <Input
                  id="perfil-nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  onBlur={() => executar(() => updatePerfil({ nome: nome.trim() }))}
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="perfil-email">E-mail</Label>
                <Input
                  id="perfil-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => executar(() => updatePerfil({ email: email.trim() }))}
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="perfil-moeda">Moeda</Label>
                <Select
                  value={perfil.moeda}
                  onValueChange={(v) => executar(() => updatePerfil({ moeda: v as typeof perfil.moeda }))}
                >
                  <SelectTrigger id="perfil-moeda" className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BRL">Real (R$)</SelectItem>
                    <SelectItem value="USD">Dólar (US$)</SelectItem>
                    <SelectItem value="EUR">Euro (€)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="mt-1 text-[11.5px] text-ink-faint">
                  A formatação em pt-BR está implementada. Outras moedas exigem ajuste em lib/format.ts.
                </p>
              </div>

              <div>
                <Label htmlFor="inicio-mes">Dia em que seu mês financeiro começa</Label>
                <Input
                  id="inicio-mes"
                  type="number"
                  min={1}
                  max={28}
                  value={perfil.inicioMesFinanceiro}
                  onChange={(e) =>
                    executar(() =>
                      updatePerfil({
                        inicioMesFinanceiro: Math.min(28, Math.max(1, Number(e.target.value))),
                      }),
                    )
                  }
                  className="cifra mt-1.5 text-right"
                />
                <p className="mt-1 text-[11.5px] text-ink-faint">
                  Útil para quem recebe no dia 5 e pensa o mês a partir daí.
                </p>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-control border border-line p-3 sm:col-span-2">
                <div>
                  <Label htmlFor="ocultar" className="text-ink">
                    Ocultar valores por padrão
                  </Label>
                  <p className="mt-0.5 text-[12px] text-ink-muted">
                    Substitui as cifras por pontos. Bom para usar em lugar público.
                  </p>
                </div>
                <Switch
                  id="ocultar"
                  checked={perfil.ocultarValores}
                  onCheckedChange={(v) => executar(() => updatePerfil({ ocultarValores: v }))}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categorias">
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Categorias e orçamentos</CardTitle>
                <CardDescription>
                  Categorias podem ter subcategorias e um teto mensal. Estourar o teto gera um aviso no
                  dashboard.
                </CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setCatEditando(null);
                  setCatDialog(true);
                }}
              >
                <Plus />
                Nova
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {raizes.map((mae) => {
                const filhas = categorias.filter((c) => c.paiId === mae.id);
                return (
                  <div key={mae.id} className="rounded-control border border-line">
                    <LinhaCategoria
                      categoria={mae}
                      gasto={totalGasto(mae.id)}
                      onEditar={() => {
                        setCatEditando(mae);
                        setCatDialog(true);
                      }}
                      onExcluir={() => setExcluirCat(mae)}
                    />
                    {filhas.length > 0 && (
                      <ul className="border-t border-line">
                        {filhas.map((f) => (
                          <li key={f.id} className="border-b border-line last:border-0">
                            <LinhaCategoria
                              categoria={f}
                              gasto={totalGasto(f.id)}
                              recuada
                              onEditar={() => {
                                setCatEditando(f);
                                setCatDialog(true);
                              }}
                              onExcluir={() => setExcluirCat(f)}
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dados">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Backup</CardTitle>
                <CardDescription>
                  Seus dados ficam no navegador deste dispositivo. Limpar o histórico do navegador apaga
                  tudo — exporte com frequência.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-control border border-line p-3">
                  <p className="text-[13px] font-medium">O que está guardado</p>
                  <ul className="mt-2 grid grid-cols-2 gap-1 text-[12px] text-ink-muted">
                    <li>{estado.transacoes.length} lançamentos</li>
                    <li>{estado.contas.length} contas</li>
                    <li>{estado.cartoes.length} cartões</li>
                    <li>{estado.categorias.length} categorias</li>
                    <li>{estado.ativos.length} ativos</li>
                    <li>{estado.dividas.length} dívidas</li>
                    <li>{estado.metas.length} metas</li>
                    <li>{estado.recorrencias.length} recorrências</li>
                  </ul>
                </div>

                <Button
                  variant="contorno"
                  className="w-full"
                  onClick={() => {
                    exportarBackup(estado);
                    toast.success('Backup exportado');
                  }}
                >
                  <Download />
                  Exportar backup (.json)
                </Button>

                <div>
                  <input
                    id="importar"
                    type="file"
                    accept="application/json"
                    className="sr-only"
                    onChange={(e) => {
                      importarArquivo(e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />
                  <Button asChild variant="contorno" className="w-full">
                    <label htmlFor="importar" className="cursor-pointer">
                      <Upload />
                      Restaurar de um backup
                    </label>
                  </Button>
                  <p className="mt-1.5 text-[11.5px] text-ink-faint">
                    Restaurar substitui tudo que está aqui hoje.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recomeçar</CardTitle>
                <CardDescription>Duas formas de zerar, com efeitos diferentes.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-control border border-line p-3">
                  <div className="flex items-center gap-2">
                    <Database className="size-4 text-aco" />
                    <p className="text-[13px] font-medium">Carregar dados de exemplo</p>
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">
                    Substitui tudo por uma carteira fictícia com seis meses de histórico. Serve para
                    explorar o sistema.
                  </p>
                  <Button variant="contorno" size="sm" className="mt-3" onClick={() => setConfirmarDemo(true)}>
                    <RotateCcw />
                    Carregar exemplo
                  </Button>
                </div>

                <div className="rounded-control border border-coral/30 bg-coral-soft p-3">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="size-4 text-coral" />
                    <p className="text-[13px] font-medium text-coral">Apagar todos os dados</p>
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">
                    Remove lançamentos, contas, cartões, dívidas e metas. Seu perfil é mantido. Exporte um
                    backup antes.
                  </p>
                  <Button variant="perigo" size="sm" className="mt-3" onClick={() => setConfirmarLimpeza(true)}>
                    <Trash2 />
                    Apagar tudo
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="seguranca">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Bloqueio por PIN</CardTitle>
                <CardDescription>
                  Pede um código ao abrir o aplicativo. Protege de quem pega seu dispositivo destravado.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {perfil.bloqueioPin ? (
                  <>
                    <Badge tom="positivo">
                      <Lock />
                      PIN ativo
                    </Badge>
                    <Button
                      variant="contorno"
                      className="w-full"
                      onClick={() => {
                        updatePerfil({ bloqueioPin: null });
                        toast.success('PIN removido');
                      }}
                    >
                      Remover PIN
                    </Button>
                  </>
                ) : (
                  <>
                    <div>
                      <Label htmlFor="novo-pin">Defina um PIN de 4 a 8 dígitos</Label>
                      <Input
                        id="novo-pin"
                        type="password"
                        inputMode="numeric"
                        value={pin}
                        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                        className="mt-1.5 text-center text-lg tracking-[0.4em]"
                      />
                    </div>
                    <Button
                      className="w-full"
                      disabled={pin.length < 4}
                      onClick={() => {
                        updatePerfil({ bloqueioPin: pin });
                        setPin('');
                        toast.success('PIN definido');
                      }}
                    >
                      Ativar bloqueio
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Honestidade sobre o modelo de segurança importa mais que um selo de "protegido". */}
            <Card className="border-ambar/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="size-4 text-ambar" />
                  O que este PIN não protege
                </CardTitle>
                <CardDescription>Leia antes de guardar dados reais aqui.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-[12.5px] leading-relaxed text-ink-muted">
                <p>
                  Não existe servidor nem conta de verdade nesta versão. Tudo fica no{' '}
                  <code className="rounded bg-surface-sunken px-1 py-0.5 text-[11.5px]">localStorage</code> do
                  navegador, sem criptografia.
                </p>
                <p>
                  O PIN é uma barreira de interface: qualquer pessoa com acesso ao console do navegador
                  consegue ler os dados sem passar por ele.
                </p>
                <p>
                  Para uso real, o passo é trocar <code className="rounded bg-surface-sunken px-1 py-0.5 text-[11.5px]">lib/sessao.ts</code>{' '}
                  por um provedor de autenticação e mover os dados para um banco com autorização por
                  usuário. Os detalhes estão em{' '}
                  <code className="rounded bg-surface-sunken px-1 py-0.5 text-[11.5px]">docs/SEGURANCA.md</code>.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <DialogCategoria aberto={catDialog} onAbertoChange={setCatDialog} categoria={catEditando} />

      <Confirmar
        aberto={Boolean(excluirCat)}
        onAbertoChange={(v) => !v && setExcluirCat(null)}
        titulo={`Excluir a categoria "${excluirCat?.nome ?? ''}"?`}
        descricao="Os lançamentos ficam sem categoria e as subcategorias sobem um nível. Nada é apagado além da categoria."
        rotuloConfirmar="Excluir categoria"
        onConfirmar={() => {
          if (excluirCat) {
            executar(() => removeCategoria(excluirCat.id), {
              sucesso: 'Categoria excluída',
              aoFalhar: 'Não foi possível excluir a categoria',
            });
          }
        }}
      />

      <Confirmar
        aberto={confirmarDemo}
        onAbertoChange={setConfirmarDemo}
        titulo="Carregar os dados de exemplo?"
        descricao="Tudo que está aqui hoje será substituído pela carteira fictícia. Exporte um backup antes se quiser manter seus dados."
        rotuloConfirmar="Carregar exemplo"
        onConfirmar={() =>
          executar(restaurarDemo, {
            sucesso: 'Dados de exemplo carregados',
            aoFalhar: 'Não foi possível carregar a demonstração',
          })
        }
      />

      <Confirmar
        aberto={confirmarLimpeza}
        onAbertoChange={setConfirmarLimpeza}
        titulo="Apagar todos os dados?"
        descricao="Lançamentos, contas, cartões, categorias, investimentos, dívidas e metas serão removidos da sua conta, em todos os dispositivos. Isso não pode ser desfeito."
        rotuloConfirmar="Apagar tudo"
        onConfirmar={() =>
          executar(limparTudo, {
            sucesso: 'Dados apagados',
            aoFalhar: 'Não foi possível apagar os dados',
          })
        }
      />
    </div>
  );
}

function LinhaCategoria({
  categoria,
  gasto,
  recuada,
  onEditar,
  onExcluir,
}: {
  categoria: Categoria;
  gasto: number;
  recuada?: boolean;
  onEditar: () => void;
  onExcluir: () => void;
}) {
  const estourou = categoria.orcamento ? gasto > categoria.orcamento : false;
  return (
    <div className={cn('flex flex-wrap items-center gap-3 p-3', recuada && 'pl-9')}>
      <span className="size-3 shrink-0 rounded-[4px]" style={{ background: categoria.cor }} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="truncate text-[13.5px] font-medium">{categoria.nome}</p>
          <Badge tom={categoria.tipo === 'receita' ? 'positivo' : 'neutro'}>
            {categoria.tipo === 'receita' ? 'entrada' : 'saída'}
          </Badge>
          {estourou && <Badge tom="critico">acima do teto</Badge>}
        </div>
        {categoria.orcamento ? (
          <p className="text-[11.5px] text-ink-faint">
            teto de {moeda(categoria.orcamento)} por mês
          </p>
        ) : null}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="fantasma" size="icone-sm" aria-label={`Ações de ${categoria.nome}`}>
            <Pencil />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onEditar}>
            <Pencil />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem destrutivo onSelect={onExcluir}>
            <Trash2 />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function DialogCategoria({
  aberto,
  onAbertoChange,
  categoria,
}: {
  aberto: boolean;
  onAbertoChange: (v: boolean) => void;
  categoria?: Categoria | null;
}) {
  const { categorias, addCategoria, updateCategoria } = useFinancas();
  const { executando, executar } = useAcao();
  const [form, setForm] = React.useState({
    nome: '',
    tipo: 'despesa' as Categoria['tipo'],
    cor: CORES_CARTAO[0],
    paiId: '',
    orcamento: 0,
  });
  const [erro, setErro] = React.useState('');

  React.useEffect(() => {
    if (!aberto) return;
    setErro('');
    setForm(
      categoria
        ? {
            nome: categoria.nome,
            tipo: categoria.tipo,
            cor: categoria.cor,
            paiId: categoria.paiId ?? '',
            orcamento: categoria.orcamento ?? 0,
          }
        : {
            nome: '',
            tipo: 'despesa',
            cor: CORES_CARTAO[Math.floor(Math.random() * CORES_CARTAO.length)],
            paiId: '',
            orcamento: 0,
          },
    );
  }, [aberto, categoria]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Uma categoria não pode ser mãe dela mesma nem filha de uma subcategoria.
  const possiveisPais = categorias.filter(
    (c) => !c.paiId && c.tipo === form.tipo && c.id !== categoria?.id,
  );

  const salvar = async () => {
    if (!form.nome.trim()) return setErro('Dê um nome à categoria.');

    const dados = {
      nome: form.nome.trim(),
      tipo: form.tipo,
      cor: form.cor,
      icone: 'Tag',
      paiId: form.paiId || null,
      orcamento: form.orcamento || undefined,
      arquivada: false,
    };

    const ok = await executar(
      () => (categoria ? updateCategoria(categoria.id, dados) : addCategoria(dados)),
      {
        sucesso: categoria ? 'Categoria atualizada' : 'Categoria criada',
        aoFalhar: 'A categoria não foi salva',
      },
    );
    if (ok) onAbertoChange(false);
  };

  return (
    <Dialog open={aberto} onOpenChange={onAbertoChange}>
      <DialogContent largura="max-w-lg">
        <DialogHeader>
          <DialogTitle>{categoria ? 'Editar categoria' : 'Nova categoria'}</DialogTitle>
          <DialogDescription>
            Subcategorias ajudam a separar "mercado" de "restaurantes" sem perder o total de alimentação.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="nome-cat">Nome</Label>
            <Input
              id="nome-cat"
              value={form.nome}
              onChange={(e) => set('nome', e.target.value)}
              placeholder="Alimentação, transporte…"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="tipo-cat">Tipo</Label>
            <Select
              value={form.tipo}
              onValueChange={(v) => {
                set('tipo', v as Categoria['tipo']);
                set('paiId', '');
              }}
            >
              <SelectTrigger id="tipo-cat" className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="despesa">Saída</SelectItem>
                <SelectItem value="receita">Entrada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="pai-cat">Categoria-mãe</Label>
            <Select value={form.paiId} onValueChange={(v) => set('paiId', v)}>
              <SelectTrigger id="pai-cat" className="mt-1.5">
                <SelectValue placeholder="Nenhuma (primeiro nível)" />
              </SelectTrigger>
              <SelectContent>
                {possiveisPais.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {form.tipo === 'despesa' && (
            <div className="sm:col-span-2">
              <Label htmlFor="orcamento-cat">Teto mensal</Label>
              <div className="mt-1.5">
                <CampoValor
                  id="orcamento-cat"
                  value={form.orcamento}
                  onChange={(v) => set('orcamento', v)}
                />
              </div>
              <p className="mt-1 text-[11.5px] text-ink-faint">
                Deixe zerado para não acompanhar orçamento nesta categoria.
              </p>
            </div>
          )}

          <div className="sm:col-span-2">
            <Label>Cor</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {CORES_CARTAO.map((cor) => (
                <button
                  key={cor}
                  type="button"
                  onClick={() => set('cor', cor)}
                  aria-label={`Cor ${cor}`}
                  aria-pressed={form.cor === cor}
                  className={cn(
                    'size-7 rounded-full',
                    form.cor === cor && 'ring-2 ring-ring ring-offset-2 ring-offset-[hsl(var(--surface-raised))]',
                  )}
                  style={{ background: cor }}
                />
              ))}
            </div>
          </div>
        </div>

        {erro && (
          <p role="alert" className="text-[12px] text-coral">
            {erro}
          </p>
        )}

        <DialogFooter>
          <Button variant="contorno" onClick={() => onAbertoChange(false)}>
            Cancelar
          </Button>
          <Button onClick={salvar}>{categoria ? 'Salvar alterações' : 'Criar categoria'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
