import { useEffect, useState, useCallback } from 'react';
import api, { errMsg } from '../api';
import { Badge, DataList, FormModal, PageHeader } from '../ui';

const roleOpts = [{ value: 'staff', label: 'Staff' }, { value: 'admin', label: 'Admin' }];

export default function Staff() {
  const [rows, setRows] = useState([]);
  const [modal, setModal] = useState(null);

  const load = useCallback(async () => setRows((await api.get('/users')).data), []);
  useEffect(() => { load(); }, [load]);

  const isNew = modal && !modal.id;
  const fields = [
    { name: 'name', label: 'Name', required: true },
    ...(isNew ? [{ name: 'email', label: 'Email', type: 'email', required: true }] : []),
    { name: 'password', label: isNew ? 'Password' : 'New password (leave blank to keep)', type: 'password', required: isNew },
    { name: 'role', label: 'Role', type: 'select', required: true, options: roleOpts },
  ];

  const save = async (v) => {
    modal.id ? await api.put(`/users/${modal.id}`, { name: v.name, role: v.role, password: v.password || undefined })
             : await api.post('/users', v);
    setModal(null); load();
  };
  const toggle = async (r) => {
    try { await api.put(`/users/${r.id}`, { active: !r.active }); load(); } catch (e) { alert(errMsg(e)); }
  };

  const columns = [
    { label: 'Name', render: (r) => <b>{r.name}</b> },
    { label: 'Email', key: 'email' },
    { label: 'Role', render: (r) => <Badge tone={r.role === 'admin' ? 'blue' : 'gray'}>{r.role}</Badge> },
    { label: 'Status', render: (r) => <Badge tone={r.active ? 'green' : 'red'}>{r.active ? 'active' : 'disabled'}</Badge> },
    { label: '', render: (r) => (
      <span className="row-actions">
        <button className="btn small" onClick={() => setModal(r)}>Edit</button>
        <button className="btn small" onClick={() => toggle(r)}>{r.active ? 'Disable' : 'Enable'}</button>
      </span>) },
  ];

  return (
    <>
      <PageHeader title="Staff">
        <button className="btn primary" onClick={() => setModal({ role: 'staff' })}>+ Staff</button>
      </PageHeader>
      <DataList rows={rows} columns={columns} />
      {modal && <FormModal title={isNew ? 'New staff' : 'Edit staff'} fields={fields} initial={{ ...modal, password: '' }} onSave={save} onClose={() => setModal(null)} />}
    </>
  );
}
