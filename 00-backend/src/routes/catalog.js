const router = require('express').Router();
const { Op } = require('sequelize');
const { Category, Product, Asset, RentalItem } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');

const h = fn => (req, res, next) => fn(req, res).catch(next);
const adminOnly = authorize('admin');

router.use(authenticate);

router.get(
  '/categories',
  h(async (req, res) => {
    res.json(await Category.findAll({ order: [['name', 'ASC']] }));
  })
);
router.post(
  '/categories',
  adminOnly,
  h(async (req, res) => {
    res.status(201).json(await Category.create({ name: req.body.name }));
  })
);
router.put(
  '/categories/:id',
  adminOnly,
  h(async (req, res) => {
    const c = await Category.findByPk(req.params.id);
    if (!c) return res.status(404).json({ message: 'Category not found' });
    res.json(await c.update({ name: req.body.name }));
  })
);
router.delete(
  '/categories/:id',
  adminOnly,
  h(async (req, res) => {
    if (await Product.count({ where: { categoryId: req.params.id } }))
      return res
        .status(400)
        .json({ message: 'Category has products; move or remove them first' });
    await Category.destroy({ where: { id: req.params.id } });
    res.json({ ok: true });
  })
);

router.get(
  '/products',
  h(async (req, res) => {
    const where = {};
    if (req.query.q) where.name = { [Op.like]: `%${req.query.q}%` };
    if (req.query.categoryId) where.categoryId = req.query.categoryId;
    if (req.query.active !== 'all') where.active = true;

    const products = await Product.findAll({
      where,
      include: [Category, { model: Asset, attributes: ['id', 'status'] }],
      order: [['name', 'ASC']],
    });

    res.json(
      products.map(p => {
        const j = p.toJSON();
        j.totalAssets = j.Assets.length;
        j.availableAssets = j.Assets.filter(
          a => a.status === 'available'
        ).length;
        delete j.Assets;
        return j;
      })
    );
  })
);
router.post(
  '/products',
  adminOnly,
  h(async (req, res) => {
    res.status(201).json(await Product.create(req.body));
  })
);
router.put(
  '/products/:id',
  adminOnly,
  h(async (req, res) => {
    const p = await Product.findByPk(req.params.id);
    if (!p) return res.status(404).json({ message: 'Product not found' });
    res.json(await p.update(req.body));
  })
);

router.delete(
  '/products/:id',
  adminOnly,
  h(async (req, res) => {
    await Product.update({ active: false }, { where: { id: req.params.id } });
    res.json({ ok: true });
  })
);

router.get(
  '/assets',
  h(async (req, res) => {
    const where = {};
    if (req.query.productId) where.productId = req.query.productId;
    if (req.query.status) where.status = req.query.status;
    if (req.query.q) where.serialNo = { [Op.like]: `%${req.query.q}%` };

    res.json(
      await Asset.findAll({
        where,
        include: [{ model: Product, include: [Category] }],
        order: [['serialNo', 'ASC']],
      })
    );
  })
);
router.post(
  '/assets',
  adminOnly,
  h(async (req, res) => {
    res.status(201).json(await Asset.create(req.body));
  })
);
router.put(
  '/assets/:id',
  adminOnly,
  h(async (req, res) => {
    const a = await Asset.findByPk(req.params.id);
    if (!a) return res.status(404).json({ message: 'Asset not found' });
    if (
      a.status === 'rented' &&
      req.body.status &&
      req.body.status !== 'rented'
    )
      return res
        .status(400)
        .json({ message: 'Asset is out on rent; process the return instead' });
    res.json(await a.update(req.body));
  })
);
router.delete(
  '/assets/:id',
  adminOnly,
  h(async (req, res) => {
    const a = await Asset.findByPk(req.params.id);
    if (!a) return res.status(404).json({ message: 'Asset not found' });
    if (a.status === 'rented')
      return res.status(400).json({ message: 'Asset is currently rented' });

    if (await RentalItem.count({ where: { assetId: a.id } })) {
      await a.update({ status: 'retired' });
      return res.json({ ok: true, retired: true });
    }
    await a.destroy();
    res.json({ ok: true });
  })
);

module.exports = router;
