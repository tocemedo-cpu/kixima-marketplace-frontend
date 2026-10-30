// Formatação para o público angolano (pt-AO). Nunca inventa valores: sem dado devolve null/"—".

const FORMATOS = new Map();
function formatador(moeda) {
  if (!FORMATOS.has(moeda)) {
    try {
      FORMATOS.set(moeda, new Intl.NumberFormat('pt-AO', { style: 'currency', currency: moeda, maximumFractionDigits: 2 }));
    } catch {
      FORMATOS.set(moeda, null); // código de moeda desconhecido
    }
  }
  return FORMATOS.get(moeda);
}

/** "950000" + "AOA" → "950 000,00 Kz". Sem valor devolve null (quem chama mostra "Pedir cotação"). */
export function formatarPreco(valor, moeda = 'AOA') {
  if (valor === null || valor === undefined || valor === '') return null;
  const n = Number(valor);
  if (!Number.isFinite(n)) return null;
  const f = formatador(moeda || 'AOA');
  return f ? f.format(n) : `${n.toLocaleString('pt-AO')} ${moeda}`;
}

export function formatarNumero(n) {
  return Number.isFinite(Number(n)) ? Number(n).toLocaleString('pt-AO') : '—';
}

export function formatarData(iso, opcoes = { day: '2-digit', month: 'short', year: 'numeric' }) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-AO', opcoes);
}

/** 4.5 → "4,5". */
export function formatarNota(n) {
  return Number.isFinite(Number(n)) ? Number(n).toLocaleString('pt-AO', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—';
}

/** Primeiras letras de um nome (para avatares/logótipos em falta). */
export function iniciais(nome = '') {
  return nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?';
}

/** Só aceita destinos internos (começam por "/" e não por "//"): evita redirecionamentos abertos via ?next=. */
export function destinoSeguro(next, omissao = '/') {
  if (typeof next !== 'string' || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return omissao;
  return next;
}
