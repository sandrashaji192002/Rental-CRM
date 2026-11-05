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
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
