export interface UnitItem {
  id: string;
  dimension: string;
  symbol: string;
  nameEn: string;
  nameBn?: string;
  toBaseFactor: number;
  offset?: number; // For temperature conversions
}

export const UNIT_DIMENSIONS: Array<{ id: string; labelEn: string; labelBn: string }> = [
  { id: 'length', labelEn: 'Length & Distance', labelBn: 'দৈর্ঘ্য ও দূরত্ব' },
  { id: 'area', labelEn: 'Area', labelBn: 'ক্ষেত্রফল' },
  { id: 'volume', labelEn: 'Volume & Capacity', labelBn: 'আয়তন ও ধারণক্ষমতা' },
  { id: 'mass', labelEn: 'Mass & Weight', labelBn: 'ভর ও ওজন' },
  { id: 'temperature', labelEn: 'Temperature', labelBn: 'তাপমাত্রা' },
  { id: 'pressure', labelEn: 'Pressure & Stress', labelBn: 'চাপ ও পীড়ন' },
  { id: 'force', labelEn: 'Force', labelBn: 'বল (Force)' },
  { id: 'power', labelEn: 'Power', labelBn: 'ক্ষমতা (Power)' },
  { id: 'energy', labelEn: 'Energy & Work', labelBn: 'শক্তি ও কাজ' },
  { id: 'voltage', labelEn: 'Voltage', labelBn: 'ভোল্টেজ' },
  { id: 'current', labelEn: 'Current', labelBn: 'কারেন্ট' },
  { id: 'resistance', labelEn: 'Resistance', labelBn: 'রোধ (Resistance)' },
  { id: 'frequency', labelEn: 'Frequency', labelBn: 'কম্পাঙ্ক (Frequency)' },
  { id: 'speed', labelEn: 'Speed & Velocity', labelBn: 'বেগ ও গতি' },
  { id: 'flow', labelEn: 'Flow Rate', labelBn: 'প্রবাহ হার (Flow Rate)' },
  { id: 'torque', labelEn: 'Torque', labelBn: 'টর্ক (Torque)' },
  { id: 'density', labelEn: 'Density', labelBn: 'ঘনত্ব (Density)' },
  { id: 'angle', labelEn: 'Angle', labelBn: 'কোণ (Angle)' },
  { id: 'time', labelEn: 'Time', labelBn: 'সময়' },
];

