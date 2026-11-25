export interface TriCalendarDate {
  gregorian: {
    year: number;
    month: number;
    day: number;
    iso: string;
    formattedEn: string;
    formattedBn: string;
    weekdayEn: string;
    weekdayBn: string;
  };
  bangla: {
    year: number;
    monthIndex: number;
    day: number;
    monthNameBn: string;
    monthNameEn: string;
    seasonBn: string;
    seasonEn: string;
    formattedBn: string;
    formattedEn: string;
  };
  hijri: {
    year: number;
    monthIndex: number;
    day: number;
    monthNameEn: string;
    monthNameBn: string;
    monthNameAr: string;
    formattedEn: string;
    formattedBn: string;
    isEstimated: true;
  };
}

const BENGALI_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export function toBengaliNumerals(input: number | string): string {
  return String(input).replace(/\d/g, (d) => BENGALI_DIGITS[Number(d)] ?? d);
}

const GREGORIAN_MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const GREGORIAN_MONTHS_BN = [
  'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
  'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর',
];

const WEEKDAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAYS_BN = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];

const BANGLA_MONTHS = [
  { bn: 'বৈশাখ', en: 'Boishakh', seasonBn: 'গ্রীষ্ম', seasonEn: 'Summer' },
  { bn: 'জ্যৈষ্ঠ', en: 'Joishtho', seasonBn: 'গ্রীষ্ম', seasonEn: 'Summer' },
  { bn: 'আষাঢ়', en: 'Asharh', seasonBn: 'বর্ষা', seasonEn: 'Monsoon' },
  { bn: 'শ্রাবণ', en: 'Srabon', seasonBn: 'বর্ষা', seasonEn: 'Monsoon' },
  { bn: 'ভাদ্র', en: 'Bhadro', seasonBn: 'শরৎ', seasonEn: 'Autumn' },
  { bn: 'আশ্বিন', en: 'Ashwin', seasonBn: 'শরৎ', seasonEn: 'Autumn' },
  { bn: 'কার্তিক', en: 'Kartik', seasonBn: 'হেমন্ত', seasonEn: 'Late Autumn' },
  { bn: 'অগ্রহায়ণ', en: 'Ogrohayon', seasonBn: 'হেমন্ত', seasonEn: 'Late Autumn' },
  { bn: 'পৌষ', en: 'Poush', seasonBn: 'শীত', seasonEn: 'Winter' },
  { bn: 'মাঘ', en: 'Magh', seasonBn: 'শীত', seasonEn: 'Winter' },
  { bn: 'ফাল্গুন', en: 'Falgun', seasonBn: 'বসন্ত', seasonEn: 'Spring' },
  { bn: 'চৈত্র', en: 'Choitro', seasonBn: 'বসন্ত', seasonEn: 'Spring' },
];

const HIJRI_MONTHS = [
  { en: 'Muharram', bn: 'মহররম', ar: 'محرم' },
  { en: 'Safar', bn: 'সফর', ar: 'صفر' },
  { en: "Rabi' al-Awwal", bn: 'রবিউল আউয়াল', ar: 'ربيع الأول' },
  { en: "Rabi' al-Thani", bn: 'রবিউস সানি', ar: 'ربيع الثاني' },
  { en: 'Jumada al-Ula', bn: 'জমাদিউল আউয়াল', ar: 'جمادى الأولى' },
  { en: 'Jumada al-Akhirah', bn: 'জমাদিউস সানি', ar: 'جمادى الآخرة' },
  { en: 'Rajab', bn: 'রজব', ar: 'رجب' },
  { en: "Sha'ban", bn: 'শাবান', ar: 'شعبان' },
  { en: 'Ramadan', bn: 'রমজান', ar: 'رمضان' },
  { en: 'Shawwal', bn: 'শাওয়াল', ar: 'شوال' },
  { en: "Dhu al-Qi'dah", bn: 'জিলকদ', ar: 'ذو القعدة' },
  { en: 'Dhu al-Hijjah', bn: 'জিলহজ', ar: 'ذو الحجة' },
];

function isGregorianLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Converts a Gregorian date to Revised Bangla Calendar (Bangla Academy 2019 reform)
 * or Traditional Bangla Calendar.
 */
function getBanglaDate(date: Date, variant: 'revised' | 'traditional' = 'revised') {
  const gy = date.getFullYear();
  const gm = date.getMonth() + 1;
  const gd = date.getDate();

  // Boishakh 1 starts on April 14 in revised calendar (April 14/15 in traditional)
  const startMonth = 4;
  const startDay = variant === 'revised' ? 14 : 15;

  const currentUTC = Date.UTC(gy, gm - 1, gd);
  let banglaNewYearUTC = Date.UTC(gy, startMonth - 1, startDay);
  let banglaYear = gy - 593;

  if (currentUTC < banglaNewYearUTC) {
    banglaYear = gy - 594;
    banglaNewYearUTC = Date.UTC(gy - 1, startMonth - 1, startDay);
  }

  const diffDays = Math.floor((currentUTC - banglaNewYearUTC) / 86400000);
  const gregorianLeapNext = isGregorianLeapYear(banglaYear + 594);

  // Revised Bangla Academy month lengths:
  // First 6 months = 31 days (Boishakh..Ashwin), next 5 = 30 days (Kartik..Phalgun, Phalgun=31 in leap), Choitro=30
  const monthLengths =
    variant === 'revised'
      ? [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, gregorianLeapNext ? 31 : 30, 30]
      : [31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 30, gregorianLeapNext ? 31 : 30];

  let remaining = diffDays;
  let monthIndex = 0;
  while (monthIndex < 11 && remaining >= monthLengths[monthIndex]) {
    remaining -= monthLengths[monthIndex];
    monthIndex++;
  }

  const day = remaining + 1;
  const m = BANGLA_MONTHS[monthIndex];

  return {
    year: banglaYear,
    monthIndex,
    day,
    monthNameBn: m.bn,
    monthNameEn: m.en,
    seasonBn: m.seasonBn,
    seasonEn: m.seasonEn,
    formattedBn: `${toBengaliNumerals(day)} ${m.bn}, ${toBengaliNumerals(banglaYear)} বঙ্গাব্দ`,
    formattedEn: `${day} ${m.en}, ${banglaYear} BS`,
  };
}

/**
 * Kuwaiti / Tabular Islamic Hijri astronomical algorithm with optional day offset.
 * Marked explicitly as estimated because actual Islamic dates depend on local moon sighting.
 */
function getHijriDate(date: Date, offsetDays = 0) {
  const shifted = new Date(date.getTime() + offsetDays * 86400000);
  let day = shifted.getDate();
  let month = shifted.getMonth();
  let year = shifted.getFullYear();

  let m = month + 1;
  let y = year;
  if (m < 3) {
    y -= 1;
    m += 12;
  }

  let a = Math.floor(y / 100);
  let b = 2 - a + Math.floor(a / 4);
  if (y < 1583) b = 0;
  if (y === 1582) {
    if (m > 10) b = -10;
    if (m === 10) {
      b = 0;
      if (day > 4) b = -10;
    }
  }

  const jd =
    Math.floor(365.25 * (y + 4716)) +
    Math.floor(30.6001 * (m + 1)) +
    day +
    b -
    1524;

  b = 0;
  if (jd > 2299160) {
    a = Math.floor((jd - 1867216.25) / 36524.25);
    b = 1 + a - Math.floor(a / 4);
  }
  const bb = jd + b + 1524;
  let cc = Math.floor((bb - 122.1) / 365.25);
  const dd = Math.floor(365.25 * cc);
  const ee = Math.floor((bb - dd) / 30.6001);
  day = bb - dd - Math.floor(30.6001 * ee);
  month = ee - 1;
  if (ee > 13) {
    cc += 1;
    month = ee - 13;
  }
  year = cc - 4716;

  const iyear = 10631 / 30;
  const epochastro = 1948084;
  const shift1 = 8.01 / 60;

  let z = jd - epochastro;
  const cyc = Math.floor(z / 10631);
  z = z - 10631 * cyc;
  const j = Math.floor((z - shift1) / iyear);
  const iy = 30 * cyc + j;
  z = z - Math.floor(j * iyear + shift1);
  let im = Math.floor((z + 28.5001) / 29.5);
  if (im === 13) im = 12;
  const id = Math.floor(z - Math.floor(29.5001 * im - 29));

  const monthIndex = Math.max(0, Math.min(11, im - 1));
  const hMonth = HIJRI_MONTHS[monthIndex];

  return {
    year: iy,
    monthIndex,
    day: id,
    monthNameEn: hMonth.en,
    monthNameBn: hMonth.bn,
    monthNameAr: hMonth.ar,
    formattedEn: `${id} ${hMonth.en} ${iy} AH`,
    formattedBn: `${toBengaliNumerals(id)} ${hMonth.bn}, ${toBengaliNumerals(iy)} হিজরি`,
    isEstimated: true as const,
  };
}

