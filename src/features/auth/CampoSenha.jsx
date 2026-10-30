import { forwardRef, useState } from 'react';
import { Input } from '../../ui';

/** Campo de senha com "Mostrar/Ocultar". Recebe do <Field> o id e os aria-*, por isso fica ligado ao rótulo. */
const CampoSenha = forwardRef(function CampoSenha({ autoComplete = 'current-password', ...props }, ref) {
  const [ver, setVer] = useState(false);
  return (
    <span className="kx-senha">
      <Input ref={ref} {...props} type={ver ? 'text' : 'password'} autoComplete={autoComplete} />
      <button type="button" className="kx-senha__ver" onClick={() => setVer((v) => !v)} aria-pressed={ver} aria-label={ver ? 'Ocultar senha' : 'Mostrar senha'}>
        {ver ? 'Ocultar' : 'Mostrar'}
      </button>
    </span>
  );
});

export default CampoSenha;
