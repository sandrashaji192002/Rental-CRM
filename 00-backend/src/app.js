const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api', require('./routes/catalog'));
app.use('/api', require('./routes/rentals'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/users', require('./routes/users'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/maintenance', require('./routes/maintenance'));
app.use('/api/reports', require('./routes/reports'));

app.use('/api', (req, res) => res.status(404).json({ message: 'Not found' }));

const dist = path.join(__dirname, '../../00-frontend/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.use((req, res, next) =>
    req.method === 'GET' ? res.sendFile(path.join(dist, 'index.html')) : next()
  );
}

app.use((err, req, res, next) => {
  if (err.name === 'SequelizeUniqueConstraintError') {
    const raw =
      err.errors?.[0]?.path ||
      (Array.isArray(err.fields)
        ? err.fields[0]
        : Object.keys(err.fields || {})[0]) ||
      'value';
    const field = String(raw)
      .split('.')
      .pop()
      .replace(/^.*_(?=(phone|email|serialNo)$)/, '');
    const label =
      {
        phone: 'A customer with this phone number',
        email: 'This email',
        serialNo: 'This serial number',
      }[field] || `This ${field}`;
    return res.status(409).json({ message: `${label} already exists` });
  }
  if (!err.status) console.error(err);
  const status = err.name?.startsWith('Sequelize') ? 400 : err.status || 500;
  const message = err.errors?.[0]?.message || err.message || 'Server error';
  res.status(status).json({ message });
});

module.exports = app;
