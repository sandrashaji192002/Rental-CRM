const router = require('express').Router();
const { Op } = require('sequelize');
const {
  sequelize,
  Rental,
  RentalItem,
  Asset,
  Product,
  Category,
  Customer,
  Payment,
  Inspection,
  Maintenance,
  User,
} = require('../models');
const { authenticate } = require('../middleware/auth');
const svc = require('../services/rental');

const h = fn => (req, res, next) => fn(req, res).catch(next);
const fail = (msg, status = 400) => {
  const e = new Error(msg);
  e.status = status;
  throw e;
};
router.use(authenticate);

const FULL = [
  Customer,
  { model: User, as: 'staff', attributes: ['id', 'name'] },
  {
    model: RentalItem,
    include: [{ model: Asset, include: [Product] }, Inspection],
  },
  Payment,
];
const loadFull = async (id, transaction) => {
  const r = await Rental.findByPk(id, {
    include: FULL,
    transaction,
    order: [[Payment, 'createdAt', 'ASC']],
  });
  return r && { ...r.toJSON(), ...svc.summarize(r) };
};
const METHODS = ['cash', 'card', 'upi'];

const lockRental = async (id, t) => {
  const r = await Rental.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
  if (!r) fail('Rental not found', 404);
  r.Payments = await Payment.findAll({
    where: { rentalId: r.id },
    transaction: t,
  });
  return r;
};

router.get(
  '/availability',
  h(async (req, res) => {
    const start = new Date(req.query.start || Date.now());
    const end = new Date(req.query.end);
    if (isNaN(start) || isNaN(end) || end <= start)
      fail('Valid start and end (end after start) required');

    const blocked = await svc.blockedAssetIds(start, end);
    const assets = await Asset.findAll({
      where: { status: { [Op.notIn]: ['maintenance', 'retired'] } },
      include: [
        { model: Product, where: { active: true }, include: [Category] },
      ],
      order: [['serialNo', 'ASC']],
    });
    const days = svc.rentalDays(start, end);
    const byProduct = {};
    for (const a of assets) {
      if (blocked.has(a.id)) continue;
      const p = a.Product;
      byProduct[p.id] ||= {
        productId: p.id,
        name: p.name,
        category: p.Category?.name,
        dailyRate: p.dailyRate,
        weeklyRate: p.weeklyRate,
        securityDeposit: p.securityDeposit,
        estRent: svc.itemRent(p.dailyRate, p.weeklyRate, days),
        assets: [],
      };
      byProduct[p.id].assets.push({
        id: a.id,
        serialNo: a.serialNo,
        condition: a.condition,
      });
    }
    res.json({
      days,
      products: Object.values(byProduct).map(p => ({
        ...p,
        availableCount: p.assets.length,
      })),
    });
  })
);

// ---------- List / detail ----------
router.get(
  '/rentals',
  h(async (req, res) => {
    const where = {};
    if (req.query.customerId) where.customerId = req.query.customerId;
    if (req.query.status === 'overdue')
      Object.assign(where, {
        status: 'dispatched',
        dueDate: { [Op.lt]: new Date() },
      });
    else if (req.query.status) where.status = req.query.status;
    if (req.query.q) {
      const like = { [Op.like]: `%${req.query.q}%` };
      where[Op.or] = [
        { code: like },
        { '$Customer.name$': like },
        { '$Customer.phone$': like },
      ];
    }
    const rows = await Rental.findAll({
      where,
      include: FULL,
      order: [['createdAt', 'DESC']],
    });
    res.json(rows.map(r => ({ ...r.toJSON(), ...svc.summarize(r) })));
  })
);

router.get(
  '/rentals/:id',
  h(async (req, res) => {
    const r = await loadFull(req.params.id);
    if (!r) fail('Rental not found', 404);
    res.json(r);
  })
);

