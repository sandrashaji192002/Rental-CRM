import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { errMsg } from '../api';

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');

  const submit = async e => {
    e.preventDefault();
    setErr('');
    try {
      const u = await login(email, password);
      nav(u.role === 'admin' ? '/admin' : '/ops');
    } catch (ex) {
      setErr(errMsg(ex));
    }
  };

  return (
    <div className="login-wrap">
      <form className="login form" onSubmit={submit}>
        <h2>🛠️ Rental CRM</h2>
        <label>
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
        </label>
        {err && <div className="error">{err}</div>}
        <button className="btn primary">Sign in</button>
      </form>
    </div>
  );
}
