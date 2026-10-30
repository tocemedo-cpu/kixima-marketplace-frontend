import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('data-tema');
  document.body.style.overflow = '';
  try { localStorage.clear(); } catch { /* sem armazenamento */ }
});

// jsdom não implementa estas APIs; os componentes não dependem delas para a lógica testada.
if (!window.matchMedia) {
  window.matchMedia = (query) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent() { return false; } });
}
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || function scrollIntoView() {};