export function getTriCalendarDate(
  dateInput: Date | string,
  options: { hijriOffsetDays?: number; banglaVariant?: 'revised' | 'traditional' } = {}
): TriCalendarDate {
  const date =
    typeof dateInput === 'string'
      ? new Date(`${dateInput.slice(0, 10)}T12:00:00`)
      : new Date(dateInput);

  const gy = date.getFullYear();
  const gm = date.getMonth();
  const gd = date.getDate();
  const gw = date.getDay();

  const iso = `${gy}-${String(gm + 1).padStart(2, '0')}-${String(gd).padStart(2, '0')}`;

  return {
    gregorian: {
      year: gy,
      month: gm + 1,
      day: gd,
      iso,
      formattedEn: `${gd} ${GREGORIAN_MONTHS_EN[gm]} ${gy}`,
      formattedBn: `${toBengaliNumerals(gd)} ${GREGORIAN_MONTHS_BN[gm]} ${toBengaliNumerals(gy)}`,
      weekdayEn: WEEKDAYS_EN[gw],
      weekdayBn: WEEKDAYS_BN[gw],
    },
    bangla: getBanglaDate(date, options.banglaVariant || 'revised'),
    hijri: getHijriDate(date, options.hijriOffsetDays || 0),
  };
}

export interface ZonedClockParts {
  year: number;
  month: number;
  day: number;
  isoDate: string;
  hour24: string;
  hour12: string;
  minute: string;
  second: string;
  period: 'AM' | 'PM';
}

export function getZonedClockParts(date: Date, timeZone = 'Asia/Dhaka'): ZonedClockParts {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const parts = fmt.formatToParts(date);
    const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
    const year = Number(get('year')) || date.getFullYear();
    const month = Number(get('month')) || date.getMonth() + 1;
    const day = Number(get('day')) || date.getDate();
    let h24 = Number(get('hour'));
    if (Number.isNaN(h24)) h24 = date.getHours();
    if (h24 === 24) h24 = 0;
    const minute = (get('minute') || String(date.getMinutes())).padStart(2, '0');
    const second = (get('second') || String(date.getSeconds())).padStart(2, '0');
    const period: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM';
    const h12Num = h24 % 12 === 0 ? 12 : h24 % 12;

    return {
      year,
      month,
      day,
      isoDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      hour24: String(h24).padStart(2, '0'),
      hour12: String(h12Num).padStart(2, '0'),
      minute,
      second,
      period,
    };
  } catch {
    const h24 = date.getHours();
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    const d = date.getDate();
    return {
      year: y,
      month: m,
      day: d,
      isoDate: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      hour24: String(h24).padStart(2, '0'),
      hour12: String(h12).padStart(2, '0'),
      minute: String(date.getMinutes()).padStart(2, '0'),
      second: String(date.getSeconds()).padStart(2, '0'),
      period: h24 >= 12 ? 'PM' : 'AM',
    };
  }
}

