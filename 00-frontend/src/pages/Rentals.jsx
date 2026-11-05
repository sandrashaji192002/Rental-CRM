import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useBase } from '../layouts';
import { Badge, DataList, PageHeader, money, fmtD, rentalStatus, statusTone } from '../ui';

const TABS = [['', 'All'], ['reserved', 'Reserved'], ['dispatched', 'Out'], ['overdue', 'Overdue'], ['returned', 'Balance due'], ['closed', 'Closed']];

export default function Rentals() {
  const base = useBase();
  const nav = useNavigate();
  const [rows, setRows] = useState([]);
  const [tab, setTab] = useState('');
  const [q, setQ] = useState('');

  const load = useCallback(async () => setRows((await api.get('/rentals', { params: { status: tab || undefined, q: q || undefined } })).data), [tab, q]);
  useEffect(() => { load(); }, [load]);

  const columns = [
    { label: 'Rental', render: (r) => <b>{r.code}</b> },
    { label: 'Customer', render: (r) => r.Customer?.name },
    { label: 'Items', render: (r) => r.RentalItems.map((i) => i.Asset?.serialNo).join(', ') },
    { label: 'Period', render: (r) => `${fmtD(r.startDate)} → ${fmtD(r.dueDate)}` },
    { label: 'Status', render: (r) => <Badge tone={statusTone[rentalStatus(r)]}>{rentalStatus(r)}</Badge> },
    { label: 'Balance', render: (r) => (r.due > 0 ? <span className="red">{money(r.due)}</span> : '-') },
  ];

  return (
    <>
      <PageHeader title="Rentals">
        <input className="search" placeholder="Code, name, phone…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn primary" onClick={() => nav(`${base}/rentals/new`)}>+ New rental</button>
      </PageHeader>
      <div className="tabs">
        {TABS.map(([v, l]) => <button key={l} className={'tab-btn' + (tab === v ? ' on' : '')} onClick={() => setTab(v)}>{l}</button>)}
      </div>
      <DataList rows={rows} columns={columns} empty="No rentals found" onRowClick={(r) => nav(`${base}/rentals/${r.id}`)} />
    </>
  );
}
