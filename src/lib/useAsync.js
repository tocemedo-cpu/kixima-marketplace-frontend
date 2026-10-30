import { useCallback, useEffect, useRef, useState } from 'react';
import { eCancelamento } from '../api/client';

/**
 * Carrega dados assíncronos com os quatro estados de uma vista: 'carregando' | 'ok' | 'erro'.
 * `carregar(signal)` recebe um AbortSignal; quando as dependências mudam (ou o componente desaparece) o pedido
 * anterior é cancelado e a sua resposta, se ainda chegar, é ignorada (sem corridas entre pesquisas).
 * `recarregar()` repete (botão "Tentar de novo"). `data` mantém o último resultado bom enquanto recarrega
 * (`aAtualizar`), para a lista não piscar a cada filtro.
 */
export function useAsync(carregar, deps) {
  const [estado, setEstado] = useState({ status: 'carregando', data: null, error: null, aAtualizar: false });
  const [tick, setTick] = useState(0);
  const fn = useRef(carregar);
  fn.current = carregar;

  useEffect(() => {
    const ctl = new AbortController();
    setEstado((e) => ({ ...e, status: e.data ? 'ok' : 'carregando', aAtualizar: Boolean(e.data), error: null }));
    Promise.resolve()
      .then(() => fn.current(ctl.signal))
      .then((data) => { if (!ctl.signal.aborted) setEstado({ status: 'ok', data, error: null, aAtualizar: false }); })
      .catch((error) => {
        if (ctl.signal.aborted || eCancelamento(error)) return;
        setEstado((e) => ({ status: 'erro', data: e.data, error, aAtualizar: false }));
      });
    return () => ctl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const recarregar = useCallback(() => setTick((t) => t + 1), []);
  return { ...estado, recarregar };
}
