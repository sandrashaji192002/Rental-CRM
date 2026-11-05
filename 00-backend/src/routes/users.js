const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { User } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');

const h = fn => (req, res, next) => fn(req, res).catch(next);
router.use(authenticate, authorize('admin'));

const safe = { attributes: { exclude: ['password'] } };

router.get(
  '/',
  h(async (req, res) => {
    res.json(await User.findAll({ ...safe, order: [['createdAt', 'DESC']] }));
  })
);

router.post(
  '/',
  h(async (req, res) => {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password)
      return res
        .status(400)
        .json({ message: 'Name, email and password required' });
    const u = await User.create({
      name,
      email,
      role: role === 'admin' ? 'admin' : 'staff',
      password: await bcrypt.hash(password, 10),
    });
    res
      .status(201)
      .json({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        active: u.active,
      });
  })
);

router.put(
  '/:id',
  h(async (req, res) => {
    const u = await User.findByPk(req.params.id);
    if (!u) return res.status(404).json({ message: 'User not found' });

    if (
      u.id === req.user.id &&
      (req.body.active === false ||
        (req.body.role && req.body.role !== 'admin'))
    )
      return res
        .status(400)
        .json({ message: 'You cannot disable or demote your own account' });

    const { name, role, active, password } = req.body;
    const patch = {};
    if (name !== undefined) patch.name = name;
    if (role !== undefined) patch.role = role;
    if (active !== undefined) patch.active = active;
    if (password) patch.password = await bcrypt.hash(password, 10);
    await u.update(patch);
    res.json({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      active: u.active,
    });
  })
);

module.exports = router;
