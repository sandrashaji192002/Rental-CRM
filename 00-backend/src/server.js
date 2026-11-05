require('dotenv').config();
const app = require('./app');
const { sequelize, User } = require('./models');

const PORT = process.env.APP_PORT || process.env.PORT || 5000;

(async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync();
    if (process.env.AUTO_SEED === 'true' && (await User.count()) === 0) {
      await require('./seed')({ force: false });
    }
    app.listen(PORT, () =>
      console.log(`API running on http://localhost:${PORT}`)
    );
  } catch (e) {
    console.error('Error:', e.message || e.code || e.name);
    if (e.errors)
      e.errors.forEach(x => console.error(' -', x.code, x.address, x.port));
    console.error('DB target:', process.env.DB_HOST, process.env.DB_PORT);
    process.exit(1);
  }
})();
