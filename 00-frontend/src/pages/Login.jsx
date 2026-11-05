import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { errMsg } from '../api';

export default function Login({ mobile = false }) {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');

  if (mobile && user?.role === 'admin') return <Navigate to="/m" replace />;

  const submit = async e => {
    e.preventDefault();
    setErr('');
    try {
      const u = await login(email, password);
      if (u.role !== 'admin') nav('/ops');
      else nav(mobile ? '/m' : '/admin');
    } catch (ex) {
      setErr(errMsg(ex));
    }
  };

  const form = (
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

  if (!mobile) return form;

  return (
    <div className="phone-wrap">
      <div className="phone mobile">
        <header className="topbar">
          <b>🛠️ Rental CRM</b>
        </header>
        {form}
      </div>
    </div>
  );
}
