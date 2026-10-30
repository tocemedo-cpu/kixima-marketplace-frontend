// Planos e preços — tudo vem de GET /api/planos (público): o que a página promete é, por construção, o que a
// plataforma faz. Os rótulos das funcionalidades traduzem as chaves do backend; nada de valores escritos à mão.
import { Link } from 'react-router-dom';
import { planos } from '../../api/endpoints/publico';
import { mensagemDeErro } from '../../api/client';
import { formatarNumero, formatarPreco } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';
import { Alert, Badge, Button, Card, CardBody, ErrorState, Icon, Skeleton } from '../../ui';

const NOME = { BASE: 'Base', CORE: 'Core', PRO: 'Pro' };
const PERIODO = { MENSAL: 'por mês', TRIMESTRAL: 'por trimestre', ANUAL: 'por ano' };

/** Converte as funcionalidades do plano (chaves do backend) em frases. `null` num limite = sem limite. */
export function descreverPlano(f) {
  const l = [];
  l.push(f.itensNoCatalogo === null ? 'Catálogo sem limite de itens' : `Até ${formatarNumero(f.itensNoCatalogo)} itens no catálogo`);
  l.push(f.lugaresIncluidos === null ? 'Utilizadores sem limite' : `${f.lugaresIncluidos} utilizadores incluídos`);
  l.push(f.cotacoesPorMes === null ? 'Pedidos de cotação sem limite' : `${f.cotacoesPorMes} pedidos de cotação por mês`);
  l.push(`${f.imagensPorItem} imagens e ${f.documentosPorItem} documento${f.documentosPorItem === 1 ? '' : 's'} técnico${f.documentosPorItem === 1 ? '' : 's'} por item`);
  l.push(f.historicoRelatoriosMeses === null ? 'Histórico de relatórios sem limite' : `Histórico de relatórios de ${f.historicoRelatoriosMeses} meses`);
  if (f.kits) l.push('Kits e pacotes de produtos');
  if (f.carregamentoEmMassa) l.push('Carregamento de catálogo em massa por Excel');
  if (f.selo) l.push('Selo de fornecedor');
  if (f.posicaoNaPesquisa > 0) l.push('Prioridade na pesquisa');
  if (f.frameworkContracts) l.push('Contratos-quadro');
  if (f.erpIntegration) l.push('Integração com ERP');
  if (f.relatorioConteudoLocal) l.push('Relatório de conteúdo local');
  if (f.apiCatalogo) l.push('API de catálogo');
  if (f.categoryManagement) l.push('Gestão de categorias (economia de escala)');
  if (f.supplierComparison) l.push('Comparação de fornecedores');
  if (f.auditTrail) l.push('Registo de auditoria');
  return l;
}

export default function Planos() {
  const dados = useAsync((signal) => planos({ signal }), []);

  return (
    <div className="kx-container kx-pagina">
      <header className="kx-pagina__cabeca">
        <h1>Planos e preços</h1>
        <p className="kx-pagina__sub">Uma taxa de acesso por plano e uma taxa por transação cobrada ao fornecedor. Os valores abaixo são os que a plataforma aplica.</p>
      </header>

      {dados.status === 'carregando' ? <Skeleton lines={6} />
        : dados.status === 'erro' ? <ErrorState description={mensagemDeErro(dados.error)} detalhe={dados.error?.code} onRetry={dados.recarregar} />
          : (
            <>
              <ul className="kx-planos">
                {dados.data.planos.map((p) => {
                  const preco = p.preco;
                  return (
                    <li key={p.plano}>
                      <Card className={`kx-plano ${p.plano === 'PRO' ? 'kx-plano--destaque' : ''}`}>
                        <CardBody>
                          <h2>{NOME[p.plano] || p.plano}</h2>
                          <p className="kx-plano__preco"><strong>{formatarPreco(preco.valorUsd, 'USD')}</strong> <span>{PERIODO[preco.periodo] || ''}</span></p>
                          {preco.meses > 1 ? <p className="kx-plano__mes">≈ {formatarPreco(preco.porMesUsd, 'USD')} por mês</p> : null}
                          <ul className="kx-checks">{descreverPlano(p.features).map((t) => <li key={t}>{t}</li>)}</ul>
                        </CardBody>
                      </Card>
                    </li>
                  );
                })}
              </ul>

              <Card className="kx-taxa">
                <CardBody>
                  <h2><Icon name="file" size={20} /> Taxa por transação (Taxa KIXIMA)</h2>
                  <p>
                    <strong>{formatarPreco(dados.data.taxaPorTransacao.porOrdemUsd, 'USD')}</strong> por ordem de compra e{' '}
                    <strong>{formatarPreco(dados.data.taxaPorTransacao.porFaturaUsd, 'USD')}</strong> por fatura. Acima de{' '}
                    <strong>{formatarPreco(dados.data.taxaPorTransacao.limiarUsd, 'USD')}</strong>, aplica-se{' '}
                    <strong>{(dados.data.taxaPorTransacao.percentagemAcima * 100).toLocaleString('pt-AO', { maximumFractionDigits: 2 })}%</strong> do valor, a cobrir as duas parcelas.
                  </p>
                  <Alert tone="info">A Taxa KIXIMA é cobrada ao <strong>fornecedor</strong>, à parte da ordem de compra e da fatura. O comprador não a paga.</Alert>
                </CardBody>
              </Card>

              <p className="kx-planos__cta">
                <Button as={Link} to="/cadastro" variant="primary" size="lg">Registar empresa</Button>{' '}
                <Badge>Preços em USD</Badge>
              </p>
            </>
          )}
    </div>
  );
}
