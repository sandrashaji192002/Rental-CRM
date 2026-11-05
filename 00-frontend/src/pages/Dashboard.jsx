import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useBase } from '../layouts';
import { Badge, DataList, PageHeader, money, fmtDT } from '../ui';

export default function Dashboard() {
  const base = useBase();
  const nav = useNavigate();
  const [s, setS] = useState(null);

  useEffect(() => {
    (async () => {
      const [a, c, rentals] = await Promise.all([api.get('/assets'), api.get('/customers'), api.get('/rentals')]);
      const by = (st) => a.data.filter((x) => x.status === st).length;
      setS({
        assets: a.data.length, available: by('available'), rented: by('rented'), maintenance: by('maintenance'),
        customers: c.data.length,
        reserved: rentals.data.filter((r) => r.status === 'reserved').length,
        out: rentals.data.filter((r) => r.status === 'dispatched').length,
        overdue: rentals.data.filter((r) => r.overdue),
        owed: rentals.data.reduce((sum, r) => sum + r.due, 0),
      });
    })();
  }, []);

  if (!s) return <div className="empty">Loading…</div>;
  const stats = [
    ['Available assets', `${s.available} / ${s.assets}`], ['Out on rent', s.out], ['Reserved', s.reserved],
    ['Overdue', s.overdue.length], ['In maintenance', s.maintenance], ['Customers', s.customers],
  ];
  const columns = [
    { label: 'Rental', render: (r) => <b>{r.code}</b> },
    { label: 'Customer', render: (r) => r.Customer?.name },
    { label: 'Was due', render: (r) => fmtDT(r.dueDate) },
    { label: 'Late', render: (r) => <Badge tone="red">{r.liveLateDays} day(s)</Badge> },
    { label: 'Late fee so far', render: (r) => money(r.liveLateFee) },
  ];

  return (
    <>
      <PageHeader title="Dashboard" />
      <div className="stats">
        {stats.map(([l, v]) => <div key={l} className={'stat' + (l === 'Overdue' && v > 0 ? ' alert' : '')}><span>{l}</span><b>{v}</b></div>)}
      </div>
      <h3 className="section">Overdue alerts</h3>
      <DataList rows={s.overdue} columns={columns} empty="🎉 Nothing overdue" onRowClick={(r) => nav(`${base}/rentals/${r.id}`)} />
    </>
  );
}
