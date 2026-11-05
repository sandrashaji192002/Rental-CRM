const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { authenticate } = require('../middleware/auth');

const publicUser = u => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password)
      return res.status(400).json({ message: 'Email and password required' });

    const user = await User.findOne({ where: { email } });
    if (
      !user ||
      !(await bcrypt.compare(password, user.password)) ||
      !user.active
    )
      return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || '8h',
      }
    );
    res.json({ token, user: publicUser(user) });
  } catch (e) {
    next(e);
  }
});

router.get('/me', authenticate, (req, res) =>
  res.json({ user: publicUser(req.user) })
);

module.exports = router;
