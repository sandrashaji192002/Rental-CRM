export const normalizePhone = v => {
  const raw = String(v ?? '').trim();
  if (!/^[+\d\s()-]+$/.test(raw)) return null;
  let d = raw.replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : null;
};
export const phoneError = v =>
  normalizePhone(v)
    ? ''
    : 'Enter a valid 10-digit mobile number (starts with 6-9)';
export const required = label => v =>
  String(v ?? '').trim() ? '' : `${label} is required`;
export const positive = v =>
  Number(v) > 0 ? '' : 'Enter an amount greater than 0';
