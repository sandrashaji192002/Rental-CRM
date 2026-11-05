import { useEffect, useState, useCallback } from 'react';
import api, { errMsg } from '../api';
import { useAuth } from '../auth';
import { Badge, DataList, FormModal, PageHeader, money, statusTone } from '../ui';

const STATUSES = ['available', 'rented', 'maintenance', 'retired'];
const CONDITIONS = ['good', 'fair', 'damaged'];
const opts = (a) => a.map((x) => ({ value: x, label: x }));

export default function Assets() {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';
  const [rows, setRows] = useState([]);
  const [products, setProducts] = useState([]);
  const [f, setF] = useState({ q: '', productId: '', status: '' });
  const [modal, setModal] = useState(null);

  const load = useCallback(async () => {
    const [a, p] = await Promise.all([api.get('/assets', { params: f }), api.get('/products')]);
    setRows(a.data); setProducts(p.data);
  }, [f]);
  useEffect(() => { load(); }, [load]);

  const save = async (v) => {
    modal.id ? await api.put(`/assets/${modal.id}`, v) : await api.post('/assets', v);
    setModal(null); load();
  };
  const remove = async (r) => {
    if (!confirm(`Remove ${r.serialNo}?`)) return;
    try {
      const { data } = await api.delete(`/assets/${r.id}`);
      if (data.retired) alert('Asset has rental history, so it was retired instead of deleted.');
      load();
    } catch (e) { alert(errMsg(e)); }
  };

  const fields = [
    { name: 'productId', label: 'Product', type: 'select', required: true, options: products.map((p) => ({ value: p.id, label: p.name })) },
    { name: 'serialNo', label: 'Serial number', required: true },
    { name: 'status', label: 'Status', type: 'select', options: opts(STATUSES) },
    { name: 'condition', label: 'Condition', type: 'select', options: opts(CONDITIONS) },
    { name: 'purchaseDate', label: 'Purchase date', type: 'date' },
    { name: 'purchaseCost', label: 'Purchase cost (₹)', type: 'number' },
  ];

  const columns = [
    { label: 'Serial', render: (r) => <b>{r.serialNo}</b> },
    { label: 'Product', render: (r) => r.Product?.name },
    { label: 'Status', render: (r) => <Badge tone={statusTone[r.status]}>{r.status}</Badge> },
    { label: 'Condition', render: (r) => <Badge tone={statusTone[r.condition]}>{r.condition}</Badge> },
    { label: 'Cost', render: (r) => money(r.purchaseCost) },
    ...(isAdmin ? [{ label: '', render: (r) => (
      <span className="row-actions">
        <button className="btn small" onClick={() => setModal(r)}>Edit</button>
        <button className="btn small danger" onClick={() => remove(r)}>Delete</button>
      </span>) }] : []),
  ];

  return (
    <>
      <PageHeader title="Assets">
        {isAdmin && <button className="btn primary" onClick={() => setModal({ status: 'available', condition: 'good' })}>+ Asset</button>}
      </PageHeader>
      <div className="filters">
        <input className="search" placeholder="Serial…" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
        <select value={f.productId} onChange={(e) => setF({ ...f, productId: e.target.value })}>
          <option value="">All products</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      <DataList rows={rows} columns={columns} />
      {modal && <FormModal title={modal.id ? 'Edit asset' : 'New asset'} fields={fields} initial={modal} onSave={save} onClose={() => setModal(null)} />}
    </>
  );
}
