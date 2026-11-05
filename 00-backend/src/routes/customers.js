const router = require('express').Router();
const { Op } = require('sequelize');
const {
  Customer,
  Rental,
  RentalItem,
  Asset,
  Product,
  Payment,
} = require('../models');
const { authenticate } = require('../middleware/auth');
const { normalizePhone, EMAIL_RE, PHONE_MSG } = require('../utils/validators');

const h = fn => (req, res, next) => fn(req, res).catch(next);
const fail = (msg, status = 400) => {
  const e = new Error(msg);
  e.status = status;
  throw e;
};
router.use(authenticate);

const clean = (b = {}) => {
  const d = {};
  for (const k of [
    'name',
    'phone',
    'email',
    'idProofType',
    'idProofNumber',
    'address',
  ])
    if (b[k] !== undefined)
      d[k] = typeof b[k] === 'string' ? b[k].trim() : b[k];

  if ('name' in d && !d.name) fail('Name is required');
  if ('phone' in d) {
    const p = normalizePhone(d.phone);
    if (!p) fail(PHONE_MSG);
    d.phone = p;
  }
  if ('email' in d) {
    if (!d.email) d.email = null;
    else if (!EMAIL_RE.test(d.email)) fail('Enter a valid email address');
  }
  return d;
};

router.get(
  '/',
  h(async (req, res) => {
    const where = {};
    if (req.query.q) {
      where[Op.or] = [
        { name: { [Op.like]: `%${req.query.q}%` } },
        { phone: { [Op.like]: `%${req.query.q}%` } },
      ];
    }
    res.json(
      await Customer.findAll({
        where,
        order: [['createdAt', 'DESC']],
        limit: 50,
      })
    );
  })
);

router.get(
  '/:id',
  h(async (req, res) => {
    const customer = await Customer.findByPk(req.params.id, {
      include: [
        {
          model: Rental,
          include: [
            {
              model: RentalItem,
              include: [{ model: Asset, include: [Product] }],
            },
            Payment,
          ],
        },
      ],
      order: [[Rental, 'createdAt', 'DESC']],
    });
    if (!customer)
      return res.status(404).json({ message: 'Customer not found' });

    const num = v => Number(v || 0);
    const PAID_TYPES = ['rent', 'late_fee', 'damage'];
    let pendingDues = 0;

    const rentals = customer.Rentals.map(r => {
      const j = r.toJSON();
      const charged = num(j.rentTotal) + num(j.lateFee) + num(j.damageCharge);
      const paid = j.Payments.filter(p => PAID_TYPES.includes(p.type)).reduce(
        (s, p) => s + num(p.amount),
        0
      );
      j.due = j.status === 'cancelled' ? 0 : Math.max(0, charged - paid);
      pendingDues += j.due;
      return j;
    });

    const base = customer.toJSON();
    delete base.Rentals;
    res.json({ ...base, rentals, pendingDues });
  })
);

router.post(
  '/',
  h(async (req, res) => {
    const data = clean(req.body);
    if (!data.name || !data.phone) fail('Name and phone are required');
    res.status(201).json(await Customer.create(data));
  })
);

router.put(
  '/:id',
  h(async (req, res) => {
    const c = await Customer.findByPk(req.params.id);
    if (!c) return res.status(404).json({ message: 'Customer not found' });
    res.json(await c.update(clean(req.body)));
  })
);

module.exports = router;
