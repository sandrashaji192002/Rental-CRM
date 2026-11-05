const router = require('express').Router();
const { Op } = require('sequelize');
const {
  sequelize,
  Maintenance,
  Asset,
  Product,
  Supplier,
} = require('../models');
const { authenticate, authorize } = require('../middleware/auth');

const h = fn => (req, res, next) => fn(req, res).catch(next);
const fail = (msg, status = 400) => {
  const e = new Error(msg);
  e.status = status;
  throw e;
};
router.use(authenticate, authorize('admin'));

const INCLUDE = [{ model: Asset, include: [Product] }, Supplier];
const cost = v => {
  const n = Number(v ?? 0);
  if (!(n >= 0)) fail('Cost must be 0 or more');
  return Math.round(n * 100) / 100;
};

router.get(
  '/',
  h(async (req, res) => {
    const where = req.query.status ? { status: req.query.status } : {};
    res.json(
      await Maintenance.findAll({
        where,
        include: INCLUDE,
        order: [['createdAt', 'DESC']],
      })
    );
  })
);

router.post(
  '/',
  h(async (req, res) => {
    const { assetId, supplierId, issue } = req.body || {};
    if (!assetId || !String(issue || '').trim())
      fail('Asset and issue description are required');
    const id = await sequelize.transaction(async t => {
      const asset = await Asset.findByPk(assetId, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!asset) fail('Asset not found', 404);
      if (asset.status === 'rented')
        fail(
          'Asset is out on rent; it can go to maintenance after it is returned',
          409
        );
      if (asset.status === 'retired') fail('Asset is retired');
      if (
        supplierId &&
        !(await Supplier.findByPk(supplierId, { transaction: t }))
      )
        fail('Supplier not found', 404);
      const m = await Maintenance.create(
        {
          assetId,
          supplierId: supplierId || null,
          issue: issue.trim(),
          cost: cost(req.body.cost),
          status: 'open',
          startedAt: new Date(),
        },
        { transaction: t }
      );
      await asset.update({ status: 'maintenance' }, { transaction: t }); // takes it out of availability immediately
      return m.id;
    });
    res.status(201).json(await Maintenance.findByPk(id, { include: INCLUDE }));
  })
);

const ORDER = { open: 0, in_progress: 1, done: 2 };
router.put(
  '/:id',
  h(async (req, res) => {
    const b = req.body || {};
    await sequelize.transaction(async t => {
      const m = await Maintenance.findByPk(req.params.id, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!m) fail('Ticket not found', 404);
      if (m.status === 'done') fail('This ticket is already completed');

      const patch = {};
      if (b.issue !== undefined) {
        if (!String(b.issue).trim()) fail('Issue cannot be empty');
        patch.issue = b.issue.trim();
      }
      if (b.cost !== undefined) patch.cost = cost(b.cost);
      if (b.supplierId !== undefined) {
        if (
          b.supplierId &&
          !(await Supplier.findByPk(b.supplierId, { transaction: t }))
        )
          fail('Supplier not found', 404);
        patch.supplierId = b.supplierId || null;
      }

      if (b.status !== undefined) {
        if (!(b.status in ORDER)) fail('Invalid status');
        if (ORDER[b.status] < ORDER[m.status])
          fail('A ticket cannot move backwards');
        patch.status = b.status;
        if (b.status === 'in_progress' && !m.startedAt)
          patch.startedAt = new Date();
        if (b.status === 'done') {
          patch.completedAt = new Date();
          const asset = await Asset.findByPk(m.assetId, {
            transaction: t,
            lock: t.LOCK.UPDATE,
          });
          if (b.outcome === 'retire') {
            await asset.update({ status: 'retired' }, { transaction: t });
          } else {
            const others = await Maintenance.count({
              where: {
                assetId: m.assetId,
                id: { [Op.ne]: m.id },
                status: { [Op.ne]: 'done' },
              },
              transaction: t,
            });
            if (others === 0 && asset.status === 'maintenance')
              await asset.update(
                { status: 'available', condition: 'good' },
                { transaction: t }
              );
          }
        }
      }
      await m.update(patch, { transaction: t });
    });
    res.json(await Maintenance.findByPk(req.params.id, { include: INCLUDE }));
  })
);

module.exports = router;