export const BUILTIN_UNITS: UnitItem[] = [
  // Length (base: m)
  { id: 'len_m', dimension: 'length', symbol: 'm', nameEn: 'Meter', nameBn: 'মিটার', toBaseFactor: 1 },
  { id: 'len_mm', dimension: 'length', symbol: 'mm', nameEn: 'Millimeter', nameBn: 'মিলিমিটার', toBaseFactor: 0.001 },
  { id: 'len_cm', dimension: 'length', symbol: 'cm', nameEn: 'Centimeter', nameBn: 'সেন্টিমিটার', toBaseFactor: 0.01 },
  { id: 'len_km', dimension: 'length', symbol: 'km', nameEn: 'Kilometer', nameBn: 'কিলোমিটার', toBaseFactor: 1000 },
  { id: 'len_in', dimension: 'length', symbol: 'in', nameEn: 'Inch', nameBn: 'ইঞ্চি', toBaseFactor: 0.0254 },
  { id: 'len_ft', dimension: 'length', symbol: 'ft', nameEn: 'Foot', nameBn: 'ফুট', toBaseFactor: 0.3048 },
  { id: 'len_yd', dimension: 'length', symbol: 'yd', nameEn: 'Yard', nameBn: 'গজ', toBaseFactor: 0.9144 },
  { id: 'len_mi', dimension: 'length', symbol: 'mi', nameEn: 'Mile', nameBn: 'মাইল', toBaseFactor: 1609.344 },

  // Area (base: m2)
  { id: 'area_m2', dimension: 'area', symbol: 'm²', nameEn: 'Square Meter', nameBn: 'বর্গমিটার', toBaseFactor: 1 },
  { id: 'area_cm2', dimension: 'area', symbol: 'cm²', nameEn: 'Square Centimeter', nameBn: 'বর্গসেন্টিমিটার', toBaseFactor: 0.0001 },
  { id: 'area_mm2', dimension: 'area', symbol: 'mm²', nameEn: 'Square Millimeter', nameBn: 'বর্গমিলিমিটার', toBaseFactor: 0.000001 },
  { id: 'area_ft2', dimension: 'area', symbol: 'ft²', nameEn: 'Square Foot', nameBn: 'বর্গফুট', toBaseFactor: 0.09290304 },
  { id: 'area_acre', dimension: 'area', symbol: 'acre', nameEn: 'Acre', nameBn: 'একর', toBaseFactor: 4046.8564224 },
  { id: 'area_hectare', dimension: 'area', symbol: 'ha', nameEn: 'Hectare', nameBn: 'হেক্টর', toBaseFactor: 10000 },
  { id: 'area_decimal', dimension: 'area', symbol: 'dec', nameEn: 'Decimal (Shotok)', nameBn: 'শতক (ডেসিমাল)', toBaseFactor: 40.468564224 },
  { id: 'area_katha', dimension: 'area', symbol: 'katha', nameEn: 'Katha (BD)', nameBn: 'কাঠা (বাংলাদেশ)', toBaseFactor: 66.8901888 },

  // Volume (base: m3)
  { id: 'vol_m3', dimension: 'volume', symbol: 'm³', nameEn: 'Cubic Meter', nameBn: 'ঘনমিটার', toBaseFactor: 1 },
  { id: 'vol_l', dimension: 'volume', symbol: 'L', nameEn: 'Liter', nameBn: 'লিটার', toBaseFactor: 0.001 },
  { id: 'vol_ml', dimension: 'volume', symbol: 'mL', nameEn: 'Milliliter', nameBn: 'মিলিলিটার', toBaseFactor: 0.000001 },
  { id: 'vol_ft3', dimension: 'volume', symbol: 'ft³', nameEn: 'Cubic Foot (CFT)', nameBn: 'ঘনফুট (CFT)', toBaseFactor: 0.0283168466 },
  { id: 'vol_gal', dimension: 'volume', symbol: 'gal', nameEn: 'US Gallon', nameBn: 'ইউএস গ্যালন', toBaseFactor: 0.003785411784 },

  // Mass (base: kg)
  { id: 'mass_kg', dimension: 'mass', symbol: 'kg', nameEn: 'Kilogram', nameBn: 'কিলোগ্রাম', toBaseFactor: 1 },
  { id: 'mass_g', dimension: 'mass', symbol: 'g', nameEn: 'Gram', nameBn: 'গ্রাম', toBaseFactor: 0.001 },
  { id: 'mass_mg', dimension: 'mass', symbol: 'mg', nameEn: 'Milligram', nameBn: 'মিলিগ্রাম', toBaseFactor: 0.000001 },
  { id: 'mass_ton', dimension: 'mass', symbol: 't', nameEn: 'Metric Ton', nameBn: 'মেট্রিক টন', toBaseFactor: 1000 },
  { id: 'mass_lb', dimension: 'mass', symbol: 'lb', nameEn: 'Pound', nameBn: 'পাউন্ড', toBaseFactor: 0.45359237 },
  { id: 'mass_oz', dimension: 'mass', symbol: 'oz', nameEn: 'Ounce', nameBn: 'আউন্স', toBaseFactor: 0.028349523125 },

  // Temperature (special affine conversion handled in convertUnit)
  { id: 'temp_c', dimension: 'temperature', symbol: '°C', nameEn: 'Celsius', nameBn: 'সেলসিয়াস', toBaseFactor: 1 },
  { id: 'temp_f', dimension: 'temperature', symbol: '°F', nameEn: 'Fahrenheit', nameBn: 'ফারেনহাইট', toBaseFactor: 1 },
  { id: 'temp_k', dimension: 'temperature', symbol: 'K', nameEn: 'Kelvin', nameBn: 'কেলভিন', toBaseFactor: 1 },

  // Pressure (base: Pa)
  { id: 'pres_pa', dimension: 'pressure', symbol: 'Pa', nameEn: 'Pascal', nameBn: 'প্যাসকেল', toBaseFactor: 1 },
  { id: 'pres_kpa', dimension: 'pressure', symbol: 'kPa', nameEn: 'Kilopascal', nameBn: 'কিলোপ্যাসকেল', toBaseFactor: 1000 },
  { id: 'pres_mpa', dimension: 'pressure', symbol: 'MPa', nameEn: 'Megapascal', nameBn: 'মেগাপ্যাসকেল', toBaseFactor: 1000000 },
  { id: 'pres_bar', dimension: 'pressure', symbol: 'bar', nameEn: 'Bar', nameBn: 'বার', toBaseFactor: 100000 },
  { id: 'pres_psi', dimension: 'pressure', symbol: 'psi', nameEn: 'PSI', nameBn: 'পিএসআই', toBaseFactor: 6894.757293 },
  { id: 'pres_atm', dimension: 'pressure', symbol: 'atm', nameEn: 'Atmosphere', nameBn: 'অ্যাটমোস্ফিয়ার', toBaseFactor: 101325 },

  // Force (base: N)
  { id: 'frc_n', dimension: 'force', symbol: 'N', nameEn: 'Newton', nameBn: 'নিউটন', toBaseFactor: 1 },
  { id: 'frc_kn', dimension: 'force', symbol: 'kN', nameEn: 'Kilonewton', nameBn: 'কিলোনিউটন', toBaseFactor: 1000 },
  { id: 'frc_kgf', dimension: 'force', symbol: 'kgf', nameEn: 'Kilogram-force', nameBn: 'কিলোগ্রাম-বল', toBaseFactor: 9.80665 },
  { id: 'frc_lbf', dimension: 'force', symbol: 'lbf', nameEn: 'Pound-force', nameBn: 'পাউন্ড-বল', toBaseFactor: 4.4482216 },

  // Power (base: W)
  { id: 'pwr_w', dimension: 'power', symbol: 'W', nameEn: 'Watt', nameBn: 'ওয়াট', toBaseFactor: 1 },
  { id: 'pwr_kw', dimension: 'power', symbol: 'kW', nameEn: 'Kilowatt', nameBn: 'কিলোওয়াট', toBaseFactor: 1000 },
  { id: 'pwr_mw', dimension: 'power', symbol: 'MW', nameEn: 'Megawatt', nameBn: 'মেগাওয়াট', toBaseFactor: 1000000 },
  { id: 'pwr_hp', dimension: 'power', symbol: 'HP', nameEn: 'Horsepower (Mech)', nameBn: 'হর্সপাওয়ার', toBaseFactor: 745.699872 },

  // Energy (base: J)
  { id: 'eng_j', dimension: 'energy', symbol: 'J', nameEn: 'Joule', nameBn: 'জুল', toBaseFactor: 1 },
  { id: 'eng_kj', dimension: 'energy', symbol: 'kJ', nameEn: 'Kilojoule', nameBn: 'কিলোজুল', toBaseFactor: 1000 },
  { id: 'eng_kwh', dimension: 'energy', symbol: 'kWh', nameEn: 'Kilowatt-hour', nameBn: 'কিলোওয়াট-ঘণ্টা', toBaseFactor: 3600000 },
  { id: 'eng_btu', dimension: 'energy', symbol: 'BTU', nameEn: 'British Thermal Unit', nameBn: 'বিটিইউ', toBaseFactor: 1055.05585 },

  // Voltage (base: V)
  { id: 'vlt_v', dimension: 'voltage', symbol: 'V', nameEn: 'Volt', nameBn: 'ভোল্ট', toBaseFactor: 1 },
  { id: 'vlt_mv', dimension: 'voltage', symbol: 'mV', nameEn: 'Millivolt', nameBn: 'মিলিভোল্ট', toBaseFactor: 0.001 },
  { id: 'vlt_kv', dimension: 'voltage', symbol: 'kV', nameEn: 'Kilovolt', nameBn: 'কিলোভোল্ট', toBaseFactor: 1000 },

  // Current (base: A)
  { id: 'cur_a', dimension: 'current', symbol: 'A', nameEn: 'Ampere', nameBn: 'অ্যাম্পিয়ার', toBaseFactor: 1 },
  { id: 'cur_ma', dimension: 'current', symbol: 'mA', nameEn: 'Milliampere', nameBn: 'মিলিঅ্যাম্পিয়ার', toBaseFactor: 0.001 },
  { id: 'cur_ka', dimension: 'current', symbol: 'kA', nameEn: 'Kiloampere', nameBn: 'কিলোঅ্যাম্পিয়ার', toBaseFactor: 1000 },

  // Resistance (base: Ohm)
  { id: 'res_ohm', dimension: 'resistance', symbol: 'Ω', nameEn: 'Ohm', nameBn: 'ওহম', toBaseFactor: 1 },
  { id: 'res_kohm', dimension: 'resistance', symbol: 'kΩ', nameEn: 'Kiloohm', nameBn: 'কিলোওহম', toBaseFactor: 1000 },
  { id: 'res_mohm', dimension: 'resistance', symbol: 'MΩ', nameEn: 'Megaohm', nameBn: 'মেগাওহম', toBaseFactor: 1000000 },

  // Frequency (base: Hz)
  { id: 'frq_hz', dimension: 'frequency', symbol: 'Hz', nameEn: 'Hertz', nameBn: 'হার্টজ', toBaseFactor: 1 },
  { id: 'frq_khz', dimension: 'frequency', symbol: 'kHz', nameEn: 'Kilohertz', nameBn: 'কিলোহার্টজ', toBaseFactor: 1000 },
  { id: 'frq_mhz', dimension: 'frequency', symbol: 'MHz', nameEn: 'Megahertz', nameBn: 'মেগাহার্টজ', toBaseFactor: 1000000 },

  // Speed (base: m/s)
  { id: 'spd_ms', dimension: 'speed', symbol: 'm/s', nameEn: 'Meter/sec', nameBn: 'মিটার/সেকেন্ড', toBaseFactor: 1 },
  { id: 'spd_kmh', dimension: 'speed', symbol: 'km/h', nameEn: 'Kilometer/hr', nameBn: 'কিমি/ঘণ্টা', toBaseFactor: 0.277777778 },
  { id: 'spd_mph', dimension: 'speed', symbol: 'mph', nameEn: 'Miles/hr', nameBn: 'মাইল/ঘণ্টা', toBaseFactor: 0.44704 },
  { id: 'spd_fpm', dimension: 'speed', symbol: 'ft/min', nameEn: 'Feet/min', nameBn: 'ফুট/মিনিট', toBaseFactor: 0.00508 },

  // Flow Rate (base: m3/s)
  { id: 'flw_m3s', dimension: 'flow', symbol: 'm³/s', nameEn: 'Cubic meter/sec', nameBn: 'ঘনমিটার/সেকেন্ড', toBaseFactor: 1 },
  { id: 'flw_m3h', dimension: 'flow', symbol: 'm³/h', nameEn: 'Cubic meter/hr', nameBn: 'ঘনমিটার/ঘণ্টা', toBaseFactor: 1 / 3600 },
  { id: 'flw_lpm', dimension: 'flow', symbol: 'L/min', nameEn: 'Liter/min', nameBn: 'লিটার/মিনিট', toBaseFactor: 0.001 / 60 },
  { id: 'flw_gpm', dimension: 'flow', symbol: 'GPM', nameEn: 'US Gallon/min', nameBn: 'গ্যালন/মিনিট', toBaseFactor: 0.003785411784 / 60 },

  // Torque (base: N·m)
  { id: 'trq_nm', dimension: 'torque', symbol: 'N·m', nameEn: 'Newton-meter', nameBn: 'নিউটন-মিটার', toBaseFactor: 1 },
  { id: 'trq_knm', dimension: 'torque', symbol: 'kN·m', nameEn: 'Kilonewton-meter', nameBn: 'কিলোনিউটন-মিটার', toBaseFactor: 1000 },
  { id: 'trq_lbft', dimension: 'torque', symbol: 'lb·ft', nameEn: 'Pound-foot', nameBn: 'পাউন্ড-ফুট', toBaseFactor: 1.35581795 },

  // Density (base: kg/m3)
  { id: 'den_kgm3', dimension: 'density', symbol: 'kg/m³', nameEn: 'kg/m³', nameBn: 'কেজি/ঘনমিটার', toBaseFactor: 1 },
  { id: 'den_gcm3', dimension: 'density', symbol: 'g/cm³', nameEn: 'g/cm³', nameBn: 'গ্রাম/ঘনসেমি', toBaseFactor: 1000 },
  { id: 'den_lbft3', dimension: 'density', symbol: 'lb/ft³', nameEn: 'lb/ft³', nameBn: 'পাউন্ড/ঘনফুট', toBaseFactor: 16.018463 },

  // Angle (base: deg)
  { id: 'ang_deg', dimension: 'angle', symbol: 'deg', nameEn: 'Degree', nameBn: 'ডিগ্রি', toBaseFactor: 1 },
  { id: 'ang_rad', dimension: 'angle', symbol: 'rad', nameEn: 'Radian', nameBn: 'রেডিয়ান', toBaseFactor: 57.2957795131 },

  // Time (base: s)
  { id: 'time_s', dimension: 'time', symbol: 's', nameEn: 'Second', nameBn: 'সেকেন্ড', toBaseFactor: 1 },
  { id: 'time_min', dimension: 'time', symbol: 'min', nameEn: 'Minute', nameBn: 'মিনিট', toBaseFactor: 60 },
  { id: 'time_hr', dimension: 'time', symbol: 'hr', nameEn: 'Hour', nameBn: 'ঘণ্টা', toBaseFactor: 3600 },
  { id: 'time_day', dimension: 'time', symbol: 'day', nameEn: 'Day', nameBn: 'দিন', toBaseFactor: 86400 },
];

