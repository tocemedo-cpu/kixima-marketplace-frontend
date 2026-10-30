import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { mensagemDeErro } from '../../api/client';
import { fornecedoresVerificados } from '../../api/endpoints/mercado';
import { useAsync } from '../../lib/useAsync';
import { Alert, Breadcrumb, Button, EmptyState, ErrorState, Input, Skeleton } from '../../ui';
import CartaoFornecedor from './CartaoFornecedor';

/**
 * Directório de fornecedores verificados. O backend só expõe os fornecedores verificados em destaque
 * (GET /api/public/catalog/suppliers, sem pesquisa; até 24); para procurar um fornecedor pelo nome usa-se a
 * pesquisa do catálogo, onde o nome do fornecedor é pesquisável.
 */
export default function Fornecedores() {
  const navegar = useNavigate();
  const [q, setQ] = useState('');
  const lista = useAsync((signal) => fornecedoresVerificados(24, { signal }), []);

  return (
    <div className="kx-container kx-pagina">
      <Breadcrumb items={[{ label: 'Início', to: '/' }, { label: 'Fornecedores verificados' }]} />
      <header className="kx-pagina__cabeca">
        <h1>Fornecedores verificados</h1>
        <p className="kx-pagina__sub">Empresas credenciadas na KIXIMA, com due diligence feita uma vez e válida para todos os compradores.</p>
      </header>

      <form className="kx-form kx-form--linha" role="search" onSubmit={(e) => { e.preventDefault(); navegar(`/produtos?q=${encodeURIComponent(q.trim())}`); }}>
        <label htmlFor="busca-fornecedor" className="kx-sr-only">Procurar por nome de fornecedor</label>
        <Input id="busca-fornecedor" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome do fornecedor, produto ou serviço" />
        <Button type="submit" variant="primary" leftIcon="search">Procurar no catálogo</Button>
      </form>

      {lista.status === 'carregando' ? <Skeleton lines={4} />
        : lista.status === 'erro' ? <ErrorState description={mensagemDeErro(lista.error)} detalhe={lista.error?.code} onRetry={lista.recarregar} />
          : !lista.data.length ? <EmptyState icon="building" title="Ainda não há fornecedores verificados" description="Os fornecedores aparecem aqui depois de concluírem o credenciamento." />
            : (
              <>
                <ul className="kx-fornecedores kx-fornecedores--pagina">{lista.data.map((f) => <li key={f.id}><CartaoFornecedor fornecedor={f} /></li>)}</ul>
                <Alert tone="info">Esta lista mostra os fornecedores verificados em destaque. Para ver todas as ofertas de um fornecedor, pesquise pelo nome dele no catálogo.</Alert>
              </>
            )}
    </div>
  );
}
