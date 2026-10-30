// Páginas institucionais estáticas: FAQ, Termos de Uso, Política de Privacidade e "não encontrada".
// Os textos são os já existentes da KIXIMA (home corporativa e legalContent.js do frontend original).
import { Link } from 'react-router-dom';
import { Button, EmptyState } from '../../ui';
import { LEGAL_PT } from './legalConteudo';

const FAQ = [
  ['Como registo a minha empresa na KIXIMA?', <>Submeta os dados e documentos da sua empresa através do registo. A nossa equipa realiza um processo de credenciamento e verificação antes da aprovação. <Link to="/cadastro">Iniciar registo</Link></>],
  ['Qual a diferença entre registar como comprador ou como fornecedor?', 'Como comprador, tem acesso a um catálogo de fornecedores credenciados e pode transformar necessidades em ordens de compra rastreáveis. Como fornecedor, apresenta o seu catálogo, responde a pedidos e recebe ordens de compra organizadas.'],
  ['Como funciona o pagamento aos fornecedores?', 'A KIXIMA garante rastreabilidade em todo o processo, desde o pedido até à entrega e recepção, com pagamento processado num prazo definido e comunicado na plataforma.'],
  ['Preciso de pagar para registar a minha empresa?', <>Consulte os nossos <Link to="/planos">planos e preços</Link> para conhecer as condições disponíveis para compradores e fornecedores.</>],
  ['Como posso obter apoio depois de me registar?', <>Depois de aceder à sua conta, encontra o centro de ajuda e o chat de suporte na plataforma. Também pode contactar-nos diretamente por email: <a href="mailto:geral@kixima.net">geral@kixima.net</a>.</>],
  ['Onde encontro as regras e a política de privacidade da plataforma?', <><Link to="/termos">Termos de uso</Link> e <Link to="/privacidade">Política de privacidade</Link>.</>],
];

export function Faq() {
  return (
    <div className="kx-container kx-pagina kx-pagina--texto">
      <header className="kx-pagina__cabeca">
        <p className="kx-eyebrow kx-eyebrow--escuro">Ajuda</p>
        <h1>Perguntas frequentes</h1>
        <p className="kx-pagina__sub">Respostas rápidas às dúvidas mais comuns sobre como funciona a KIXIMA.NET.</p>
      </header>
      <div className="kx-faq">
        {FAQ.map(([q, r]) => <details key={q}><summary>{q}</summary><div className="kx-faq__resposta">{r}</div></details>)}
      </div>
    </div>
  );
}

function Documento({ doc, outro }) {
  return (
    <div className="kx-container kx-pagina kx-pagina--texto">
      <header className="kx-pagina__cabeca">
        <p className="kx-eyebrow kx-eyebrow--escuro">KIXIMA {LEGAL_PT.tagline}</p>
        <h1>{doc.title.charAt(0) + doc.title.slice(1).toLowerCase()}</h1>
        <p className="kx-pagina__sub">{LEGAL_PT.updatedLabel}: {LEGAL_PT.updated}</p>
        <p className="kx-no-print"><Button onClick={() => window.print()} size="sm">{LEGAL_PT.print}</Button></p>
      </header>
      <article className="kx-legal">
        {doc.sections.map((s) => (
          <section key={s.n}>
            <h2>{s.n}. {s.title}</h2>
            {s.paras.map((p, i) => <p key={i}>{p}</p>)}
          </section>
        ))}
      </article>
      <p className="kx-legal__outro kx-no-print">{LEGAL_PT.also} <Link to={outro.to}>{outro.rotulo}</Link></p>
    </div>
  );
}

export const Termos = () => <Documento doc={LEGAL_PT.terms} outro={{ to: '/privacidade', rotulo: LEGAL_PT.privacyLink }} />;
export const Privacidade = () => <Documento doc={LEGAL_PT.privacy} outro={{ to: '/termos', rotulo: LEGAL_PT.termsLink }} />;

export function NaoEncontrada() {
  return (
    <div className="kx-container kx-pagina">
      <EmptyState icon="search" title="Página não encontrada" description="O endereço que abriu não existe ou foi movido." action={<Button as={Link} to="/" variant="primary">Ir para o início</Button>} />
    </div>
  );
}
