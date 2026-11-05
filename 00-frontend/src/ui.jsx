import { useState } from 'react';
import { errMsg } from './api';

export const money = n => '₹' + Number(n || 0).toLocaleString('en-IN');
export const fmtD = d =>
  d
    ? new Date(d).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '-';
export const fmtDT = d =>
  d
    ? new Date(d).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '-';
export const toLocalInput = d => {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 16);
};

export function PageHeader({ title, children }) {
  return (
    <div className="page-head">
      <h2>{title}</h2>
      <div className="actions">{children}</div>
    </div>
  );
}

export function Modal({ title, onClose, children, wide }) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div
        className={'modal' + (wide ? ' wide' : '')}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="btn ghost" onClick={onClose}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function FormModal({ title, fields, initial = {}, onSave, onClose }) {
  const [v, setV] = useState(initial);
  const [errs, setErrs] = useState({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const check = (f, val, all = v) => {
    if (f.required && !String(val ?? '').trim())
      return `${f.label} is required`;
    return f.validate && String(val ?? '').trim() !== ''
      ? f.validate(val, all) || ''
      : '';
  };
  const set = (f, val) => {
    setV(s => ({ ...s, [f.name]: val }));
    if (errs[f.name]) setErrs(s => ({ ...s, [f.name]: check(f, val) }));
  };

  const submit = async e => {
    e.preventDefault();
    const next = {};
    fields.forEach(f => {
      const m = check(f, v[f.name]);
      if (m) next[f.name] = m;
    });
    setErrs(next);
    setErr('');
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await onSave(v);
    } catch (ex) {
      setErr(errMsg(ex));
    }
    setBusy(false);
  };

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} className="form" noValidate>
        {fields.map(f => (
          <label key={f.name}>
            <span>
              {f.label}
              {f.required && ' *'}
            </span>
            {f.type === 'select' ? (
              <select
                className={errs[f.name] ? 'invalid' : ''}
                value={v[f.name] ?? ''}
                onChange={e => set(f, e.target.value)}
              >
                <option value="">Select…</option>
                {f.options.map(o => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : f.type === 'textarea' ? (
              <textarea
                rows={3}
                value={v[f.name] ?? ''}
                onChange={e => set(f, e.target.value)}
              />
            ) : (
              <input
                type={f.type || 'text'}
                className={errs[f.name] ? 'invalid' : ''}
                step={f.type === 'number' ? '0.01' : undefined}
                min={f.type === 'number' ? 0 : undefined}
                placeholder={f.placeholder}
                inputMode={f.inputMode}
                maxLength={f.maxLength}
                value={v[f.name] ?? ''}
                onChange={e => set(f, e.target.value)}
                onBlur={() =>
                  setErrs(s => ({ ...s, [f.name]: check(f, v[f.name]) }))
                }
              />
            )}
            {errs[f.name] && (
              <small className="field-error">{errs[f.name]}</small>
            )}
          </label>
        ))}
        {err && <div className="error">{err}</div>}
        <button className="btn primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      </form>
    </Modal>
  );
}

export function DataList({
  rows,
  columns,
  onRowClick,
  empty = 'Nothing here yet',
}) {
  if (!rows.length) return <div className="empty">{empty}</div>;
  const [first, ...rest] = columns;
  return (
    <>
      <table className="tbl">
        <thead>
          <tr>
            {columns.map(c => (
              <th key={c.label}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr
              key={r.id}
              onClick={() => onRowClick?.(r)}
              className={onRowClick ? 'click' : ''}
            >
              {columns.map(c => (
                <td key={c.label}>{c.render ? c.render(r) : r[c.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="cards">
        {rows.map(r => (
          <div
            key={r.id}
            className={'card' + (onRowClick ? ' click' : '')}
            onClick={() => onRowClick?.(r)}
          >
            <div className="card-title">
              {first.render ? first.render(r) : r[first.key]}
            </div>
            {rest.map(c => (
              <div key={c.label} className="card-row">
                <span>{c.label}</span>
                <b>{c.render ? c.render(r) : r[c.key]}</b>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

export const Badge = ({ children, tone = 'gray' }) => (
  <span className={`badge ${tone}`}>{children}</span>
);
export const statusTone = {
  available: 'green',
  rented: 'blue',
  maintenance: 'amber',
  retired: 'gray',
  good: 'green',
  fair: 'amber',
  damaged: 'red',
  reserved: 'amber',
  dispatched: 'blue',
  returned: 'amber',
  closed: 'green',
  cancelled: 'gray',
  overdue: 'red',
  open: 'red',
  in_progress: 'amber',
  done: 'green',
};

export const rentalStatus = r => (r.overdue ? 'overdue' : r.status);
