import { useEffect, useState, useCallback } from 'react';
import api, { errMsg } from '../api';
import { useAuth } from '../auth';
import { DataList, FormModal, PageHeader, money } from '../ui';

export default function Products() {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';
  const [rows, setRows] = useState([]);
  const [cats, setCats] = useState([]);
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(null);
  const load = useCallback(async () => {
    const [p, c] = await Promise.all([
      api.get('/products', { params: { q } }),
      api.get('/categories'),
    ]);
    setRows(p.data);
    setCats(c.data);
  }, [q]);
  useEffect(() => {
    load();
  }, [load]);

  const save = async v => {
    modal.id
      ? await api.put(`/products/${modal.id}`, v)
      : await api.post('/products', v);
    setModal(null);
    load();
  };
  const remove = async r => {
    if (!confirm(`Deactivate ${r.name}?`)) return;
    try {
      await api.delete(`/products/${r.id}`);
      load();
    } catch (e) {
      alert(errMsg(e));
    }
  };
  const addCategory = async () => {
    const name = prompt('New category name');
    if (name) {
      try {
        await api.post('/categories', { name });
        load();
      } catch (e) {
        alert(errMsg(e));
      }
    }
  };

  const fields = [
    { name: 'name', label: 'Name', required: true },
    {
      name: 'categoryId',
      label: 'Category',
      type: 'select',
      required: true,
      options: cats.map(c => ({ value: c.id, label: c.name })),
    },
    {
      name: 'dailyRate',
      label: 'Daily rate (₹)',
      type: 'number',
      required: true,
    },
    { name: 'weeklyRate', label: 'Weekly rate (₹)', type: 'number' },
    {
      name: 'securityDeposit',
      label: 'Security deposit (₹)',
      type: 'number',
      required: true,
    },
    { name: 'description', label: 'Description', type: 'textarea' },
  ];

  const columns = [
    { label: 'Product', render: r => <b>{r.name}</b> },
    { label: 'Category', render: r => r.Category?.name || '-' },
    { label: 'Daily', render: r => money(r.dailyRate) },
    { label: 'Weekly', render: r => money(r.weeklyRate) },
    { label: 'Deposit', render: r => money(r.securityDeposit) },
    {
      label: 'Available',
      render: r => `${r.availableAssets} / ${r.totalAssets}`,
    },
    ...(isAdmin
      ? [
          {
            label: '',
            render: r => (
              <span className="row-actions" onClick={e => e.stopPropagation()}>
                <button className="btn small" onClick={() => setModal(r)}>
                  Edit
                </button>
                <button className="btn small danger" onClick={() => remove(r)}>
                  Delete
                </button>
              </span>
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader title="Products">
        <input
          className="search"
          placeholder="Search…"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
        {isAdmin && (
          <button className="btn" onClick={addCategory}>
            + Category
          </button>
        )}
        {isAdmin && (
          <button className="btn primary" onClick={() => setModal({})}>
            + Product
          </button>
        )}
      </PageHeader>
      <DataList rows={rows} columns={columns} />
      {modal && (
        <FormModal
          title={modal.id ? 'Edit product' : 'New product'}
          fields={fields}
          initial={modal}
          onSave={save}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}
