'use client';
import { UserViewSchema, type UserView } from '@nexo/contracts';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { History } from '../history/history';

export function Login(): React.JSX.Element {
  const [user, setUser] = useState<UserView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [sessionError, setSessionError] = useState(false);
  const checkSession = useCallback(async () => { setLoading(true); setSessionError(false); try { const res = await fetch('/api/session'); if (res.status === 401) return; if (!res.ok) throw new Error(); setUser(UserViewSchema.parse(await res.json())); } catch { setSessionError(true); } finally { setLoading(false); } }, []);
  useEffect(() => { void Promise.resolve().then(checkSession); }, [checkSession]);
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: data.get('email'), password: data.get('password') }) });
      if (!response.ok) throw new Error();
      setUser(UserViewSchema.parse(await response.json()));
    } catch { setError('Não foi possível entrar. Confira os dados ou tente novamente.'); }
  }
  if (loading) return <main><p role="status">Carregando...</p></main>;
  if (sessionError) return <main><p role="alert">Não foi possível verificar sua sessão.</p><button onClick={() => void checkSession()}>Tentar novamente</button></main>;
  if (user) return <History user={user} onLogout={() => setUser(null)} />;
  return (
    <div className="login-layout">
      <section className="intro" aria-labelledby="login-headline">
        <div className="login-brand">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M21.763 2.245 18.389 3.932c-.623.308-.973.903-.973 1.631v6.293L6.223 2.427c-.623-.469-1.372-.553-2.03-.245L1.008 3.813C.357 4.135 0 4.737 0 5.486v15.218c0 1.477 1.526 2.289 2.716 1.785l3.073-1.617c.693-.322 1.057-.952 1.057-1.722v-7.7l11.732 10.591c.602.546 1.421.679 2.086.364l2.786-1.505c.602-.315.786-.931.786-1.68V3.932c0-1.463-1.505-2.275-2.625-1.687Z" /></svg>
          <span>Nexo Assist</span>
        </div>
        <div className="intro-story">
          <div className="intro-headline">
            <p className="intro-eyebrow">Service desk de TI da Nexo</p>
            <h1 id="login-headline">Seu problema de TI, resolvido em uma conversa.</h1>
            <p className="intro-description">Descreva o que está acontecendo e acompanhe seu histórico de atendimento em um só lugar.</p>
          </div>
          <div className="preview-wrap">
            <div className="conversation-preview" aria-label="Exemplo ilustrativo de conversa">
              <p className="preview-caption">Exemplo de conversa</p>
              <p className="preview-question">Meu notebook não conecta à VPN.</p>
              <p className="preview-author">Nexo Assist <span>· atendimento em um só lugar</span></p>
              <p className="preview-answer">Conte o que aconteceu para que possamos entender como ajudar.</p>
              <div className="preview-tag"><span aria-hidden="true" /> Suporte de TI <span>· conversa registrada</span></div>
            </div>
          </div>
        </div>
        <div className="intro-metrics" aria-label="Exemplo ilustrativo de indicadores">
          <p className="metrics-caption">Indicadores ilustrativos</p>
          <div className="intro-highlights">
            <div><strong>8 s</strong><span>primeira resposta, em média</span></div>
            <div><strong>72%</strong><span>resolvidos sem fila</span></div>
            <div><strong>6 <i aria-hidden="true" /></strong><span>analistas online agora</span></div>
          </div>
        </div>
      </section>
      <main className="login-main">
        <div className="login-topline">Problema para entrar? <span>Ramal 4000 (exemplo)</span></div>
        <div className="login-center">
          <form onSubmit={login} className="login-form">
            <div className="login-heading"><h2>Entrar</h2><p>Use seu e-mail para acessar o Nexo Assist.</p></div>
            <div className="login-fields">
              <div className="login-field"><label htmlFor="email">E-mail corporativo</label><div className="input-wrap"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg><input id="email" name="email" type="email" autoComplete="username" placeholder="voce@nexo.com.br" required /></div></div>
              <div className="login-field"><div className="password-heading"><label htmlFor="password">Senha</label><button className="recovery-link" type="button" disabled aria-describedby="unavailable-options">Esqueci minha senha</button></div><div className="input-wrap"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="4.5" y="10" width="15" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></svg><input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Digite sua senha" required /><button className="password-toggle" type="button" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/>{showPassword && <path d="M4 4 20 20"/>}</svg></button></div></div>
              <label className="remember-option"><input type="checkbox" disabled aria-describedby="unavailable-options" /><span>Manter conectado neste computador</span></label>
            </div>
            {error && <p className="login-error" role="alert">{error}</p>}
            <button className="login-submit" type="submit">Entrar <span aria-hidden="true">→</span></button>
            <div className="login-demo"><p>Acesso de demonstração: use uma identidade fictícia e qualquer senha não vazia.</p><p id="unavailable-options">Recuperação de senha e a opção de manter conectado ainda não estão disponíveis.</p></div>
          </form>
        </div>
        <div className="login-footer"><p>© 2026 Nexo <span>·</span> Service desk de TI</p><p>Projeto demonstrativo</p></div>
      </main>
    </div>
  );
}
