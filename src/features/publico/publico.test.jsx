import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { descreverPlano } from './Planos';
import { montarApp } from '../../test/utils';
import fxStats from '../../test/fixtures/publico-stats.json';
import fxFeedback from '../../test/fixtures/publico-feedback.json';
import fxPlanos from '../../test/fixtures/planos.json';

const ROTAS_PUBLICAS = { 'GET /api/public/stats': fxStats, 'GET /api/public/feedback': fxFeedback, 'GET /api/planos': fxPlanos };

describe('planos', () => {
  it('descreverPlano traduz limites (null = sem limite) e funcionalidades', () => {
    const base = descreverPlano(fxPlanos.planos[0].features);
    expect(base).toContain('Catálogo sem limite de itens');
    expect(base).toContain('2 utilizadores incluídos');
    expect(base).toContain('3 pedidos de cotação por mês');
    expect(base).toContain('3 imagens e 1 documento técnico por item');
    const pro = descreverPlano(fxPlanos.planos[2].features);
    expect(pro).toContain('Utilizadores sem limite');
    expect(pro).toContain('Pedidos de cotação sem limite');
    expect(pro).toContain('Integração com ERP');
    expect(base).not.toContain('Integração com ERP');
  });

  it('a página mostra os preços e a taxa por transação exactamente como a API', async () => {
    montarApp('/planos', { rotas: ROTAS_PUBLICAS });
    expect(await screen.findByRole('heading', { name: 'Base' })).toBeInTheDocument();
    expect(screen.getAllByText(/US\$/).length).toBeGreaterThan(3);
    const taxa = document.querySelector('.kx-taxa').textContent.replace(/\s/g, ' ');
    expect(taxa).toMatch(/8,00/); expect(taxa).toMatch(/15,00/); expect(taxa).toMatch(/11\s?500/); expect(taxa).toMatch(/0,2/);
    expect(screen.getByText(/A Taxa KIXIMA é cobrada ao/)).toBeInTheDocument();
  });

  it('não escreve nenhum valor de taxa que a API não tenha devolvido', async () => {
    montarApp('/planos', { rotas: { ...ROTAS_PUBLICAS, 'GET /api/planos': { ...fxPlanos, taxaPorTransacao: { porOrdemUsd: 3, porFaturaUsd: 4, limiarUsd: 5000, percentagemAcima: 0.015 } } } });
    await screen.findByRole('heading', { name: 'Base' });
    const taxa = document.querySelector('.kx-taxa').textContent.replace(/\s/g, ' ');
    expect(taxa).toMatch(/3,00/); expect(taxa).toMatch(/1,5%/); expect(taxa).not.toMatch(/15,00/);
  });
});

describe('páginas institucionais', () => {
  it('FAQ abre/fecha perguntas; Termos e Privacidade mostram o texto existente', async () => {
    const { unmount } = montarApp('/faq', { rotas: {} });
    expect(await screen.findByText('Como registo a minha empresa na KIXIMA?')).toBeInTheDocument();
    unmount();
    montarApp('/termos', { rotas: {} });
    expect(await screen.findByRole('heading', { level: 1, name: /Termos de uso/i })).toBeInTheDocument();
    expect(screen.getByText(/1\. O que é a KIXIMA/)).toBeInTheDocument();
  });

  it('rota inexistente mostra a página 404 com saída', async () => {
    montarApp('/nao-existe', { rotas: {} });
    expect(await screen.findByText('Página não encontrada')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('link', { name: 'Ir para o início' })).toHaveAttribute('href', '/'));
  });
});
