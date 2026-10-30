// Endpoints SEM sessão (GET /api/public/stats, /api/public/feedback, /api/planos).
import { api } from '../client';
import { lista, num, obj, str, validar, qualquer } from '../schema';

const Estatisticas = obj({
  empresasVerificadas: num, fornecedoresQualificados: num, ordensProcessadas: num, pagamentoSlaDias: num,
});
const Avaliacoes = obj({ feedback: lista(qualquer), total: num, average: num });
const Planos = obj({
  planos: lista(obj({ plano: str, preco: qualquer, features: qualquer })),
  taxaPorTransacao: obj({ porOrdemUsd: num, porFaturaUsd: num, limiarUsd: num, percentagemAcima: num }),
});

export const estatisticas = async (opcoes) => validar(Estatisticas, await api.get('/api/public/stats', undefined, opcoes), 'GET /api/public/stats');
export const avaliacoes = async (opcoes) => validar(Avaliacoes, await api.get('/api/public/feedback', undefined, opcoes), 'GET /api/public/feedback');
export const planos = async (opcoes) => validar(Planos, await api.get('/api/planos', undefined, opcoes), 'GET /api/planos');
