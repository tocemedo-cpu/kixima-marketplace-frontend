// Contraste WCAG AA dos três fundos, lido DIRECTAMENTE de temas.css e tokens.css.
// Se alguém alterar uma cor e um par de texto deixar de cumprir 4,5:1 (3:1 para anéis e ícones), isto falha.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ler = (f) => readFileSync(new URL(f, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

function blocos(css) {
  const r = {};
  for (const m of css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
    const seletor = m[1].trim();
    const vars = Object.fromEntries([...m[2].matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)].map((x) => [x[1], x[2].trim()]));
    let tema = null;
    if (seletor.includes('data-tema="escuro-1"')) tema = 'escuro-1';
    else if (seletor.includes('data-tema="escuro-2"')) tema = 'escuro-2';
    else if (seletor.includes('data-tema="claro"')) tema = 'claro';
    else if (seletor.includes(':not([data-tema])')) tema = 'sistema-escuro';
    if (tema) r[tema] = vars;
  }
  return r;
}

const TEMAS = blocos(ler('./temas.css'));
const SEMANTICOS = Object.fromEntries([...ler('./tokens.css').matchAll(/(--kx-[a-z0-9-]+)\s*:\s*var\((--[a-z0-9-]+)\)/g)].map((m) => [m[1], m[2]]));

const lum = (hex) => {
  const h = hex.replace('#', '');
  const c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const razao = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
// Devolve #RRGGBB; um rgba(...) é composto sobre --kx-surface (onde os selos e cartões realmente assentam).
const cor = (tema, token) => {
  const v = TEMAS[tema][SEMANTICOS[token]];
  const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/.exec(v);
  if (!m) return v;
  const base = TEMAS[tema][SEMANTICOS['--kx-surface']].replace('#', '');
  const a = m[4] === undefined ? 1 : parseFloat(m[4]);
  const canais = [m[1], m[2], m[3]].map((c, i) => Math.round(a * Number(c) + (1 - a) * parseInt(base.slice(i * 2, i * 2 + 2), 16)));
  return '#' + canais.map((c) => c.toString(16).padStart(2, '0')).join('');
};

// [texto, fundo, mínimo]
const PARES = [
  ['--kx-text', '--kx-bg', 4.5], ['--kx-text', '--kx-surface', 4.5], ['--kx-text', '--kx-bg-2', 4.5], ['--kx-text', '--kx-surface-2', 4.5],
  ['--kx-ink', '--kx-surface', 4.5], ['--kx-ink', '--kx-bg', 4.5],
  ['--kx-text-muted', '--kx-surface', 4.5], ['--kx-text-muted', '--kx-bg', 4.5], ['--kx-text-muted', '--kx-surface-2', 4.5],
  ['--kx-text-faint', '--kx-surface', 4.5], ['--kx-text-faint', '--kx-bg', 4.5], ['--kx-text-faint', '--kx-bg-2', 4.5],
  ['--kx-brand', '--kx-surface', 4.5], ['--kx-brand', '--kx-bg', 4.5], ['--kx-brand', '--kx-surface-2', 4.5], ['--kx-brand', '--kx-hover', 4.5],
  ['--kx-on-primary', '--kx-primary', 4.5],
  ['--kx-ink', '--kx-halo', 4.5], // selo de marca
  ['--kx-success', '--kx-success-bg', 4.5], ['--kx-warning', '--kx-warning-bg', 4.5], ['--kx-danger', '--kx-danger-bg', 4.5],
  ['--kx-success', '--kx-surface', 4.5], ['--kx-warning', '--kx-surface', 4.5], ['--kx-danger', '--kx-surface', 4.5],
  ['--kx-shell-text', '--kx-shell', 4.5], ['--kx-shell-muted', '--kx-shell', 4.5], ['--kx-search-text', '--kx-search-bg', 4.5], ['--kx-shell-text', '--kx-search-bg', 4.5],
  // Não-texto (anel de foco, bordas de controlos): 3:1
  ['--kx-focus', '--kx-surface', 3], ['--kx-focus', '--kx-bg', 3], ['--kx-line-strong', '--kx-surface', 1.3],
];

describe('contraste WCAG AA nos três fundos', () => {
  for (const tema of ['claro', 'escuro-1', 'escuro-2']) {
    describe(tema, () => {
      it.each(PARES)('%s sobre %s >= %s:1', (fg, bg, minimo) => {
        const a = cor(tema, fg);
        const b = cor(tema, bg);
        expect(a, `${fg} em ${tema}`).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(b, `${bg} em ${tema}`).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(razao(a, b)).toBeGreaterThanOrEqual(minimo);
      });
    });
  }

  it('o fundo escuro do sistema (sem escolha guardada) é exactamente o Escuro 1', () => {
    expect(TEMAS['sistema-escuro']).toEqual(TEMAS['escuro-1']);
  });

  it('os três fundos definem as mesmas variáveis (só mudam os valores)', () => {
    const chaves = (t) => Object.keys(TEMAS[t]).sort();
    expect(chaves('escuro-1')).toEqual(chaves('claro'));
    expect(chaves('escuro-2')).toEqual(chaves('claro'));
  });

  it('o ocre nunca é usado como cor de texto nos estilos', () => {
    const css = ['../ui/ui.css', '../layout/layout.css', '../pages/catalogo.css', './base.css'].map(ler).join('\n');
    expect(css).not.toMatch(/[^-]color:\s*var\(--kx-accent\)/);
  });
});
