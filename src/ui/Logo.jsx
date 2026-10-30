// Marca KIXIMA — usa SEMPRE os activos oficiais (src/assets/brand/): a versão normal sobre fundos claros
// e a invertida sobre fundos escuros. Nunca substituir por um ícone genérico.
// Os originais (460x410) ficam em assets/brand/ como mestres; a interface usa as cópias de 240 px (44 kB e 28 kB
// em vez de 156 kB e 104 kB), que continuam a ser o mesmo desenho e dão >4x de nitidez ao tamanho mostrado.
import marca from '../assets/brand/kixima-mark-240.png';
import marcaInvertida from '../assets/brand/kixima-mark-reversed-240.png';

/**
 * `reversed`: sobre uma superfície que é SEMPRE escura (a barra superior, o rodapé) — usa só a versão invertida.
 * Sem `reversed`: o logótipo segue o fundo escolhido (Claro → normal; Escuro 1 e 2 → invertido). Os dois ficam no
 * DOM e o CSS mostra um (ver ui.css); o que está escondido não chega a ser descarregado (loading="lazy").
 */
export default function Logo({ reversed = false, size = 28, net = false, showWord = true, className = '' }) {
  const dim = { width: Math.round(size * 1.12), height: size, style: { height: size, width: 'auto' } };
  const alt = showWord ? '' : 'KIXIMA';
  return (
    <span className={`kx-logo ${reversed ? 'kx-logo--reversed' : ''} ${className}`.trim()}>
      {reversed ? (
        <img src={marcaInvertida} alt={alt} className="kx-logo__mark" {...dim} />
      ) : (
        <>
          <img src={marca} alt={alt} className="kx-logo__mark kx-logo__mark--claro" loading="lazy" {...dim} />
          <img src={marcaInvertida} alt={alt} className="kx-logo__mark kx-logo__mark--escuro" loading="lazy" {...dim} />
        </>
      )}
      {showWord ? (
        <span className="kx-logo__word" style={{ fontSize: Math.round(size * 0.62) }}>
          KIXIMA{net ? <i className="kx-logo__net">.NET</i> : null}
        </span>
      ) : null}
    </span>
  );
}
