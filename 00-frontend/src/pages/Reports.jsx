import { useEffect, useState, useCallback } from 'react';
import api, { errMsg } from '../api';
import { Badge, DataList, PageHeader, money, fmtDT } from '../ui';

const ymd = (d) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };
const daysAgo = (n) => ymd(new Date(Date.now() - n * 86400000));
const monthStart = () => { const d = new Date(); return ymd(new Date(d.getFullYear(), d.getMonth(), 1)); };

export default function Reports() {
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(ymd(new Date()));
  const [type, setType] = useState('');
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setErr('');
    try {
      const params = { from, to };
      const [s, t, u, l] = await Promise.all([
        api.get('/reports/summary', { params }), api.get('/reports/revenue-trend', { params }),
        api.get('/reports/utilization', { params }), api.get('/reports/ledger', { params: { ...params, type: type || undefined } }),
      ]);
      setData({ s: s.data, trend: t.data, util: u.data, ledger: l.data });
    } catch (e) { setErr(errMsg(e)); }
  }, [from, to, type]);
  useEffect(() => { load(); }, [load]);

  const exportCsv = () => {
    const head = ['Date', 'Rental', 'Customer', 'Type', 'Method', 'Direction', 'Amount', 'Note'];
    const lines = data.ledger.rows.map((r) => [new Date(r.date).toISOString(), r.rentalCode, r.customer, r.type, r.method, r.direction, r.amount, r.note || '']
      .map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','));
    const url = URL.createObjectURL(new Blob([[head.join(','), ...lines].join('\n')], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = `ledger_${from}_${to}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const preset = (f) => { setFrom(f); setTo(ymd(new Date())); };

  if (!data) return <>{err ? <div className="error">{err}</div> : <div className="empty">Loading…</div>}</>;
  const { s, trend, util, ledger } = data;
  const max = Math.max(1, ...trend.map((d) => d.revenue));

  const stats = [
    ['Revenue', money(s.revenue), 'Rent + late fees + damage'],
    ['Cash received', money(s.cashIn), 'Excludes deposit adjustments'],
    ['Refunds', money(s.refunds), ''],
    ['Net cash', money(s.netCash), 'Received − refunds'],
    ['Deposits held', money(s.depositsHeld), 'Refundable, not income'],
    ['Maintenance cost', money(s.maintenanceCost), `Net after maintenance ${money(s.netAfterMaintenance)}`],
    ['Rentals created', s.rentalsCreated, ''],
    ['Overdue now', s.overdueNow, ''],
  ];

  const utilCols = [
    { label: 'Product', render: (r) => <b>{r.name}</b> },
    { label: 'Assets', key: 'assets' },
    { label: 'Rented days', key: 'rentedDays' },
    { label: 'Utilization', render: (r) => (
      <div className="prog"><div className="prog-bar" style={{ width: `${r.utilization}%` }} /><span>{r.utilization}%</span></div>) },
    { label: 'Billed rent', render: (r) => money(r.billedRent) },
  ];
  const ledgerCols = [
    { label: 'Date', render: (r) => fmtDT(r.date) },
    { label: 'Rental', render: (r) => <b>{r.rentalCode}</b> },
    { label: 'Customer', render: (r) => r.customer },
    { label: 'Type', render: (r) => <Badge tone={r.direction === 'debit' ? 'red' : 'green'}>{r.type.replace('_', ' ')}</Badge> },
    { label: 'Method', render: (r) => (r.movesCash ? r.method : 'from deposit') },
    { label: 'Amount', render: (r) => <span className={r.direction === 'debit' ? 'red' : ''}>{r.direction === 'debit' ? '−' : ''}{money(r.amount)}</span> },
  ];

  return (
    <>
      <PageHeader title="Reports">
        <button className="btn small" onClick={() => preset(daysAgo(6))}>7 days</button>
        <button className="btn small" onClick={() => preset(daysAgo(29))}>30 days</button>
        <button className="btn small" onClick={() => preset(monthStart())}>This month</button>
      </PageHeader>
      <div className="filters">
        <label className="inline"><span className="lbl">From</span><input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="inline"><span className="lbl">To</span><input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label>
      </div>
      {err && <div className="error">{err}</div>}

      <div className="stats">
        {stats.map(([l, v, hint]) => <div key={l} className={'stat' + (l === 'Overdue now' && v > 0 ? ' alert' : '')}><span>{l}</span><b>{v}</b>{hint && <small>{hint}</small>}</div>)}
      </div>

      <section className="panel">
        <h3>Daily revenue</h3>
        <div className="legend"><i className="k rent" />Rent <i className="k late" />Late fees <i className="k dmg" />Damage</div>
        <div className="bars">
          {trend.map((d) => (
            <div key={d.date} className="bar-col" title={`${d.date}: ${money(d.revenue)}`}>
              <div className="bar" style={{ height: `${(d.revenue / max) * 100}%` }}>
                <div className="seg dmg" style={{ flex: d.damage }} /><div className="seg late" style={{ flex: d.late_fee }} /><div className="seg rent" style={{ flex: d.rent }} />
              </div>
            </div>
          ))}
        </div>
        <div className="axis"><span>{trend[0].date}</span><span>peak {money(max === 1 ? 0 : max)}</span><span>{trend[trend.length - 1].date}</span></div>
      </section>

      <h3 className="section">Product utilization <span className="muted">({util.rangeDays} day period)</span></h3>
      <DataList rows={util.products.map((p) => ({ ...p, id: p.productId }))} columns={utilCols} empty="No products" />

      <div className="page-head section">
        <h3>Ledger</h3>
        <div className="actions">
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All types</option>
            {['rent', 'deposit', 'late_fee', 'damage', 'refund'].map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
          </select>
          <button className="btn" disabled={!ledger.rows.length} onClick={exportCsv}>⬇ Export CSV</button>
        </div>
      </div>
      <div className="sum-row">
        <span>Credits (cash in) <b>{money(ledger.totals.credits)}</b></span>
        <span>Debits (refunds) <b className="red">{money(ledger.totals.debits)}</b></span>
        <span>Net <b>{money(ledger.totals.net)}</b></span>
      </div>
      <DataList rows={ledger.rows} columns={ledgerCols} empty="No transactions in this period" />
    </>
  );
}
