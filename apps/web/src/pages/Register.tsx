import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/useAuth';

export function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const err = await register(email, password, name);
    setBusy(false);
    if (err) setError(err);
    else nav('/app');
  }

  return (
    <div className="container" style={{ maxWidth: 420, paddingTop: 64 }}>
      <h1 style={{ textAlign: 'center' }}>Start your free trial</h1>
      <div className="card mt-4">
        {error && <div className="alert alert--error">{error}</div>}
        <form onSubmit={submit}>
          <div className="field">
            <label>Your name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label>Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label>Password</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={10} />
            <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>At least 10 characters.</p>
          </div>
          <button className="btn btn--primary btn--block" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
        </form>
      </div>
      <p className="center mt-4 muted">Already have an account? <Link to="/login">Log in</Link></p>
    </div>
  );
}
