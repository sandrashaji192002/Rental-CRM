require('dotenv').config();
const bcrypt = require('bcryptjs');
const M = require('./models');

async function seed({ force = true } = {}) {
  await M.sequelize.sync({ force });
  const hash = p => bcrypt.hash(p, 10);

  await M.User.bulkCreate([
    {
      name: 'Admin User',
      email: 'admin@demo.com',
      password: await hash('Admin@123'),
      role: 'admin',
    },
    {
      name: 'Front Desk Staff',
      email: 'staff@demo.com',
      password: await hash('Staff@123'),
      role: 'staff',
    },
  ]);

  const cats = await M.Category.bulkCreate([
    { name: 'Power Tools' },
    { name: 'Construction Equipment' },
    { name: 'Garden Equipment' },
  ]);

  const products = await M.Product.bulkCreate([
    {
      name: 'Bosch Hammer Drill',
      categoryId: cats[0].id,
      dailyRate: 500,
      weeklyRate: 2800,
      securityDeposit: 3000,
    },
    {
      name: 'Angle Grinder',
      categoryId: cats[0].id,
      dailyRate: 300,
      weeklyRate: 1700,
      securityDeposit: 2000,
    },
    {
      name: 'Concrete Mixer',
      categoryId: cats[1].id,
      dailyRate: 1500,
      weeklyRate: 8500,
      securityDeposit: 10000,
    },
    {
      name: 'Scaffolding Set',
      categoryId: cats[1].id,
      dailyRate: 800,
      weeklyRate: 4500,
      securityDeposit: 6000,
    },
    {
      name: 'Lawn Mower',
      categoryId: cats[2].id,
      dailyRate: 600,
      weeklyRate: 3400,
      securityDeposit: 4000,
    },
  ]);

  const prefixes = ['BHD', 'AGR', 'CMX', 'SCF', 'LMW'];
  const assets = [];
  products.forEach((p, i) => {
    for (let n = 1; n <= 3; n++)
      assets.push({
        productId: p.id,
        serialNo: `${prefixes[i]}-${String(n).padStart(3, '0')}`,
        purchaseCost: p.securityDeposit * 2,
      });
  });
  await M.Asset.bulkCreate(assets);

  await M.Customer.bulkCreate([
    {
      name: 'Ravi Kumar',
      phone: '9876543210',
      email: 'ravi@example.com',
      idProofType: 'Aadhaar',
      idProofNumber: 'XXXX-1111',
      address: 'T. Nagar, Chennai',
    },
    {
      name: 'Priya Sharma',
      phone: '9876500001',
      email: 'priya@example.com',
      idProofType: 'Driving License',
      idProofNumber: 'TN-2020-555',
      address: 'Adyar, Chennai',
    },
  ]);

  console.log(
    'Seeded. Login: admin@demo.com / Admin@123, staff@demo.com / Staff@123'
  );
}

module.exports = seed;

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch(e => {
      console.error(e);
      process.exit(1);
    });
}