export function getUnitsForDimension(dimension: string, extraUnits: UnitItem[] = []): UnitItem[] {
  const map = new Map<string, UnitItem>();
  for (const u of BUILTIN_UNITS) {
    if (u.dimension === dimension) map.set(u.symbol, u);
  }
  for (const u of extraUnits) {
    if (u.dimension === dimension) map.set(u.symbol, u);
  }
  return Array.from(map.values());
}

export function convertUnitValue(
  value: number,
  fromSymbol: string,
  toSymbol: string,
  dimension: string,
  extraUnits: UnitItem[] = []
): number {
  if (!Number.isFinite(value) || fromSymbol === toSymbol) return value;

  if (dimension === 'temperature') {
    let celsius = value;
    if (fromSymbol === '°F') celsius = (value - 32) * (5 / 9);
    else if (fromSymbol === 'K') celsius = value - 273.15;

    if (toSymbol === '°C') return celsius;
    if (toSymbol === '°F') return celsius * (9 / 5) + 32;
    if (toSymbol === 'K') return celsius + 273.15;
    return value;
  }

  const units = getUnitsForDimension(dimension, extraUnits);
  const fromUnit = units.find((u) => u.symbol === fromSymbol);
  const toUnit = units.find((u) => u.symbol === toSymbol);
  if (!fromUnit || !toUnit || toUnit.toBaseFactor === 0) return value;

  const baseValue = value * fromUnit.toBaseFactor;
  return baseValue / toUnit.toBaseFactor;
}
