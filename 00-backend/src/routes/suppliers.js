const router = require('express').Router();
const { Supplier, Maintenance } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { normalizePhone, EMAIL_RE, PHONE_MSG } = require('../utils/validators');

const h = fn => (req, res, next) => fn(req, res).catch(next);
const fail = (msg, status = 400) => {
  const e = new Error(msg);
  e.status = status;
  throw e;
};
router.use(authenticate, authorize('admin'));

const clean = (b = {}) => {
  const d = {};
  for (const k of ['name', 'contactPerson', 'phone', 'email'])
    if (b[k] !== undefined)
      d[k] = typeof b[k] === 'string' ? b[k].trim() : b[k];
  if ('name' in d && !d.name) fail('Supplier name is required');
  if (d.phone) {
    const p = normalizePhone(d.phone);
    if (!p) fail(PHONE_MSG);
    d.phone = p;
  } else if ('phone' in d) d.phone = null;
  if (d.email) {
    if (!EMAIL_RE.test(d.email)) fail('Enter a valid email address');
  } else if ('email' in d) d.email = null;
  return d;
};

router.get(
  '/',
  h(async (req, res) => {
    const rows = await Supplier.findAll({
      order: [['name', 'ASC']],
      include: [{ model: Maintenance, attributes: ['id', 'status', 'cost'] }],
    });
    res.json(
      rows.map(s => {
        const j = s.toJSON();
        j.tickets = j.Maintenances.length;
        j.totalCost = j.Maintenances.reduce(
          (sum, m) => sum + Number(m.cost),
          0
        );
        delete j.Maintenances;
        return j;
      })
    );
  })
);

router.post(
  '/',
  h(async (req, res) => {
    const d = clean(req.body);
    if (!d.name) fail('Supplier name is required');
    res.status(201).json(await Supplier.create(d));
  })
);

router.put(
  '/:id',
  h(async (req, res) => {
    const s = await Supplier.findByPk(req.params.id);
    if (!s) fail('Supplier not found', 404);
    res.json(await s.update(clean(req.body)));
  })
);

router.delete(
  '/:id',
  h(async (req, res) => {
    if (await Maintenance.count({ where: { supplierId: req.params.id } }))
      fail('Supplier has maintenance history and cannot be deleted');
    await Supplier.destroy({ where: { id: req.params.id } });
    res.json({ ok: true });
  })
);

module.exports = router;
