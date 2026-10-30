import { useState } from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  Alert, Badge, Button, Checkbox, ConfirmDialog, EmptyState, ErrorState, Field, Input, Modal, Pagination, Switch, Table, Tabs, ToastProvider, useToast, janelaDePaginas,
} from '.';

describe('Button', () => {
  it('é type="button" por omissão (não submete formulários por acidente)', () => {
    render(<Button>Guardar</Button>);
    expect(screen.getByRole('button', { name: 'Guardar' })).toHaveAttribute('type', 'button');
  });

  it('em loading fica ocupado e ignora cliques, mas continua focável', async () => {
    const aoClicar = vi.fn();
    render(<Button loading onClick={aoClicar}>Guardar</Button>);
    const b = screen.getByRole('button', { name: 'Guardar' });
    expect(b).toHaveAttribute('aria-busy', 'true');
    expect(b).not.toBeDisabled();
    await userEvent.click(b);
    expect(aoClicar).not.toHaveBeenCalled();
  });

  it('desactivado não dispara onClick', async () => {
    const aoClicar = vi.fn();
    render(<Button disabled onClick={aoClicar}>Enviar</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(aoClicar).not.toHaveBeenCalled();
  });

  it('como ligação (as="a") mantém o aspecto e bloqueia quando desactivada', async () => {
    const aoClicar = vi.fn();
    render(<Button as="a" href="#x" disabled onClick={aoClicar}>Ir</Button>);
    const a = screen.getByText('Ir').closest('a');
    expect(a).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(a);
    expect(aoClicar).not.toHaveBeenCalled();
  });
});

describe('Field', () => {
  it('liga rótulo, ajuda e erro ao controlo', () => {
    render(<Field label="NIF" hint="9 dígitos" error="NIF inválido" required><Input /></Field>);
    const campo = screen.getByLabelText(/NIF/);
    expect(campo).toBeRequired();
    expect(campo).toHaveAttribute('aria-invalid', 'true');
    const descricao = campo.getAttribute('aria-describedby').split(' ');
    expect(descricao).toHaveLength(2);
    expect(document.getElementById(descricao[0])).toHaveTextContent('9 dígitos');
    expect(screen.getByRole('alert')).toHaveTextContent('NIF inválido');
  });

  it('sem erro não marca o campo como inválido', () => {
    render(<Field label="Nome"><Input /></Field>);
    expect(screen.getByLabelText('Nome')).not.toHaveAttribute('aria-invalid');
  });

  it('Checkbox e Switch expõem o papel certo e reagem ao clique no rótulo', async () => {
    render(<><Checkbox label="Aceito" /><Switch label="Avisos" /></>);
    await userEvent.click(screen.getByText('Aceito'));
    expect(screen.getByRole('checkbox', { name: 'Aceito' })).toBeChecked();
    const sw = screen.getByRole('switch', { name: 'Avisos' });
    expect(sw).not.toBeChecked();
    await userEvent.click(screen.getByText('Avisos'));
    expect(sw).toBeChecked();
  });
});

describe('Alert e Badge', () => {
  it('erros e avisos anunciam-se como alert; informação como status', () => {
    render(<><Alert tone="danger">Falhou</Alert><Alert tone="info">Nota</Alert></>);
    expect(screen.getByRole('alert')).toHaveTextContent('Falhou');
    expect(screen.getByRole('status')).toHaveTextContent('Nota');
  });

  it('o selo comunica o estado pelo texto (a cor só reforça)', () => {
    render(<Badge tone="danger" dot>Recusado</Badge>);
    expect(screen.getByText('Recusado')).toBeInTheDocument();
  });
});

describe('Tabs', () => {
  function Exemplo() {
    const [v, setV] = useState('a');
    return <Tabs label="Exemplo" value={v} onChange={setV} items={[{ id: 'a', label: 'A', content: 'Painel A' }, { id: 'b', label: 'B', content: 'Painel B' }, { id: 'c', label: 'C', content: 'Painel C' }]} />;
  }

  it('só a aba activa está na ordem de tabulação e mostra o seu painel', () => {
    render(<Exemplo />);
    expect(screen.getByRole('tab', { name: 'A' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'B' })).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Painel A');
  });

  it('setas, Home e End movem a selecção e o foco (e dão a volta)', async () => {
    render(<Exemplo />);
    screen.getByRole('tab', { name: 'A' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'B' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'B' })).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'C' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'A' })).toHaveFocus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'C' })).toHaveFocus();
  });
});

describe('Table', () => {
  const colunas = [{ key: 'nome', header: 'Nome', sortable: true }, { key: 'qtd', header: 'Quantidade', align: 'right' }];

  it('cada célula traz o rótulo (data-label) para a vista de telemóvel', () => {
    render(<Table caption="T" columns={colunas} rows={[{ id: 1, nome: 'X', qtd: 2 }]} />);
    const celulas = screen.getAllByRole('cell');
    expect(celulas[0]).toHaveAttribute('data-label', 'Nome');
    expect(celulas[1]).toHaveAttribute('data-label', 'Quantidade');
  });

  it('ordenação: aria-sort reflecte o estado e o clique chama onSort', async () => {
    const onSort = vi.fn();
    render(<Table caption="T" columns={colunas} rows={[]} sort={{ key: 'nome', dir: 'asc' }} onSort={onSort} />);
    expect(screen.getByRole('columnheader', { name: /Nome/ })).toHaveAttribute('aria-sort', 'ascending');
    await userEvent.click(screen.getByRole('button', { name: /Nome/ }));
    expect(onSort).toHaveBeenCalledWith('nome');
  });

  it('sem linhas mostra o estado vazio; a carregar não mostra o vazio', () => {
    const { rerender } = render(<Table caption="T" columns={colunas} rows={[]} />);
    expect(screen.getByText('Sem resultados')).toBeInTheDocument();
    rerender(<Table caption="T" columns={colunas} rows={[]} loading />);
    expect(screen.queryByText('Sem resultados')).not.toBeInTheDocument();
  });

  it('vazio personalizado substitui o texto por omissão', () => {
    render(<Table caption="T" columns={colunas} rows={[]} empty={<EmptyState title="Nada por aqui" />} />);
    expect(screen.getByText('Nada por aqui')).toBeInTheDocument();
  });
});

