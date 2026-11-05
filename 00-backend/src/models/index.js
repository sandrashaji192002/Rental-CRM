const { DataTypes: T } = require('sequelize');
const sequelize = require('../config/db');

const money = () => ({
  type: T.DECIMAL(10, 2),
  allowNull: false,
  defaultValue: 0,
});

const User = sequelize.define('User', {
  name: { type: T.STRING, allowNull: false },
  email: { type: T.STRING, allowNull: false, unique: true },
  password: { type: T.STRING, allowNull: false },
  role: { type: T.ENUM('admin', 'staff'), defaultValue: 'staff' },
  active: { type: T.BOOLEAN, defaultValue: true },
});

const Customer = sequelize.define('Customer', {
  name: { type: T.STRING, allowNull: false },
  phone: { type: T.STRING, allowNull: false, unique: true },
  email: T.STRING,
  idProofType: T.STRING,
  idProofNumber: T.STRING,
  address: T.TEXT,
});

const Category = sequelize.define('Category', {
  name: { type: T.STRING, allowNull: false, unique: true },
});

const Product = sequelize.define('Product', {
  name: { type: T.STRING, allowNull: false },
  description: T.TEXT,
  dailyRate: money(),
  weeklyRate: money(),
  securityDeposit: money(),
  active: { type: T.BOOLEAN, defaultValue: true },
});

const Asset = sequelize.define('Asset', {
  serialNo: { type: T.STRING, allowNull: false, unique: true },
  status: {
    type: T.ENUM('available', 'rented', 'maintenance', 'retired'),
    defaultValue: 'available',
  },
  condition: { type: T.ENUM('good', 'fair', 'damaged'), defaultValue: 'good' },
  purchaseDate: T.DATEONLY,
  purchaseCost: money(),
});

const Rental = sequelize.define('Rental', {
  code: { type: T.STRING, unique: true },
  startDate: { type: T.DATE, allowNull: false },
  dueDate: { type: T.DATE, allowNull: false },
  dispatchedAt: T.DATE,
  returnedAt: T.DATE,
  status: {
    type: T.ENUM('reserved', 'dispatched', 'returned', 'closed', 'cancelled'),
    defaultValue: 'reserved',
  },
  rentTotal: money(),
  depositTotal: money(),
  lateFee: money(),
  damageCharge: money(),
  depositSettled: { type: T.BOOLEAN, defaultValue: false },
  notes: T.TEXT,
});

const RentalItem = sequelize.define('RentalItem', {
  rate: money(),
  weeklyRate: money(),
  deposit: money(),
  amount: money(),
});

const Payment = sequelize.define('Payment', {
  type: {
    type: T.ENUM('rent', 'deposit', 'refund', 'late_fee', 'damage'),
    allowNull: false,
  },
  amount: money(),
  method: {
    type: T.ENUM('cash', 'card', 'upi', 'deposit'),
    defaultValue: 'cash',
  },
  note: T.STRING,
});

const Inspection = sequelize.define('Inspection', {
  condition: { type: T.ENUM('good', 'fair', 'damaged'), defaultValue: 'good' },
  damageNotes: T.TEXT,
  damageCharge: money(),
});

const Supplier = sequelize.define('Supplier', {
  name: { type: T.STRING, allowNull: false },
  contactPerson: T.STRING,
  phone: T.STRING,
  email: T.STRING,
});

const Maintenance = sequelize.define('Maintenance', {
  issue: { type: T.TEXT, allowNull: false },
  cost: money(),
  status: { type: T.ENUM('open', 'in_progress', 'done'), defaultValue: 'open' },
  startedAt: T.DATE,
  completedAt: T.DATE,
});

Category.hasMany(Product, { foreignKey: 'categoryId' });
Product.belongsTo(Category, { foreignKey: 'categoryId' });

Product.hasMany(Asset, { foreignKey: 'productId' });
Asset.belongsTo(Product, { foreignKey: 'productId' });

Customer.hasMany(Rental, { foreignKey: 'customerId' });
Rental.belongsTo(Customer, { foreignKey: 'customerId' });

User.hasMany(Rental, { foreignKey: 'staffId' });
Rental.belongsTo(User, { as: 'staff', foreignKey: 'staffId' });

Rental.hasMany(RentalItem, { foreignKey: 'rentalId' });
RentalItem.belongsTo(Rental, { foreignKey: 'rentalId' });

Asset.hasMany(RentalItem, { foreignKey: 'assetId' });
RentalItem.belongsTo(Asset, { foreignKey: 'assetId' });

Rental.hasMany(Payment, { foreignKey: 'rentalId' });
Payment.belongsTo(Rental, { foreignKey: 'rentalId' });
Customer.hasMany(Payment, { foreignKey: 'customerId' });
Payment.belongsTo(Customer, { foreignKey: 'customerId' });

RentalItem.hasOne(Inspection, { foreignKey: 'rentalItemId' });
Inspection.belongsTo(RentalItem, { foreignKey: 'rentalItemId' });

Asset.hasMany(Maintenance, { foreignKey: 'assetId' });
Maintenance.belongsTo(Asset, { foreignKey: 'assetId' });
Supplier.hasMany(Maintenance, { foreignKey: 'supplierId' });
Maintenance.belongsTo(Supplier, { foreignKey: 'supplierId' });

module.exports = {
  sequelize,
  User,
  Customer,
  Category,
  Product,
  Asset,
  Rental,
  RentalItem,
  Payment,
  Inspection,
  Supplier,
  Maintenance,
};
