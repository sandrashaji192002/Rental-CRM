import { useEffect, useState, useCallback } from 'react';
import api, { errMsg } from '../api';
import {
  Badge,
  DataList,
  FormModal,
  PageHeader,
  money,
  fmtD,
  statusTone,
} from '../ui';

const TABS = [
  ['', 'All'],
  ['open', 'Open'],
  ['in_progress', 'In progress'],
  ['done', 'Done'],
];

export default function Maintenance() {
  const [rows, setRows] = useState([]);
  const [tab, setTab] = useState('');
  const [suppliers, setSuppliers] = useState([]);
  const [assets, setAssets] = useState([]);
  const [modal, setModal] = useState(null);
  const load = useCallback(async () => {
    const [m, s, a] = await Promise.all([
      api.get('/maintenance', { params: { status: tab || undefined } }),
      api.get('/suppliers'),
      api.get('/assets'),
    ]);
    setRows(m.data);
    setSuppliers(s.data);
    setAssets(a.data);
  }, [tab]);
  useEffect(() => {
    load();
  }, [load]);

  const supplierOpts = suppliers.map(s => ({ value: s.id, label: s.name }));
  const put = async (id, body) => {
    await api.put(`/maintenance/${id}`, body);
    setModal(null);
    load();
  };
  const start = async r => {
    try {
      await put(r.id, { status: 'in_progress' });
    } catch (e) {
      alert(errMsg(e));
    }
  };

  const newFields = [
    {
      name: 'assetId',
      label: 'Asset',
      type: 'select',
      required: true,
      options: assets
        .filter(a => !['rented', 'retired'].includes(a.status))
        .map(a => ({
          value: a.id,
          label: `${a.serialNo} — ${a.Product?.name}`,
        })),
    },
    {
      name: 'issue',
      label: 'Issue / work needed',
      type: 'textarea',
      required: true,
    },
    {
      name: 'supplierId',
      label: 'Supplier (optional)',
      type: 'select',
      options: supplierOpts,
    },
    { name: 'cost', label: 'Estimated cost (₹)', type: 'number' },
  ];
  const editFields = [
    {
      name: 'issue',
      label: 'Issue / work needed',
      type: 'textarea',
      required: true,
    },
    {
      name: 'supplierId',
      label: 'Supplier',
      type: 'select',
      options: supplierOpts,
    },
    { name: 'cost', label: 'Cost (₹)', type: 'number' },
  ];
  const doneFields = [
    { name: 'cost', label: 'Final cost (₹)', type: 'number', required: true },
    {
      name: 'outcome',
      label: 'Outcome',
      type: 'select',
      required: true,
      options: [
        { value: 'restore', label: 'Repaired — return to service' },
        { value: 'retire', label: 'Beyond repair — retire asset' },
      ],
    },
  ];

  const columns = [
    {
      label: 'Asset',
      render: r => (
        <>
          <b>{r.Asset?.serialNo}</b>
          <div className="muted">{r.Asset?.Product?.name}</div>
        </>
      ),
    },
    { label: 'Issue', render: r => r.issue },
    { label: 'Supplier', render: r => r.Supplier?.name || '-' },
    { label: 'Cost', render: r => money(r.cost) },
    { label: 'Opened', render: r => fmtD(r.startedAt || r.createdAt) },
    {
      label: 'Status',
      render: r => (
        <Badge tone={statusTone[r.status]}>{r.status.replace('_', ' ')}</Badge>
      ),
    },
    {
      label: '',
      render: r =>
        r.status === 'done' ? (
          <span className="muted">Closed {fmtD(r.completedAt)}</span>
        ) : (
          <span className="row-actions">
            {r.status === 'open' && (
              <button className="btn small" onClick={() => start(r)}>
                Start
              </button>
            )}
            <button
              className="btn small"
              onClick={() => setModal({ kind: 'edit', row: r })}
            >
              Edit
            </button>
            <button
              className="btn small primary"
              onClick={() => setModal({ kind: 'complete', row: r })}
            >
              Complete
            </button>
          </span>
        ),
    },
  ];

  return (
    <>
      <PageHeader title="Maintenance">
        <button
          className="btn primary"
          onClick={() => setModal({ kind: 'new' })}
        >
          + Ticket
        </button>
      </PageHeader>
      <p className="muted">
        Assets with an open ticket are removed from availability. Damaged
        returns create a ticket automatically.
      </p>
      <div className="tabs">
        {TABS.map(([v, l]) => (
          <button
            key={l}
            className={'tab-btn' + (tab === v ? ' on' : '')}
            onClick={() => setTab(v)}
          >
            {l}
          </button>
        ))}
      </div>
      <DataList rows={rows} columns={columns} empty="No maintenance tickets" />

      {modal?.kind === 'new' && (
        <FormModal
          title="New maintenance ticket"
          fields={newFields}
          onSave={async v => {
            await api.post('/maintenance', v);
            setModal(null);
            load();
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.kind === 'edit' && (
        <FormModal
          title="Edit ticket"
          fields={editFields}
          initial={modal.row}
          onSave={v =>
            put(modal.row.id, {
              issue: v.issue,
              supplierId: v.supplierId || null,
              cost: v.cost,
            })
          }
          onClose={() => setModal(null)}
        />
      )}
      {modal?.kind === 'complete' && (
        <FormModal
          title={`Complete — ${modal.row.Asset?.serialNo}`}
          fields={doneFields}
          initial={{ cost: modal.row.cost, outcome: 'restore' }}
          onSave={v =>
            put(modal.row.id, {
              status: 'done',
              cost: v.cost,
              outcome: v.outcome,
            })
          }
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}
