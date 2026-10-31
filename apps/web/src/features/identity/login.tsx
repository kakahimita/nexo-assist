'use client';
import { UserViewSchema, type UserView } from '@nexo/contracts';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { History } from '../history/history';

export function Login(): React.JSX.Element {
  const [user, setUser] = useState<UserView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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
  return <div className="login-layout"><section className="intro"><strong>Nexo Assist</strong><div><p>Service desk de TI da Nexo</p><h1>Seu problema de TI, resolvido em uma conversa.</h1><p>Descreva o que está acontecendo e acompanhe seu histórico.</p></div></section><main className="login-main"><form onSubmit={login}><h2>Entrar</h2><p>Acesso de demonstração: use uma identidade fictícia e qualquer senha não vazia.</p><label htmlFor="email">E-mail corporativo</label><input id="email" name="email" type="email" required /><label htmlFor="password">Senha</label><input id="password" name="password" type="password" required />{error && <p role="alert">{error}</p>}<button type="submit">Entrar</button></form></main></div>;
}
