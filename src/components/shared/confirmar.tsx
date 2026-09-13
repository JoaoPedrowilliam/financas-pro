'use client';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

/**
 * Confirmação para ações destrutivas.
 * O botão repete o verbo da ação ("Excluir conta"), nunca um "OK" genérico:
 * a pessoa precisa ler o que vai acontecer sem voltar ao título.
 */
export function Confirmar({
  aberto,
  onAbertoChange,
  titulo,
  descricao,
  rotuloConfirmar = 'Excluir',
  onConfirmar,
}: {
  aberto: boolean;
  onAbertoChange: (v: boolean) => void;
  titulo: string;
  descricao: string;
  rotuloConfirmar?: string;
  onConfirmar: () => void;
}) {
  return (
    <Dialog open={aberto} onOpenChange={onAbertoChange}>
      <DialogContent largura="max-w-md">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="contorno" onClick={() => onAbertoChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="perigo"
            onClick={() => {
              onConfirmar();
              onAbertoChange(false);
            }}
          >
            {rotuloConfirmar}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
