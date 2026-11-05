require('dotenv').config({ override: true });
const { Sequelize } = require('sequelize');

const env = process.env;
const useSsl = String(env.DB_SSL || '').toLowerCase() === 'true';

const sequelize = new Sequelize(
  env.DB_NAME || env.DATABASE,
  env.DB_USER || env.USER,
  env.DB_PASSWORD || env.PASSWORD,
  {
    host: env.DB_HOST || env.HOST,
    port: env.DB_PORT || (env.DB_HOST ? 3306 : env.PORT),
    dialect: env.DIALECT || 'mysql',
    logging: false,
    dialectOptions: useSsl ? { ssl: { rejectUnauthorized: false } } : {},
  }
);

module.exports = sequelize;
