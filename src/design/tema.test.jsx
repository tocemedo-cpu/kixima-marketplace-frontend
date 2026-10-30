import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { CHAVE_TEMA, TemaProvider } from './TemaContext';
import { TemaSeletor } from '../ui';

const raiz = () => document.documentElement;

describe('tema', () => {
  it('sem escolha guardada não fixa nenhum tema (segue o sistema)', () => {
    render(<TemaProvider><TemaSeletor /></TemaProvider>);
    expect(raiz()).not.toHaveAttribute('data-tema');
    expect(screen.getByLabelText('Fundo da aplicação')).toHaveValue('sistema');
  });

  it('escolher um fundo fixa data-tema e guarda a escolha', async () => {
    render(<TemaProvider><TemaSeletor /></TemaProvider>);
    await userEvent.selectOptions(screen.getByLabelText('Fundo da aplicação'), 'escuro-2');
    expect(raiz()).toHaveAttribute('data-tema', 'escuro-2');
    expect(localStorage.getItem(CHAVE_TEMA)).toBe('escuro-2');
  });

  it('voltar a "Sistema" remove o atributo e a escolha guardada', async () => {
    localStorage.setItem(CHAVE_TEMA, 'claro');
    render(<TemaProvider><TemaSeletor /></TemaProvider>);
    expect(raiz()).toHaveAttribute('data-tema', 'claro');
    await userEvent.selectOptions(screen.getByLabelText('Fundo da aplicação'), 'sistema');
    expect(raiz()).not.toHaveAttribute('data-tema');
    expect(localStorage.getItem(CHAVE_TEMA)).toBeNull();
  });

  it('ignora um valor guardado inválido', () => {
    localStorage.setItem(CHAVE_TEMA, 'roxo');
    render(<TemaProvider><TemaSeletor /></TemaProvider>);
    expect(raiz()).not.toHaveAttribute('data-tema');
  });
});
