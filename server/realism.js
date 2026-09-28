// ============================================================
// أرجوس | محرك الواقعية التاريخية
// نقطة البداية: 1 يناير 1900
// ============================================================

const TECH_UNLOCKS = [
  { keyword: 'طائرة', year: 1903, label: 'الطائرة' },
  { keyword: 'دبابة', year: 1916, label: 'الدبابة القتالية' },
  { keyword: 'غاز سام', year: 1915, label: 'الحرب الكيميائية المنظمة' },
  { keyword: 'سلاح كيميائي', year: 1915, label: 'السلاح الكيميائي' },
  { keyword: 'صاروخ بالستي', year: 1944, label: 'الصاروخ البالستي' },
  { keyword: 'سلاح نووي', year: 1945, label: 'السلاح النووي' },
];

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function weaponAvailability(weapon, gameYear) {
  const year = Number(gameYear) || 1900;
  const name = String(weapon && weapon.name || '').trim().toLowerCase();

  for (const rule of TECH_UNLOCKS) {
    if (rule.keyword && name.includes(rule.keyword) && year < rule.year) {
      return {
        available: false,
        minYear: rule.year,
        label: rule.label,
        reason: `هذه التقنية لم تكن متاحة تاريخيًا في سنة ${year}. أصبحت متاحة ابتداءً من ${rule.year}.`,
      };
    }
  }
  return { available: true, minYear: null, label: null, reason: null };
}

function logisticsModifier(distanceKm, hasNavy) {
  const d = Number(distanceKm);
  if (!Number.isFinite(d) || d <= 500) return 1;

  let factor;
  if (d <= 1500) factor = 0.97;
  else if (d <= 3000) factor = 0.93;
  else if (d <= 5000) factor = 0.88;
  else if (d <= 8000) factor = 0.80;
  else factor = 0.72;

  if (d > 3000 && hasNavy) factor += 0.07;
  if (d > 6000 && hasNavy) factor += 0.05;
  return clamp(factor, 0.65, 1);
}

function readinessModifier(readiness) {
  const r = clamp(Number(readiness) || 0, 0, 100);
  return 0.70 + (r / 100) * 0.30;
}

module.exports = { TECH_UNLOCKS, weaponAvailability, logisticsModifier, readinessModifier };
