import { useTema } from '../design/TemaContext';
import Icon from './Icon';

/** Seletor de fundo (Sistema / Claro / Escuro 1 / Escuro 2). Um <select> nativo: acessível em teclado e telemóvel. */
export default function TemaSeletor({ className = '' }) {
  const { escolha, definir, temas } = useTema();
  return (
    <label className={`kx-tema ${className}`.trim()}>
      <Icon name="palette" size={16} />
      <span className="kx-sr-only">Fundo da aplicação</span>
      <select value={escolha} onChange={(e) => definir(e.target.value)} className="kx-tema__select" aria-label="Fundo da aplicação">
        {temas.map((t) => <option key={t.id} value={t.id} title={t.titulo}>{t.label}</option>)}
      </select>
    </label>
  );
}
