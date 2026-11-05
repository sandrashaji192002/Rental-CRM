import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import api, { errMsg } from '../api';
import { useAuth } from '../auth';
import { useBase } from '../layouts';
import {
  Badge,
  FormModal,
  Modal,
  PageHeader,
  money,
  fmtDT,
  rentalStatus,
  statusTone,
  toLocalInput,
} from '../ui';
import { positive } from '../validators';

const METHODS = ['cash', 'card', 'upi'].map(m => ({
  value: m,
  label: m.toUpperCase(),
}));

export default function RentalDetail() {
  const { id } = useParams();
  const base = useBase();
  const [r, setR] = useState(null);
  const [modal, setModal] = useState(null);

  const load = useCallback(
    async () => setR((await api.get(`/rentals/${id}`)).data),
    [id]
  );
  useEffect(() => {
    load();
  }, [load]);
  if (!r) return <div className="empty">Loading…</div>;

  const act = async fn => {
    try {
      await fn();
      await load();
    } catch (e) {
      alert(errMsg(e));
    }
  };
  const charges =
    Number(r.rentTotal) + Number(r.lateFee) + Number(r.damageCharge);
  const depositLeft = Math.max(0, Number(r.depositTotal) - r.depositPaid);
  const canPayDeposit =
    ['reserved', 'dispatched'].includes(r.status) && depositLeft > 0;
  const canPay = canPayDeposit || r.due > 0;

  const payFields = [
    {
      name: 'type',
      label: 'Payment for',
      type: 'select',
      required: true,
      options: [
        ...(canPayDeposit
          ? [
              {
                value: 'deposit',
                label: `Security deposit (${money(depositLeft)} left)`,
              },
            ]
          : []),
        ...(r.due > 0
          ? [{ value: 'dues', label: `Rent / dues (${money(r.due)} owing)` }]
          : []),
      ],
    },
    {
      name: 'amount',
      label: 'Amount (₹)',
      type: 'number',
      required: true,
      validate: positive,
    },
    {
      name: 'method',
      label: 'Method',
      type: 'select',
      required: true,
      options: METHODS,
    },
  ];
  const payInitial = canPayDeposit
    ? { type: 'deposit', amount: depositLeft, method: 'cash' }
    : { type: 'dues', amount: r.due, method: 'cash' };

  const itemCols = r.RentalItems;

  return (
    <>
      <Link
        to={base === '/ops' ? '/ops' : `${base}/rentals`}
        className="back no-print"
      >
        ← Rentals
      </Link>
      <PageHeader title={`${r.code}`}>
        <Badge tone={statusTone[rentalStatus(r)]}>{rentalStatus(r)}</Badge>
        <button className="btn no-print" onClick={() => window.print()}>
          Print agreement
        </button>
      </PageHeader>

      {r.overdue && (
        <div className="banner">
          Overdue by {r.liveLateDays} day(s). Late fee so far:{' '}
          <b>{money(r.liveLateFee)}</b> (final fee is calculated at return).
        </div>
      )}

      <section className="panel info">
        <div>
          <span>Customer</span>
          <b>
            <Link to={`${base}/customers/${r.customerId}`}>
              {r.Customer?.name}
            </Link>
          </b>
          <small>{r.Customer?.phone}</small>
        </div>
        <div>
          <span>Start</span>
          <b>{fmtDT(r.startDate)}</b>
        </div>
        <div>
          <span>Due back</span>
          <b>{fmtDT(r.dueDate)}</b>
        </div>
        <div>
          <span>Dispatched</span>
          <b>{fmtDT(r.dispatchedAt)}</b>
        </div>
        <div>
          <span>Returned</span>
          <b>{fmtDT(r.returnedAt)}</b>
        </div>
        <div>
          <span>Handled by</span>
          <b>{r.staff?.name || '-'}</b>
        </div>
      </section>

      <section className="panel">
        <h3>Items</h3>
        <div className="lines">
          {itemCols.map(i => (
            <div key={i.id} className="line">
              <div>
                <b>{i.Asset?.Product?.name}</b>{' '}
                <span className="muted">· {i.Asset?.serialNo}</span>
                {i.Inspection && (
                  <div className="muted">
                    Returned {i.Inspection.condition}
                    {i.Inspection.damageNotes
                      ? ` — ${i.Inspection.damageNotes}`
                      : ''}
                    {Number(i.Inspection.damageCharge) > 0
                      ? ` (charge ${money(i.Inspection.damageCharge)})`
                      : ''}
                  </div>
                )}
              </div>
              <div className="right">
                {money(i.amount)}
                <small>{money(i.rate)}/day</small>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel money">
        <h3>Billing</h3>
        <div className="sum">
          <span>Rent</span>
          <b>{money(r.rentTotal)}</b>
        </div>
        {Number(r.lateFee) > 0 && (
          <div className="sum">
            <span>Late fee</span>
            <b>{money(r.lateFee)}</b>
          </div>
        )}
        {Number(r.damageCharge) > 0 && (
          <div className="sum">
            <span>Damage charges</span>
            <b>{money(r.damageCharge)}</b>
          </div>
        )}
        <div className="sum total">
          <span>Total charges</span>
          <b>{money(charges)}</b>
        </div>
        <div className="sum">
          <span>Paid toward charges</span>
          <b>{money(r.paidDues)}</b>
        </div>
        <div className="sum">
          <span>Balance due</span>
          <b className={r.due > 0 ? 'red' : ''}>{money(r.due)}</b>
        </div>
        <hr />
        <div className="sum">
          <span>Security deposit required</span>
          <b>{money(r.depositTotal)}</b>
        </div>
        <div className="sum">
          <span>Deposit collected</span>
          <b>{money(r.depositPaid)}</b>
        </div>
        {r.depositRefunded > 0 && (
          <div className="sum">
            <span>Deposit refunded</span>
            <b>{money(r.depositRefunded)}</b>
          </div>
        )}
      </section>

      <section className="panel no-print">
        <h3>Actions</h3>
        <div className="actions">
          {canPay && (
            <button className="btn primary" onClick={() => setModal('pay')}>
              Collect payment
            </button>
          )}
          {r.status === 'reserved' && (
            <>
              <button
                className="btn primary"
                disabled={depositLeft > 0}
                title={depositLeft > 0 ? 'Collect the full deposit first' : ''}
                onClick={() => act(() => api.post(`/rentals/${id}/dispatch`))}
              >
                Dispatch
              </button>
              <button
                className="btn danger"
                onClick={() =>
                  confirm(
                    'Cancel this reservation? Collected money will be refunded.'
                  ) && act(() => api.post(`/rentals/${id}/cancel`, {}))
                }
              >
                Cancel
              </button>
            </>
          )}
          {r.status === 'dispatched' && (
            <button className="btn primary" onClick={() => setModal('return')}>
              Process return
            </button>
          )}
        </div>
        {r.status === 'reserved' && depositLeft > 0 && (
          <p className="muted">
            Dispatch unlocks once the security deposit of{' '}
            {money(r.depositTotal)} is collected.
          </p>
        )}
        {r.status === 'returned' && r.due > 0 && (
          <p className="muted">
            Returned, but the customer still owes {money(r.due)}. The rental
            closes when it is paid.
          </p>
        )}
      </section>

      <section className="panel">
        <h3>Payment ledger</h3>
        {!r.Payments.length ? (
          <div className="muted">No payments yet</div>
        ) : (
          <div className="lines">
            {r.Payments.map(p => (
              <div key={p.id} className="line">
                <div>
                  <b>{p.type.replace('_', ' ')}</b>{' '}
                  <span className="muted">
                    ·{' '}
                    {p.method === 'deposit'
                      ? 'adjusted from deposit'
                      : p.method}
                  </span>
                  <div className="muted">
                    {fmtDT(p.createdAt)}
                    {p.note ? ` · ${p.note}` : ''}
                  </div>
                </div>
                <div className={'right ' + (p.type === 'refund' ? 'red' : '')}>
                  {p.type === 'refund' ? '−' : ''}
                  {money(p.amount)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="print-only agreement">
        <h3>Rental Agreement — {r.code}</h3>
        <p>
          The customer named above agrees to rent the listed equipment for the
          period shown and to return it in the same condition, fair wear
          excepted. Late returns are charged at 1.5× the daily rate for each
          late day after a 60-minute grace period. Damage or loss is chargeable
          and will be adjusted against the security deposit; any balance is
          payable on return.
        </p>
        <div className="sign">
          <div>Customer signature</div>
          <div>Staff signature</div>
        </div>
      </section>

      {modal === 'pay' && (
        <FormModal
          title="Collect payment"
          fields={payFields}
          initial={payInitial}
          onSave={async v => {
            await api.post(`/rentals/${id}/payments`, {
              type: v.type,
              amount: Number(v.amount),
              method: v.method,
            });
            setModal(null);
            load();
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'return' && (
        <ReturnModal
          r={r}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            load();
          }}
        />
      )}
    </>
  );
}

function ReturnModal({ r, onClose, onDone }) {
  const { user } = useAuth();
  const [insp, setInsp] = useState(() =>
    Object.fromEntries(
      r.RentalItems.map(i => [
        i.id,
        { condition: 'good', damageNotes: '', damageCharge: '' },
      ])
    )
  );
  const [refundMethod, setRefundMethod] = useState('cash');
  const [at, setAt] = useState('');
  const [preview, setPreview] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const params = at ? { returnedAt: new Date(at).toISOString() } : {};
        setPreview(
          (await api.get(`/rentals/${r.id}/return-preview`, { params })).data
        );
      } catch (e) {
        setErr(errMsg(e));
      }
    })();
  }, [at, r.id]);

  const set = (id, k, v) =>
    setInsp(s => ({ ...s, [id]: { ...s[id], [k]: v } }));
  const damage = Object.values(insp).reduce(
    (s, x) => s + (x.condition === 'damaged' ? Number(x.damageCharge || 0) : 0),
    0
  );
  const late = preview?.lateFee || 0;
  const owed = r.due + late + damage;
  const held = r.depositPaid - r.depositRefunded;
  const fromDeposit = Math.min(owed, held);
  const refund = held - fromDeposit;
  const balance = owed - fromDeposit;

  const confirmReturn = async () => {
    setBusy(true);
    setErr('');
    try {
      await api.post(`/rentals/${r.id}/return`, {
        refundMethod,
        ...(at ? { returnedAt: new Date(at).toISOString() } : {}),
        inspections: r.RentalItems.map(i => ({
          rentalItemId: i.id,
          ...insp[i.id],
          damageCharge: Number(insp[i.id].damageCharge || 0),
        })),
      });
      onDone();
    } catch (e) {
      setErr(errMsg(e));
      setBusy(false);
    }
  };

  return (
    <Modal title={`Return ${r.code}`} onClose={onClose} wide>
      <div className="form">
        <h4>Inspection</h4>
        {r.RentalItems.map(i => (
          <div key={i.id} className="insp">
            <b>
              {i.Asset?.Product?.name}{' '}
              <span className="muted">· {i.Asset?.serialNo}</span>
            </b>
            <select
              value={insp[i.id].condition}
              onChange={e => set(i.id, 'condition', e.target.value)}
            >
              <option value="good">Good</option>
              <option value="fair">Fair (minor wear)</option>
              <option value="damaged">Damaged</option>
            </select>
            {insp[i.id].condition === 'damaged' && (
              <>
                <input
                  placeholder="Describe the damage"
                  value={insp[i.id].damageNotes}
                  onChange={e => set(i.id, 'damageNotes', e.target.value)}
                />
                <input
                  type="number"
                  min="0"
                  placeholder="Damage charge (₹)"
                  value={insp[i.id].damageCharge}
                  onChange={e => set(i.id, 'damageCharge', e.target.value)}
                />
                <small className="muted">
                  Damaged items go to maintenance automatically.
                </small>
              </>
            )}
          </div>
        ))}

        {user.role === 'admin' && (
          <label>
            <span className="lbl">Return time</span>
            <input
              type="datetime-local"
              value={at}
              max={toLocalInput(new Date(Date.now() + 30 * 86400000))}
              onChange={e => setAt(e.target.value)}
            />
          </label>
        )}

        <h4>Settlement preview</h4>
        <div className="sum">
          <span>Rent still unpaid</span>
          <b>{money(r.due)}</b>
        </div>
        <div className="sum">
          <span>
            Late fee
            {preview?.lateDays
              ? ` (${preview.lateDays} day${preview.lateDays > 1 ? 's' : ''})`
              : ''}
          </span>
          <b>{money(late)}</b>
        </div>
        <div className="sum">
          <span>Damage charges</span>
          <b>{money(damage)}</b>
        </div>
        <div className="sum total">
          <span>Total owed</span>
          <b>{money(owed)}</b>
        </div>
        <div className="sum">
          <span>Deposit held</span>
          <b>{money(held)}</b>
        </div>
        <div className="sum">
          <span>Taken from deposit</span>
          <b>{money(fromDeposit)}</b>
        </div>
        {refund > 0 && (
          <div className="sum">
            <span>Refund to customer</span>
            <b className="green">{money(refund)}</b>
          </div>
        )}
        {balance > 0 && (
          <div className="sum">
            <span>Balance customer must pay</span>
            <b className="red">{money(balance)}</b>
          </div>
        )}
        {refund > 0 && (
          <label>
            <span className="lbl">Refund via</span>
            <select
              value={refundMethod}
              onChange={e => setRefundMethod(e.target.value)}
            >
              {METHODS.map(m => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        )}

        {err && <div className="error">{err}</div>}
        <button
          className="btn primary"
          disabled={busy || !preview}
          onClick={confirmReturn}
        >
          {busy ? 'Processing…' : 'Confirm return'}
        </button>
      </div>
    </Modal>
  );
}
