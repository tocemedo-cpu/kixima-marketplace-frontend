// Aplica o tema escolhido (claro | escuro-1 | escuro-2) antes do primeiro paint.
// Sem escolha guardada não faz nada: o CSS segue o prefers-color-scheme do sistema.
try {
  var t = localStorage.getItem('kixima.tema');
  if (t === 'claro' || t === 'escuro-1' || t === 'escuro-2') document.documentElement.setAttribute('data-tema', t);
} catch (e) { /* armazenamento indisponível (janela privada): fica o tema do sistema */ }
