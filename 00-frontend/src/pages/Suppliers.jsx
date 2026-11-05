import { useEffect, useState, useCallback } from 'react';
import api, { errMsg } from '../api';
import { DataList, FormModal, PageHeader, money } from '../ui';
import { phoneError } from '../validators';

const fields = [
  { name: 'name', label: 'Supplier name', required: true },
  { name: 'contactPerson', label: 'Contact person' },
  { name: 'phone', label: 'Phone', validate: phoneError, inputMode: 'tel', maxLength: 16, placeholder: '10-digit mobile number' },
  { name: 'email', label: 'Email', type: 'email', validate: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? '' : 'Enter a valid email address') },
];

export default function Suppliers() {
  const [rows, setRows] = useState([]);
  const [modal, setModal] = useState(null);

  const load = useCallback(async () => setRows((await api.get('/suppliers')).data), []);
  useEffect(() => { load(); }, [load]);

  const save = async (v) => {
    const body = { name: v.name, contactPerson: v.contactPerson, phone: v.phone, email: v.email };
    modal.id ? await api.put(`/suppliers/${modal.id}`, body) : await api.post('/suppliers', body);
    setModal(null); load();
  };
  const remove = async (r) => {
    if (!confirm(`Delete ${r.name}?`)) return;
    try { await api.delete(`/suppliers/${r.id}`); load(); } catch (e) { alert(errMsg(e)); }
  };

  const columns = [
    { label: 'Supplier', render: (r) => <b>{r.name}</b> },
    { label: 'Contact', render: (r) => r.contactPerson || '-' },
    { label: 'Phone', render: (r) => r.phone || '-' },
    { label: 'Email', render: (r) => r.email || '-' },
    { label: 'Jobs', key: 'tickets' },
    { label: 'Total spend', render: (r) => money(r.totalCost) },
    { label: '', render: (r) => (
      <span className="row-actions">
        <button className="btn small" onClick={() => setModal(r)}>Edit</button>
        <button className="btn small danger" onClick={() => remove(r)}>Delete</button>
      </span>) },
  ];

  return (
    <>
      <PageHeader title="Suppliers">
        <button className="btn primary" onClick={() => setModal({})}>+ Supplier</button>
      </PageHeader>
      <DataList rows={rows} columns={columns} empty="No suppliers yet" />
      {modal && <FormModal title={modal.id ? 'Edit supplier' : 'New supplier'} fields={fields} initial={modal} onSave={save} onClose={() => setModal(null)} />}
    </>
  );
}