router.post(
  '/rentals',
  h(async (req, res) => {
    const { customerId, assetIds, notes } = req.body || {};
    const start = new Date(req.body?.startDate || Date.now());
    const due = new Date(req.body?.dueDate);
    const ids = [...new Set((assetIds || []).map(Number))];
    if (!customerId || !ids.length)
      fail('Customer and at least one asset are required');
    if (isNaN(start) || isNaN(due) || due <= start)
      fail('Due date must be after the start date');

    const id = await sequelize.transaction(async t => {
      if (!(await Customer.findByPk(customerId, { transaction: t })))
        fail('Customer not found', 404);

      const assets = await Asset.findAll({
        where: { id: ids },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (assets.length !== ids.length)
        fail('One or more assets not found', 404);
      const bad = assets.filter(a =>
        ['maintenance', 'retired'].includes(a.status)
      );
      if (bad.length)
        fail(
          `Not rentable (${bad[0].status}): ${bad.map(a => a.serialNo).join(', ')}`,
          409
        );

      const blocked = await svc.blockedAssetIds(start, due, t);
      const clash = assets.filter(a => blocked.has(a.id));
      if (clash.length)
        fail(
          `Already booked for these dates: ${clash.map(a => a.serialNo).join(', ')}`,
          409
        );

      const products = await Product.findAll({
        where: { id: assets.map(a => a.productId) },
        transaction: t,
      });
      const pmap = Object.fromEntries(products.map(p => [p.id, p]));
      const days = svc.rentalDays(start, due);

      const lines = assets.map(a => {
        const p = pmap[a.productId];
        return {
          assetId: a.id,
          rate: p.dailyRate,
          weeklyRate: p.weeklyRate,
          deposit: p.securityDeposit,
          amount: svc.itemRent(p.dailyRate, p.weeklyRate, days),
        };
      });

      const rental = await Rental.create(
        {
          customerId,
          staffId: req.user.id,
          startDate: start,
          dueDate: due,
          notes,
          status: 'reserved',
          rentTotal: svc.r2(lines.reduce((s, l) => s + l.amount, 0)),
          depositTotal: svc.r2(
            lines.reduce((s, l) => s + Number(l.deposit), 0)
          ),
        },
        { transaction: t }
      );
      await rental.update(
        { code: `RN-${String(rental.id).padStart(5, '0')}` },
        { transaction: t }
      );
      await RentalItem.bulkCreate(
        lines.map(l => ({ ...l, rentalId: rental.id })),
        { transaction: t }
      );
      return rental.id;
    });
    res.status(201).json(await loadFull(id));
  })
);

router.post(
  '/rentals/:id/payments',
  h(async (req, res) => {
    const { type, method = 'cash' } = req.body || {};
    const amount = svc.r2(req.body?.amount);
    if (!['deposit', 'dues'].includes(type))
      fail("type must be 'deposit' or 'dues'");
    if (!METHODS.includes(method)) fail('Invalid payment method');
    if (!(amount > 0)) fail('Amount must be greater than 0');

    await sequelize.transaction(async t => {
      const rental = await lockRental(req.params.id, t);
      if (rental.status === 'cancelled') fail('Rental is cancelled');
      const s = svc.summarize(rental);

      if (type === 'deposit') {
        if (!['reserved', 'dispatched'].includes(rental.status))
          fail('Deposit can only be taken before return');
        if (s.depositPaid + amount > svc.num(rental.depositTotal) + 0.005)
          fail(
            `Exceeds deposit required (${svc.num(rental.depositTotal) - s.depositPaid} left)`
          );
        await Payment.create(
          {
            rentalId: rental.id,
            customerId: rental.customerId,
            type: 'deposit',
            amount,
            method,
          },
          { transaction: t }
        );
      } else {
        if (amount > s.due + 0.005) fail(`Exceeds amount due (${s.due})`);
        for (const row of svc.allocate(s.buckets, amount))
          await Payment.create(
            {
              rentalId: rental.id,
              customerId: rental.customerId,
              method,
              ...row,
            },
            { transaction: t }
          );
        if (
          rental.status === 'returned' &&
          rental.depositSettled &&
          svc.r2(s.due - amount) <= 0.005
        )
          await rental.update({ status: 'closed' }, { transaction: t });
      }
    });
    res.status(201).json(await loadFull(req.params.id));
  })
);

router.post(
  '/rentals/:id/dispatch',
  h(async (req, res) => {
    await sequelize.transaction(async t => {
      const rental = await lockRental(req.params.id, t);
      if (rental.status !== 'reserved')
        fail(`Cannot dispatch a ${rental.status} rental`);
      if (
        svc.summarize(rental).depositPaid + 0.005 <
        svc.num(rental.depositTotal)
      )
        fail('Collect the full security deposit before dispatch');

      const items = await RentalItem.findAll({
        where: { rentalId: rental.id },
        transaction: t,
      });
      const assets = await Asset.findAll({
        where: { id: items.map(i => i.assetId) },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      const notReady = assets.filter(a => a.status !== 'available');
      if (notReady.length)
        fail(
          `Not available right now: ${notReady.map(a => `${a.serialNo} (${a.status})`).join(', ')}`,
          409
        );

      await Asset.update(
        { status: 'rented' },
        { where: { id: assets.map(a => a.id) }, transaction: t }
      );
      await rental.update(
        { status: 'dispatched', dispatchedAt: new Date() },
        { transaction: t }
      );
    });
    res.json(await loadFull(req.params.id));
  })
);

const resolveReturnedAt = req => {
  const raw = req.body?.returnedAt || req.query.returnedAt;
  if (!raw) return new Date();
  if (req.user.role !== 'admin')
    fail('Only an admin can set a custom return time', 403);
  const d = new Date(raw);
  if (isNaN(d)) fail('Invalid returnedAt');
  return d;
};

router.get(
  '/rentals/:id/return-preview',
  h(async (req, res) => {
    const r = await Rental.findByPk(req.params.id, {
      include: [RentalItem, Payment],
    });
    if (!r) fail('Rental not found', 404);
    const at = resolveReturnedAt(req);
    const dailySum = svc.r2(
      r.RentalItems.reduce((s, i) => s + svc.num(i.rate), 0)
    );
    res.json({
      returnedAt: at,
      dueDate: r.dueDate,
      ...svc.lateInfo(r.dueDate, at, dailySum),
    });
  })
);

router.post(
  '/rentals/:id/return',
  h(async (req, res) => {
    const returnedAt = resolveReturnedAt(req);
    const refundMethod = METHODS.includes(req.body?.refundMethod)
      ? req.body.refundMethod
      : 'cash';
    const inspections = req.body?.inspections || [];

    await sequelize.transaction(async t => {
      const rental = await Rental.findByPk(req.params.id, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!rental) fail('Rental not found', 404);
      if (rental.status !== 'dispatched')
        fail(`Cannot return a ${rental.status} rental`);

      const items = await RentalItem.findAll({
        where: { rentalId: rental.id },
        include: [Asset],
        transaction: t,
      });
      const byItem = Object.fromEntries(
        inspections.map(i => [Number(i.rentalItemId), i])
      );

      let damageTotal = 0;
      for (const it of items) {
        const insp = byItem[it.id] || {};
        const condition = ['good', 'fair', 'damaged'].includes(insp.condition)
          ? insp.condition
          : 'good';
        const charge = condition === 'damaged' ? svc.r2(insp.damageCharge) : 0;
        damageTotal += charge;
        await Inspection.create(
          {
            rentalItemId: it.id,
            condition,
            damageNotes: insp.damageNotes,
            damageCharge: charge,
          },
          { transaction: t }
        );
        await it.Asset.update(
          {
            condition,
            status: condition === 'damaged' ? 'maintenance' : 'available',
          },
          { transaction: t }
        );
        if (condition === 'damaged')
          await Maintenance.create(
            {
              assetId: it.assetId,
              issue: insp.damageNotes || `Damaged on return (${rental.code})`,
              status: 'open',
              startedAt: returnedAt,
            },
            { transaction: t }
          );
      }

      const dailySum = svc.r2(items.reduce((s, i) => s + svc.num(i.rate), 0));
      const { lateFee } = svc.lateInfo(rental.dueDate, returnedAt, dailySum);
      await rental.update(
        {
          returnedAt,
          lateFee,
          damageCharge: svc.r2(damageTotal),
          status: 'returned',
        },
        { transaction: t }
      );

      const payments = await Payment.findAll({
        where: { rentalId: rental.id },
        transaction: t,
      });
      const s = svc.summarize({
        ...rental.toJSON(),
        Payments: payments,
        RentalItems: items,
      });
      const owed = s.due;
      const held = svc.r2(s.depositPaid - s.depositRefunded);
      const deduction = Math.min(owed, held);
      for (const row of svc.allocate(s.buckets, deduction))
        await Payment.create(
          {
            rentalId: rental.id,
            customerId: rental.customerId,
            method: 'deposit',
            note: 'Adjusted from deposit',
            ...row,
          },
          { transaction: t }
        );
      const refund = svc.r2(held - deduction);
      if (refund > 0)
        await Payment.create(
          {
            rentalId: rental.id,
            customerId: rental.customerId,
            type: 'refund',
            amount: refund,
            method: refundMethod,
            note: 'Deposit refund',
          },
          { transaction: t }
        );

      await rental.update(
        {
          depositSettled: true,
          status: svc.r2(owed - deduction) <= 0.005 ? 'closed' : 'returned',
        },
        { transaction: t }
      );
    });
    res.json(await loadFull(req.params.id));
  })
);

router.post(
  '/rentals/:id/cancel',
  h(async (req, res) => {
    await sequelize.transaction(async t => {
      const rental = await lockRental(req.params.id, t);
      if (rental.status !== 'reserved')
        fail(
          'Only a reservation that has not been dispatched can be cancelled'
        );
      const s = svc.summarize(rental);
      const refund = svc.r2(s.depositPaid + s.paidDues - s.depositRefunded);
      if (refund > 0)
        await Payment.create(
          {
            rentalId: rental.id,
            customerId: rental.customerId,
            type: 'refund',
            amount: refund,
            method: METHODS.includes(req.body?.refundMethod)
              ? req.body.refundMethod
              : 'cash',
            note: 'Cancellation refund',
          },
          { transaction: t }
        );
      await rental.update({ status: 'cancelled' }, { transaction: t });
    });
    res.json(await loadFull(req.params.id));
  })
);

module.exports = router;
