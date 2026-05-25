import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/useAuth';

export function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const err = await login(email, password);
    setBusy(false);
    if (err) setError(err);
    else nav('/app');
  }

  return (
    <div className="container" style={{ maxWidth: 420, paddingTop: 64 }}>
      <h1 style={{ textAlign: 'center' }}>Welcome back</h1>
      <div className="card mt-4">
        {error && <div className="alert alert--error">{error}</div>}
        <form onSubmit={submit}>
          <div className="field">
            <label>Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label>Password</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button className="btn btn--primary btn--block" disabled={busy}>{busy ? 'Signing in…' : 'Log in'}</button>
        </form>
      </div>
      <p className="center mt-4 muted">No account? <Link to="/register">Create one</Link></p>
    </div>
  );
}
