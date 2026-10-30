// Ícones de traço (24x24, currentColor). Decorativos por omissão (aria-hidden); passe `label` para um
// ícone que, sozinho, comunica algo.
const CAMINHOS = {
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm9 16-4.2-4.2',
  menu: 'M4 7h16M4 12h16M4 17h16',
  close: 'M6 6l12 12M18 6 6 18',
  'chevron-down': 'm6 9 6 6 6-6',
  'chevron-up': 'm6 15 6-6 6 6',
  'chevron-left': 'm15 6-6 6 6 6',
  'chevron-right': 'm9 6 6 6-6 6',
  'arrow-right': 'M5 12h14m-6-6 6 6-6 6',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  alert: 'M12 4 3 20h18L12 4zm0 6v5m0 3v.01',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 8v6m0-9v.01',
  user: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm-7 16a7 7 0 0 1 14 0',
  building: 'M5 21V4h9v17M14 9h5v12M8 8h3M8 12h3M8 16h3M3 21h18',
  box: 'm12 3 8 4.5v9L12 21l-8-4.5v-9L12 3zm0 9 8-4.5M12 12 4 7.5M12 12v9',
  file: 'M7 3h7l5 5v13H7V3zm7 0v5h5M10 13h6M10 17h6',
  shield: 'M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3zm-3 9 2.2 2.2L15 10',
  filter: 'M4 5h16l-6 8v6l-4-2v-4L4 5z',
  grid: 'M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z',
  list: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
  plus: 'M12 5v14M5 12h14',
  trash: 'M5 7h14M10 7V4h4v3m-7 0 1 13h8l1-13M10 11v6m4-6v6',
  bell: 'M6 16V11a6 6 0 1 1 12 0v5l2 2H4l2-2zm4 4h4',
  palette: 'M12 3a9 9 0 1 0 0 18c1.2 0 2-.8 2-1.8 0-1.2-1-1.4-1-2.5 0-1 .8-1.7 1.8-1.7H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3zM7.5 11h.01M10 7.5h.01M14.5 7.5h.01',
  star: 'm12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5z',
  external: 'M14 4h6v6m0-6-9 9M18 14v5H5V6h5',
};

export default function Icon({ name, size = 20, label, className = '', ...resto }) {
  const d = CAMINHOS[name];
  if (!d) return null;
  const acessivel = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': 'true', focusable: 'false' };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`kx-icon ${className}`.trim()}
      {...acessivel}
      {...resto}
    >
      <path d={d} />
    </svg>
  );
}

export const NOMES_DE_ICONES = Object.keys(CAMINHOS);
