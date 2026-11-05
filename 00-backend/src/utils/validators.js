const PHONE_MSG = 'Enter a valid 10-digit mobile number';

const normalizePhone = v => {
  const raw = String(v ?? '').trim();
  if (!/^[+\d\s()-]+$/.test(raw)) return null;
  let d = raw.replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

module.exports = { normalizePhone, EMAIL_RE, PHONE_MSG };
