// Blocos de confiança da homepage. Os números vêm de GET /api/public/stats e as avaliações de GET /api/public/feedback:
// nada é inventado nem estático.
import { mensagemDeErro } from '../../api/client';
import { estatisticas, avaliacoes } from '../../api/endpoints/publico';
import { formatarData, formatarNumero } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';
import { Badge, Card, CardBody, ErrorState, Skeleton } from '../../ui';

export function Numeros() {
  const e = useAsync((signal) => estatisticas({ signal }), []);
  if (e.status === 'carregando') return <ul className="kx-numeros" aria-hidden="true">{Array.from({ length: 4 }, (_, i) => <li key={i}><Skeleton height="64px" /></li>)}</ul>;
  if (e.status === 'erro') return <ErrorState title="Não foi possível carregar os números" description={mensagemDeErro(e.error)} onRetry={e.recarregar} />;
  const d = e.data;
  const itens = [
    [d.empresasVerificadas, 'Empresas verificadas', 'credenciadas na plataforma'],
    [d.fornecedoresQualificados, 'Fornecedores qualificados', 'com due diligence feita uma vez, válida para todos os compradores'],
    [d.ordensProcessadas, 'Ordens de compra concluídas', 'com registo integral do ciclo, da cesta ao pagamento'],
    [d.pagamentoSlaDias, 'Dias', 'prazo de pagamento ao fornecedor, contado da recepção validada'],
  ];
  return (
    <ul className="kx-numeros">
      {itens.map(([n, t, s]) => (
        <li key={t}><strong className="kx-numeros__n">{formatarNumero(n)}</strong><span className="kx-numeros__t">{t}</span><span className="kx-numeros__s">{s}</span></li>
      ))}
    </ul>
  );
}

export function Avaliacoes({ ocultarVazio = false }) {
  const a = useAsync((signal) => avaliacoes({ signal }), []);
  if (a.status === 'carregando') return <Skeleton lines={3} />;
  if (a.status === 'erro') return <ErrorState title="Não foi possível carregar as avaliações" description={mensagemDeErro(a.error)} onRetry={a.recarregar} />;
  if (!a.data.feedback.length && ocultarVazio) return null;
  if (!a.data.feedback.length) {
    return <p className="kx-vazio-texto">Ainda não há avaliações públicas. Seja o primeiro a partilhar a sua experiência: inicie sessão e vá a Suporte → Feedback.</p>;
  }
  return (
    <>
      <p className="kx-avaliacoes__resumo"><strong>{a.data.average.toLocaleString('pt-AO', { minimumFractionDigits: 1 })}</strong> / 5 · {formatarNumero(a.data.total)} {a.data.total === 1 ? 'avaliação' : 'avaliações'} verificadas</p>
      <ul className="kx-avaliacoes kx-avaliacoes--cartoes">
        {a.data.feedback.map((f) => (
          <li key={f.id}>
            <Card><CardBody>
              <p><strong>{f.rating} / 5</strong> {f.verified ? <Badge tone="success" dot>Verificado</Badge> : null}</p>
              <p>“{f.message}”</p>
              <p className="kx-vazio-texto">{[f.user?.name, f.company?.name].filter(Boolean).join(' · ') || 'Utilizador da plataforma'} · {formatarData(f.createdAt)}</p>
            </CardBody></Card>
          </li>
        ))}
      </ul>
    </>
  );
}

