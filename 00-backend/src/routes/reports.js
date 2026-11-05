const router = require('express').Router();
const { Op } = require('sequelize');
const {
  Payment,
  Rental,
  RentalItem,
  Asset,
  Product,
  Customer,
  Maintenance,
} = require('../models');
const { authenticate, authorize } = require('../middleware/auth');

const h = fn => (req, res, next) => fn(req, res).catch(next);
const fail = (msg, status = 400) => {
  const e = new Error(msg);
  e.status = status;
  throw e;
};
router.use(authenticate, authorize('admin'));

const DAY = 86400000;
const num = v => Number(v || 0);
const r2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
const pad = n => String(n).padStart(2, '0');
const ymd = d =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const range = q => {
  const to = q.to
    ? new Date(`${q.to}T23:59:59.999`)
    : new Date(new Date().setHours(23, 59, 59, 999));
  const from = q.from
    ? new Date(`${q.from}T00:00:00`)
    : new Date(new Date(to.getTime() - 29 * DAY).setHours(0, 0, 0, 0));
  if (isNaN(from) || isNaN(to) || from > to) fail('Invalid date range');
  if (to - from > 366 * DAY) fail('Range is limited to one year');
  return { from, to };
};
const paymentsIn = (from, to, extra = {}) =>
  Payment.findAll({
    where: { createdAt: { [Op.between]: [from, to] }, ...extra },
    order: [['createdAt', 'ASC']],
  });

const REVENUE = ['rent', 'late_fee', 'damage'];

router.get(
  '/summary',
  h(async (req, res) => {
    const { from, to } = range(req.query);
    const pays = await paymentsIn(from, to);
    const sum = fn =>
      r2(pays.filter(fn).reduce((s, p) => s + num(p.amount), 0));

    const byType = Object.fromEntries(
      REVENUE.map(t => [t, sum(p => p.type === t)])
    );
    const revenue = r2(byType.rent + byType.late_fee + byType.damage);
    const cashIn = sum(
      p => p.method !== 'deposit' && [...REVENUE, 'deposit'].includes(p.type)
    );
    const refunds = sum(p => p.type === 'refund');

    const open = await Rental.findAll({
      where: { status: { [Op.in]: ['reserved', 'dispatched'] } },
      include: [Payment],
    });
    const depositsHeld = r2(
      open.reduce(
        (s, r) =>
          s +
          r.Payments.filter(p => p.type === 'deposit').reduce(
            (a, p) => a + num(p.amount),
            0
          ) -
          r.Payments.filter(p => p.type === 'refund').reduce(
            (a, p) => a + num(p.amount),
            0
          ),
        0
      )
    );

    const maint = await Maintenance.findAll({
      where: { status: 'done', completedAt: { [Op.between]: [from, to] } },
    });
    const maintenanceCost = r2(maint.reduce((s, m) => s + num(m.cost), 0));

    res.json({
      from: ymd(from),
      to: ymd(to),
      revenue,
      revenueBreakdown: byType,
      cashIn,
      refunds,
      netCash: r2(cashIn - refunds),
      depositsHeld,
      maintenanceCost,
      netAfterMaintenance: r2(revenue - maintenanceCost),
      rentalsCreated: await Rental.count({
        where: { createdAt: { [Op.between]: [from, to] } },
      }),
      overdueNow: await Rental.count({
        where: { status: 'dispatched', dueDate: { [Op.lt]: new Date() } },
      }),
    });
  })
);

router.get(
  '/revenue-trend',
  h(async (req, res) => {
    const { from, to } = range(req.query);
    const pays = await paymentsIn(from, to, { type: { [Op.in]: REVENUE } });
    const days = {};
    for (let d = new Date(from); d <= to; d = new Date(d.getTime() + DAY))
      days[ymd(d)] = {
        date: ymd(d),
        rent: 0,
        late_fee: 0,
        damage: 0,
        revenue: 0,
      };
    for (const p of pays) {
      const row = days[ymd(new Date(p.createdAt))];
      if (!row) continue;
      row[p.type] = r2(row[p.type] + num(p.amount));
      row.revenue = r2(row.revenue + num(p.amount));
    }
    res.json(Object.values(days));
  })
);

router.get(
  '/utilization',
  h(async (req, res) => {
    const { from, to } = range(req.query);
    const rangeDays = Math.max(1, (to - from) / DAY);
    const now = new Date();

    const assets = await Asset.findAll({
      where: { status: { [Op.ne]: 'retired' } },
      include: [Product],
    });
    const items = await RentalItem.findAll({
      include: [
        {
          model: Rental,
          required: true,
          where: { dispatchedAt: { [Op.ne]: null, [Op.lte]: to } },
        },
      ],
    });

    const perAsset = {};
    const billed = {};
    for (const it of items) {
      const r = it.Rental;
      const s = Math.max(new Date(r.dispatchedAt), from);
      const e = Math.min(r.returnedAt ? new Date(r.returnedAt) : now, to);
      if (e > s)
        perAsset[it.assetId] = (perAsset[it.assetId] || 0) + (e - s) / DAY;
      if (new Date(r.dispatchedAt) >= from)
        billed[it.assetId] = (billed[it.assetId] || 0) + num(it.amount);
    }

    const products = {};
    const assetRows = assets.map(a => {
      const days = perAsset[a.id] || 0;
      const p = (products[a.productId] ||= {
        productId: a.productId,
        name: a.Product?.name,
        assets: 0,
        rentedDays: 0,
        billedRent: 0,
      });
      p.assets += 1;
      p.rentedDays += days;
      p.billedRent += billed[a.id] || 0;
      return {
        id: a.id,
        serialNo: a.serialNo,
        product: a.Product?.name,
        rentedDays: r2(days),
        utilization: Math.min(100, r2((days / rangeDays) * 100)),
      };
    });

    res.json({
      from: ymd(from),
      to: ymd(to),
      rangeDays: r2(rangeDays),
      products: Object.values(products)
        .map(p => ({
          ...p,
          rentedDays: r2(p.rentedDays),
          billedRent: r2(p.billedRent),
          utilization: Math.min(
            100,
            r2((p.rentedDays / (p.assets * rangeDays)) * 100)
          ),
        }))
        .sort((a, b) => b.utilization - a.utilization),
      assets: assetRows.sort((a, b) => b.rentedDays - a.rentedDays),
    });
  })
);

router.get(
  '/ledger',
  h(async (req, res) => {
    const { from, to } = range(req.query);
    const extra = req.query.type ? { type: req.query.type } : {};
    const rows = await Payment.findAll({
      where: { createdAt: { [Op.between]: [from, to] }, ...extra },
      include: [
        { model: Rental, attributes: ['id', 'code'] },
        { model: Customer, attributes: ['id', 'name'] },
      ],
      order: [['createdAt', 'DESC']],
      limit: 1000,
    });
    const out = rows.map(p => ({
      id: p.id,
      date: p.createdAt,
      rentalId: p.rentalId,
      rentalCode: p.Rental?.code,
      customer: p.Customer?.name,
      type: p.type,
      method: p.method,
      amount: num(p.amount),
      note: p.note,
      direction: p.type === 'refund' ? 'debit' : 'credit',
      movesCash: p.method !== 'deposit',
    }));
    const credits = r2(
      out
        .filter(x => x.direction === 'credit' && x.movesCash)
        .reduce((s, x) => s + x.amount, 0)
    );
    const debits = r2(
      out.filter(x => x.direction === 'debit').reduce((s, x) => s + x.amount, 0)
    );
    res.json({
      rows: out,
      totals: { credits, debits, net: r2(credits - debits) },
    });
  })
);

module.exports = router;
