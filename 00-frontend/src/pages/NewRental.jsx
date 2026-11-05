import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api, { errMsg } from '../api';
import { useBase } from '../layouts';
import { FormModal, PageHeader, money, toLocalInput } from '../ui';
import { customerFields } from './Customers';

export default function NewRental() {
  const base = useBase();
  const nav = useNavigate();
  const { state } = useLocation();

  const [customer, setCustomer] = useState(state?.customer || null);
  const [cq, setCq] = useState('');
  const [found, setFound] = useState([]);
  const [newCust, setNewCust] = useState(false);

  const [start, setStart] = useState(toLocalInput(new Date()));
  const [due, setDue] = useState(toLocalInput(new Date(Date.now() + 86400000)));
  const [avail, setAvail] = useState(null);
  const [sel, setSel] = useState({});
  const [notes, setNotes] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (customer) return;
    const t = setTimeout(
      async () =>
        setFound(
          (await api.get('/customers', { params: { q: cq } })).data.slice(0, 6)
        ),
      250
    );
    return () => clearTimeout(t);
  }, [cq, customer]);

  const validDates = start && due && new Date(due) > new Date(start);
  useEffect(() => {
    if (!validDates) {
      setAvail(null);
      return;
    }
    let live = true;
    (async () => {
      try {
        const { data } = await api.get('/availability', {
          params: {
            start: new Date(start).toISOString(),
            end: new Date(due).toISOString(),
          },
        });
        if (!live) return;
        setAvail(data);
        const ids = new Set(
          data.products.flatMap(p => p.assets.map(a => a.id))
        );
        setSel(s =>
          Object.fromEntries(
            Object.entries(s).filter(([id]) => ids.has(Number(id)))
          )
        );
      } catch (e) {
        if (live) setErr(errMsg(e));
      }
    })();
    return () => {
      live = false;
    };
  }, [start, due, validDates]);

  const toggle = (p, a) =>
    setSel(s => {
      const n = { ...s };
      if (n[a.id]) delete n[a.id];
      else n[a.id] = { serialNo: a.serialNo, product: p };
      return n;
    });

  const picks = Object.entries(sel);
  const rent = picks.reduce((s, [, v]) => s + Number(v.product.estRent), 0);
  const deposit = picks.reduce(
    (s, [, v]) => s + Number(v.product.securityDeposit),
    0
  );

  const create = async () => {
    setErr('');
    setBusy(true);
    try {
      const { data } = await api.post('/rentals', {
        customerId: customer.id,
        assetIds: picks.map(([id]) => Number(id)),
        notes,
        startDate: new Date(start).toISOString(),
        dueDate: new Date(due).toISOString(),
      });
      nav(`${base}/rentals/${data.id}`);
    } catch (e) {
      setErr(errMsg(e));
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="New rental" />

      <section className="panel">
        <h3>1. Customer</h3>
        {customer ? (
          <div className="picked">
            <div>
              <b>{customer.name}</b>
              <div className="muted">
                {customer.phone}
                {customer.email ? ` · ${customer.email}` : ''}
              </div>
            </div>
            <button className="btn small" onClick={() => setCustomer(null)}>
              Change
            </button>
          </div>
        ) : (
          <>
            <div className="filters">
              <input
                className="search wide"
                placeholder="Search by name or phone…"
                value={cq}
                onChange={e => setCq(e.target.value)}
                autoFocus
              />
              <button className="btn" onClick={() => setNewCust(true)}>
                + Register new
              </button>
            </div>
            <div className="results">
              {found.map(c => (
                <button
                  key={c.id}
                  className="result"
                  onClick={() => setCustomer(c)}
                >
                  <b>{c.name}</b>
                  <span>{c.phone}</span>
                </button>
              ))}
              {!found.length && (
                <div className="muted">
                  No customers match. Register a new one.
                </div>
              )}
            </div>
          </>
        )}
      </section>

      <section className="panel">
        <h3>2. Rental period</h3>
        <div className="grid2">
          <label>
            <span className="lbl">Start</span>
            <input
              type="datetime-local"
              value={start}
              onChange={e => setStart(e.target.value)}
            />
          </label>
          <label>
            <span className="lbl">Due back</span>
            <input
              type="datetime-local"
              value={due}
              onChange={e => setDue(e.target.value)}
            />
          </label>
        </div>
        {!validDates && (
          <div className="error">Due date must be after the start.</div>
        )}
        {avail && (
          <p className="muted">
            {avail.days} day(s) · availability shown for this exact period
          </p>
        )}
      </section>

      <section className="panel">
        <h3>3. Select equipment</h3>
        {!avail ? (
          <div className="muted">Pick valid dates to see what is free.</div>
        ) : !avail.products.length ? (
          <div className="empty">Nothing is available for these dates.</div>
        ) : (
          avail.products.map(p => (
            <div key={p.productId} className="prod">
              <div className="prod-head">
                <div>
                  <b>{p.name}</b> <span className="muted">· {p.category}</span>
                </div>
                <div className="muted">
                  {money(p.dailyRate)}/day · deposit {money(p.securityDeposit)}{' '}
                  · <b>{p.availableCount}</b> free
                </div>
              </div>
              <div className="chips">
                {p.assets.map(a => (
                  <button
                    key={a.id}
                    className={'chip' + (sel[a.id] ? ' sel' : '')}
                    onClick={() => toggle(p, a)}
                  >
                    {sel[a.id] ? '✓ ' : ''}
                    {a.serialNo}
                    {a.condition !== 'good' ? ` (${a.condition})` : ''}
                  </button>
                ))}
              </div>
              <div className="muted">
                Rent for this period: {money(p.estRent)} each
              </div>
            </div>
          ))
        )}
      </section>

      <section className="panel">
        <h3>4. Summary</h3>
        <div className="sum">
          <span>Items</span>
          <b>
            {picks.length ? picks.map(([, v]) => v.serialNo).join(', ') : '-'}
          </b>
        </div>
        <div className="sum">
          <span>Rent</span>
          <b>{money(rent)}</b>
        </div>
        <div className="sum">
          <span>Security deposit (refundable)</span>
          <b>{money(deposit)}</b>
        </div>
        <label>
          <span className="lbl">Notes</span>
          <textarea
            rows={2}
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </label>
        {err && <div className="error">{err}</div>}
        <button
          className="btn primary"
          disabled={!customer || !picks.length || !validDates || busy}
          onClick={create}
        >
          {busy ? 'Creating…' : 'Create rental'}
        </button>
        <p className="muted">
          Final amounts are calculated by the server. You will collect the
          deposit and dispatch on the next screen.
        </p>
      </section>

      {newCust && (
        <FormModal
          title="Register customer"
          fields={customerFields}
          onSave={async v => {
            const { data } = await api.post('/customers', v);
            setCustomer(data);
            setNewCust(false);
          }}
          onClose={() => setNewCust(false)}
        />
      )}
    </>
  );
}
