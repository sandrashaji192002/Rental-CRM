import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { useBase } from '../layouts';
import { Badge, DataList, FormModal, PageHeader, money, fmtD, statusTone } from '../ui';
import { customerFields } from './Customers';

export default function CustomerDetail() {
  const { id } = useParams();
  const base = useBase();
  const nav = useNavigate();
  const [c, setC] = useState(null);
  const [edit, setEdit] = useState(false);

  const load = useCallback(async () => setC((await api.get(`/customers/${id}`)).data), [id]);
  useEffect(() => { load(); }, [load]);

  if (!c) return <div className="empty">Loading…</div>;

  const columns = [
    { label: 'Rental', render: (r) => <b>{r.code || `#${r.id}`}</b> },
    { label: 'Items', render: (r) => r.RentalItems.map((i) => i.Asset?.Product?.name).join(', ') },
    { label: 'Period', render: (r) => `${fmtD(r.startDate)} → ${fmtD(r.dueDate)}` },
    { label: 'Status', render: (r) => <Badge tone={statusTone[r.status]}>{r.status}</Badge> },
    { label: 'Due', render: (r) => (r.due > 0 ? <span className="red">{money(r.due)}</span> : money(0)) },
  ];

  return (
    <>
      <Link to={`${base}/customers`} className="back">← Customers</Link>
      <PageHeader title={c.name}>
        <button className="btn" onClick={() => setEdit(true)}>Edit</button>
        <button className="btn primary" onClick={() => nav(`${base}/rentals/new`, { state: { customer: c } })}>+ New rental</button>
      </PageHeader>
      <div className="stats">
        <div className="stat"><span>Phone</span><b>{c.phone}</b></div>
        <div className="stat"><span>Rentals</span><b>{c.rentals.length}</b></div>
        <div className="stat"><span>Pending dues</span><b className={c.pendingDues > 0 ? 'red' : ''}>{money(c.pendingDues)}</b></div>
      </div>
      <p className="muted">{[c.email, c.idProofType && `${c.idProofType} ${c.idProofNumber || ''}`, c.address].filter(Boolean).join(' · ')}</p>
      <h3>Rental history</h3>
      <DataList rows={c.rentals} columns={columns} empty="No rentals yet" onRowClick={(r) => nav(`${base}/rentals/${r.id}`)} />
      {edit && <FormModal title="Edit customer" fields={customerFields} initial={c}
        onSave={async (v) => { await api.put(`/customers/${id}`, v); setEdit(false); load(); }} onClose={() => setEdit(false)} />}
    </>
  );
}
