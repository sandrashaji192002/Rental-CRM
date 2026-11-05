const { Op } = require('sequelize');
const { Rental, RentalItem } = require('../models');

const DAY = 24 * 60 * 60 * 1000;
const GRACE_MS = 60 * 60 * 1000;
const LATE_MULTIPLIER = 1.5;

const num = v => Number(v || 0);
const r2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const sumBy = (pays, types) =>
  pays
    .filter(p => types.includes(p.type))
    .reduce((s, p) => s + num(p.amount), 0);

const rentalDays = (start, due) =>
  Math.max(1, Math.ceil((new Date(due) - new Date(start)) / DAY));

const itemRent = (daily, weekly, days) => {
  daily = num(daily);
  weekly = num(weekly);
  if (weekly > 0)
    return r2(
      Math.floor(days / 7) * weekly + Math.min((days % 7) * daily, weekly)
    );
  return r2(days * daily);
};

const lateInfo = (dueDate, returnedAt, dailySum) => {
  const lateMs = new Date(returnedAt) - new Date(dueDate);
  if (lateMs <= GRACE_MS) return { lateDays: 0, lateFee: 0 };
  const lateDays = Math.ceil(lateMs / DAY);
  return { lateDays, lateFee: r2(lateDays * num(dailySum) * LATE_MULTIPLIER) };
};

const outstandingBuckets = r => {
  const pays = r.Payments || [];
  const out = (charged, type) =>
    Math.max(0, r2(num(charged) - sumBy(pays, [type])));
  return {
    rent: out(r.rentTotal, 'rent'),
    late_fee: out(r.lateFee, 'late_fee'),
    damage: out(r.damageCharge, 'damage'),
  };
};

const allocate = (buckets, amount) => {
  let left = r2(amount);
  const rows = [];
  for (const type of ['rent', 'late_fee', 'damage']) {
    const take = Math.min(left, buckets[type]);
    if (take > 0) {
      rows.push({ type, amount: r2(take) });
      left = r2(left - take);
    }
  }
  return rows;
};

const summarize = r => {
  const pays = r.Payments || [];
  const items = r.RentalItems || [];
  const buckets = outstandingBuckets(r);
  const due =
    r.status === 'cancelled'
      ? 0
      : r2(buckets.rent + buckets.late_fee + buckets.damage);
  const overdue = r.status === 'dispatched' && new Date(r.dueDate) < new Date();
  const dailySum = r2(items.reduce((s, i) => s + num(i.rate), 0));
  const live = overdue
    ? lateInfo(r.dueDate, new Date(), dailySum)
    : { lateDays: 0, lateFee: 0 };
  return {
    due,
    buckets,
    overdue,
    depositPaid: r2(sumBy(pays, ['deposit'])),
    depositRefunded: r2(sumBy(pays, ['refund'])),
    paidDues: r2(sumBy(pays, ['rent', 'late_fee', 'damage'])),
    liveLateDays: live.lateDays,
    liveLateFee: live.lateFee,
  };
};

const blockedAssetIds = async (start, end, transaction, excludeRentalId) => {
  const items = await RentalItem.findAll({
    include: [
      {
        model: Rental,
        required: true,
        where: {
          status: { [Op.in]: ['reserved', 'dispatched'] },
          startDate: { [Op.lt]: end },
        },
      },
    ],
    transaction,
  });
  const now = new Date();
  const blocked = new Set();
  for (const it of items) {
    const r = it.Rental;
    if (excludeRentalId && r.id === Number(excludeRentalId)) continue;
    const effEnd =
      r.status === 'dispatched' && new Date(r.dueDate) < now
        ? Infinity
        : new Date(r.dueDate);
    if (new Date(r.startDate) < end && effEnd > start) blocked.add(it.assetId);
  }
  return blocked;
};

module.exports = {
  DAY,
  num,
  r2,
  rentalDays,
  itemRent,
  lateInfo,
  outstandingBuckets,
  allocate,
  summarize,
  blockedAssetIds,
};