describe('Pagination', () => {
  it('janela: primeira, última e duas de cada lado, com reticências', () => {
    expect(janelaDePaginas(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(janelaDePaginas(6, 20)).toEqual([1, '…', 4, 5, 6, 7, 8, '…', 20]);
    expect(janelaDePaginas(1, 20)).toEqual([1, 2, 3, '…', 20]);
    expect(janelaDePaginas(20, 20)).toEqual([1, '…', 18, 19, 20]);
  });

  it('marca a página actual, navega e desactiva os extremos', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<Pagination page={1} pages={9} onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Página 1' })).toHaveAttribute('aria-current', 'page');
    await userEvent.click(screen.getByRole('button', { name: 'Página seguinte' }));
    expect(onChange).toHaveBeenCalledWith(2);
    rerender(<Pagination page={9} pages={9} onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Página seguinte' })).toBeDisabled();
  });

  it('com uma só página não desenha nada', () => {
    const { container } = render(<Pagination page={1} pages={1} onChange={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('Modal', () => {
  function Exemplo() {
    const [aberto, setAberto] = useState(false);
    return (
      <>
        <button onClick={() => setAberto(true)}>Abrir</button>
        <Modal open={aberto} onClose={() => setAberto(false)} title="Título" footer={<button>Guardar</button>}>
          <input aria-label="Campo" />
        </Modal>
      </>
    );
  }

  it('abre como diálogo modal nomeado, foca o primeiro controlo e bloqueia a rolagem', async () => {
    render(<Exemplo />);
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    const d = screen.getByRole('dialog', { name: 'Título' });
    expect(d).toHaveAttribute('aria-modal', 'true');
    expect(within(d).getByRole('button', { name: 'Fechar' })).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('prende o foco (Tab e Shift+Tab dão a volta) e Esc fecha devolvendo o foco', async () => {
    render(<Exemplo />);
    const abrir = screen.getByRole('button', { name: 'Abrir' });
    await userEvent.click(abrir);
    // controlos focáveis: Fechar, Campo, Guardar
    await userEvent.tab(); expect(screen.getByLabelText('Campo')).toHaveFocus();
    await userEvent.tab(); expect(screen.getByRole('button', { name: 'Guardar' })).toHaveFocus();
    await userEvent.tab(); expect(screen.getByRole('button', { name: 'Fechar' })).toHaveFocus();
    await userEvent.tab({ shift: true }); expect(screen.getByRole('button', { name: 'Guardar' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(abrir).toHaveFocus();
    expect(document.body.style.overflow).toBe('');
  });
});

describe('ConfirmDialog', () => {
  it('só executa a operação ao confirmar e fecha no fim', async () => {
    const onConfirm = vi.fn().mockResolvedValue();
    const onClose = vi.fn();
    render(<ConfirmDialog open onClose={onClose} onConfirm={onConfirm} title="Eliminar?" confirmLabel="Eliminar">Tem a certeza?</ConfirmDialog>);
    expect(onConfirm).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('se a operação falhar mostra o erro e continua aberto', async () => {
    const onClose = vi.fn();
    render(<ConfirmDialog open onClose={onClose} onConfirm={() => Promise.reject(new Error('Sem permissão.'))} title="Pagar?">Confirma?</ConfirmDialog>);
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Sem permissão.');
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('Cancelar fecha sem executar', async () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(<ConfirmDialog open onClose={onClose} onConfirm={onConfirm} title="X">Y</ConfirmDialog>);
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('Toast', () => {
  function Gatilho() {
    const toast = useToast();
    return (<><button onClick={() => toast.success('Guardado.')}>ok</button><button onClick={() => toast.error('Falhou.')}>erro</button></>);
  }

  it('sucesso anuncia-se e desaparece sozinho; erro fica até ser fechado', () => {
    vi.useFakeTimers();
    try {
      render(<ToastProvider duracao={1000}><Gatilho /></ToastProvider>);
      act(() => { screen.getByText('ok').click(); screen.getByText('erro').click(); });
      expect(screen.getByRole('status')).toHaveTextContent('Guardado.');
      expect(screen.getByRole('alert')).toHaveTextContent('Falhou.');
      act(() => { vi.advanceTimersByTime(1500); });
      expect(screen.queryByText('Guardado.')).not.toBeInTheDocument();
      expect(screen.getByText('Falhou.')).toBeInTheDocument();
      act(() => { screen.getByRole('button', { name: 'Fechar notificação' }).click(); });
      expect(screen.queryByText('Falhou.')).not.toBeInTheDocument();
    } finally { vi.useRealTimers(); }
  });
});

describe('Estados', () => {
  it('ErrorState anuncia o erro e oferece repetir', async () => {
    const onRetry = vi.fn();
    render(<ErrorState description="Sem resposta." detalhe="SERVICO_INDISPONIVEL" onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar');
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(onRetry).toHaveBeenCalled();
  });
});
