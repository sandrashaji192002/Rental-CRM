import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useBase } from '../layouts';
import { DataList, FormModal, PageHeader } from '../ui';
import { phoneError } from '../validators';

export const customerFields = [
  { name: 'name', label: 'Full name', required: true },
  { name: 'phone', label: 'Phone', required: true, validate: phoneError, inputMode: 'tel', maxLength: 16, placeholder: '10-digit mobile number' },
  { name: 'email', label: 'Email', type: 'email', validate: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? '' : 'Enter a valid email address') },
  { name: 'idProofType', label: 'ID proof', type: 'select', options: ['Aadhaar', 'PAN', 'Driving License', 'Passport'].map((x) => ({ value: x, label: x })) },
  { name: 'idProofNumber', label: 'ID number' },
  { name: 'address', label: 'Address', type: 'textarea' },
];

export default function Customers() {
  const base = useBase();
  const nav = useNavigate();
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(false);

  const load = useCallback(async () => setRows((await api.get('/customers', { params: { q } })).data), [q]);
  useEffect(() => { load(); }, [load]);

  const save = async (v) => { await api.post('/customers', v); setModal(false); load(); };

  const columns = [
    { label: 'Name', render: (r) => <b>{r.name}</b> },
    { label: 'Phone', key: 'phone' },
    { label: 'Email', render: (r) => r.email || '-' },
    { label: 'ID', render: (r) => (r.idProofType ? `${r.idProofType} ${r.idProofNumber || ''}` : '-') },
  ];

  return (
    <>
      <PageHeader title="Customers">
        <input className="search" placeholder="Name or phone…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn primary" onClick={() => setModal(true)}>+ Customer</button>
      </PageHeader>
      <DataList rows={rows} columns={columns} onRowClick={(r) => nav(`${base}/customers/${r.id}`)} />
      {modal && <FormModal title="New customer" fields={customerFields} onSave={save} onClose={() => setModal(false)} />}
    </>
  );
}
