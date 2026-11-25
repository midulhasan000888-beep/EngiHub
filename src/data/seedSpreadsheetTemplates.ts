import { SpreadsheetCellData, SpreadsheetTemplateRecord, SpreadsheetWorksheet } from '../types';
import { formatCellKey } from '../engine/spreadsheetEngine';

function buildGridSheet(
  id: string,
  name: string,
  headers: string[],
  rows: string[][],
  extraCells: Record<string, SpreadsheetCellData> = {},
  options?: Partial<SpreadsheetWorksheet>
): SpreadsheetWorksheet {
  const cells: Record<string, SpreadsheetCellData> = {};
  headers.forEach((h, c) => {
    cells[formatCellKey(0, c)] = {
      raw: h,
      style: { bold: true, bgColor: '#1d4ed8', fontColor: '#ffffff', border: true, align: 'center' },
    };
  });
  rows.forEach((row, rIdx) => {
    row.forEach((val, cIdx) => {
      cells[formatCellKey(rIdx + 1, cIdx)] = {
        raw: val,
        style: { border: true, align: val.startsWith('=') || /^\d/.test(val) ? 'right' : 'left' },
      };
    });
  });
  Object.assign(cells, extraCells);

  return {
    id,
    name,
    rowCount: Math.max(25, rows.length + 12),
    colCount: Math.max(10, headers.length + 2),
    freezeRows: 1,
    freezeCols: 0,
    cells,
    merges: [],
    conditionalRules: options?.conditionalRules || [],
    charts: options?.charts || [],
  };
}

export const SEED_SPREADSHEET_TEMPLATES: SpreadsheetTemplateRecord[] = [
  {
    id: 'tpl-xls-electrical-load',
    nameEn: 'Electrical Load Schedule',
    nameBn: 'ইলেকট্রিক্যাল লোড শিডিউল',
    category: 'electrical',
    descriptionEn: 'Connected load, demand factor, connected kW, kVA, and running current schedule with totals.',
    descriptionBn: 'কানেক্টেড লোড, ডিমান্ড ফ্যাক্টর, কিলোওয়াট, কেভিএ ও অ্যাম্পিয়ার হিসাবসহ লোড শিডিউল।',
    recommended: true,
    enabled: true,
    sheets: [
      buildGridSheet(
        'sheet-load',
        'Load Schedule',
        ['Circuit ID', 'Description', 'Qty', 'Unit Watt', 'Total kW', 'Demand Factor', 'Demand kW', 'PF', 'Demand kVA', 'Current (A)'],
        [
          ['LP-1', 'LED Lighting Panel', '40', '18', '=C2*D2/1000', '0.9', '=E2*F2', '0.95', '=G2/H2', '=I2*1000/(1.732*400)'],
          ['PP-1', 'Socket Outlets', '24', '250', '=C3*D3/1000', '0.6', '=E3*F3', '0.85', '=G3/H3', '=I3*1000/(1.732*400)'],
          ['HVAC-1', 'Chiller Unit', '2', '12000', '=C4*D4/1000', '0.85', '=E4*F4', '0.88', '=G4/H4', '=I4*1000/(1.732*400)'],
          ['PUMP-1', 'Booster Pump', '2', '3700', '=C5*D5/1000', '0.8', '=E5*F5', '0.85', '=G5/H5', '=I5*1000/(1.732*400)'],
          ['TOTAL', 'Total System Load', '', '', '=SUM(E2:E5)', '', '=SUM(G2:G5)', '', '=SUM(I2:I5)', '=SUM(J2:J5)'],
        ],
        {},
        {
          charts: [
            {
              id: 'ch-load',
              type: 'bar',
              title: 'Demand kW by Circuit',
              labelRange: 'A2:A5',
              dataRange: 'G2:G5',
              showLegend: true,
              xAxisLabel: 'Circuit',
              yAxisLabel: 'kW',
            },
          ],
        }
      ),
    ],
  },
  {
    id: 'tpl-xls-cable-schedule',
    nameEn: 'Cable Schedule',
    nameBn: 'ক্যাবল শিডিউল',
    category: 'electrical',
    descriptionEn: 'Feeder cable sizing, length, voltage drop %, and breaker rating schedule.',
    descriptionBn: 'ফিডার ক্যাবল সাইজ, দৈর্ঘ্য, ভোল্টেজ ড্রপ % এবং ব্রেকার রেটিং শিট।',
    recommended: true,
    enabled: true,
    sheets: [
      buildGridSheet(
        'sheet-cable',
        'Cable Schedule',
        ['Tag', 'From', 'To', 'Load (A)', 'Length (m)', 'Cable Size (mm2)', 'mV/A/m', 'V-Drop (V)', 'V-Drop %', 'Status'],
        [
          ['C-01', 'MDB', 'SDB-GF', '63', '35', '16', '2.8', '=1.732*D2*E2*G2/1000', '=H2/400', '=IF(I2<=0.03,"PASS","CHECK")'],
          ['C-02', 'MDB', 'SDB-1F', '80', '55', '25', '1.75', '=1.732*D3*E3*G3/1000', '=H3/400', '=IF(I3<=0.03,"PASS","CHECK")'],
          ['C-03', 'MDB', 'LIFT-1', '45', '70', '10', '4.4', '=1.732*D4*E4*G4/1000', '=H4/400', '=IF(I4<=0.03,"PASS","CHECK")'],
        ]
      ),
    ],
  },
  {
    id: 'tpl-xls-motor-list',
    nameEn: 'Motor List & Starter Schedule',
    nameBn: 'মোটর তালিকা ও স্টার্টার শিডিউল',
    category: 'electrical',
    descriptionEn: 'Industrial motor kW, HP, FLC, starter type, and overload setting.',
    descriptionBn: 'ইন্ডাস্ট্রিয়াল মোটর kW, HP, FLC, স্টার্টার ও ওভারলোড সেটিং।',
    enabled: true,
    sheets: [
      buildGridSheet(
        'sheet-motor',
        'Motor List',
        ['Motor ID', 'Equipment', 'Rated kW', 'Rated HP', 'Voltage (V)', 'PF', 'Eff', 'FLC (A)', 'Starter Type'],
        [
          ['M-01', 'Main Feed Pump', '15', '=C2*1.341', '400', '0.86', '0.92', '=C2*1000/(1.732*E2*F2*G2)', 'Star-Delta'],
          ['M-02', 'Cooling Fan', '5.5', '=C3*1.341', '400', '0.84', '0.89', '=C3*1000/(1.732*E3*F3*G3)', 'DOL / VFD'],
          ['M-03', 'Air Compressor', '22', '=C4*1.341', '400', '0.88', '0.93', '=C4*1000/(1.732*E4*F4*G4)', 'Soft Starter'],
          ['TOTAL', 'Connected Motor Fleet', '=SUM(C2:C4)', '=SUM(D2:D4)', '', '', '', '=SUM(H2:H4)', ''],
        ]
      ),
    ],
  },
  {
    id: 'tpl-xls-transformer-load',
    nameEn: 'Transformer Load Analysis',
    nameBn: 'ট্রান্সফরমার লোড বিশ্লেষণ',
    category: 'electrical',
    descriptionEn: 'Transformer kVA capacity, phase loads, % loading, and safety reserve calculation.',
    descriptionBn: 'ট্রান্সফরমার kVA ক্ষমতা, লোড %, এবং অতিরিক্ত মার্জিন হিসাব।',
    enabled: true,
    sheets: [
      buildGridSheet(
        'sheet-tx',
        'Transformer Load',
        ['Substation', 'Rating (kVA)', 'R-Phase (A)', 'Y-Phase (A)', 'B-Phase (A)', 'Avg Load (A)', 'Rated Sec (A)', 'Loading %', 'Alert'],
        [
          ['TX-01', '500', '420', '445', '410', '=AVERAGE(C2:E2)', '=B2*1000/(1.732*400)', '=F2/G2', '=IF(H2>0.8,"HIGH LOAD","NORMAL")'],
          ['TX-02', '1000', '710', '690', '730', '=AVERAGE(C3:E3)', '=B3*1000/(1.732*400)', '=F3/G3', '=IF(H3>0.8,"HIGH LOAD","NORMAL")'],
        ]
      ),
    ],
  },
  {
    id: 'tpl-xls-generator-load',
    nameEn: 'Generator Load Sheet',
    nameBn: 'জেনারেটর লোড শিট',
    category: 'electrical',
    descriptionEn: 'Emergency generator backup load breakdown, running kW, and fuel estimate.',
    descriptionBn: 'ইমার্জেন্সি জেনারেটর লোড হিসাব ও ফুয়েল খরচ প্রাক্কলন।',
    enabled: true,
    sheets: [
      buildGridSheet(
        'sheet-gen',
        'Generator Load',
        ['Essential Load', 'Running kW', 'Starting Factor', 'Peak kW', 'PF', 'Required kVA'],
        [
          ['Fire Pump', '18.5', '1.5', '=B2*C2', '0.8', '=D2/E2'],
          ['Emergency Lighting', '12', '1.0', '=B3*C3', '0.9', '=D3/E3'],
          ['Passenger Lift', '15', '1.8', '=B4*C4', '0.85', '=D4/E4'],
          ['TOTAL BACKUP', '=SUM(B2:B4)', '', '=SUM(D2:D4)', '', '=SUM(F2:F4)'],
        ]
      ),
    ],
  },
  {
    id: 'tpl-xls-boq',
    nameEn: 'Engineering BOQ Sheet',
    nameBn: 'প্রকৌশল বিওকিউ (BOQ) শিট',
    category: 'civil',
    descriptionEn: 'Itemized Bill of Quantities with quantity, unit rate, subtotal, VAT, and grand total.',
    descriptionBn: 'পরিমাণ, একক দর, মোট মূল্য, ভ্যাট ও সর্বমোট ব্যয়সহ বিওকিউ শিট।',
    recommended: true,
    enabled: true,
    sheets: [
      buildGridSheet(
        'sheet-boq',
        'BOQ Estimate',
        ['Sl', 'Work Item', 'Unit', 'Qty', 'Rate (BDT)', 'Amount (BDT)', 'Remarks'],
        [
          ['1', 'Earthwork in Excavation', 'Cum', '120', '350', '=D2*E2', 'Foundation pit'],
          ['2', 'RCC M25 Concrete (1:1:2)', 'Cum', '45', '9800', '=D3*E3', 'Column & Footing'],
          ['3', '60-Grade Rebar (MS Rod)', 'Ton', '6.5', '96000', '=D4*E4', 'With binding wire'],
          ['4', 'First Class Brick Masonry', 'Cum', '38', '7200', '=D5*E5', '1:5 mortar'],
          ['', 'Sub-Total', '', '', '', '=SUM(F2:F5)', ''],
          ['', 'Contingency (5%)', '', '', '', '=F6*0.05', ''],
          ['', 'Grand Total', '', '', '', '=F6+F7', ''],
        ]
      ),
    ],
  },
  {
    id: 'tpl-xls-material-calc',
    nameEn: 'Material Calculation Sheet',
    nameBn: 'নির্মাণ সামগ্রী হিসাব শিট',
    category: 'construction',
    descriptionEn: 'Cement bags, sand cft, aggregate cft, and brick requirement calculator.',
    descriptionBn: 'সিমেন্ট ব্যাগ, বালি, খোয়া/পাথর ও ইটের পরিমাণ হিসাব।',
    enabled: true,
    sheets: [
      buildGridSheet(
        'sheet-mat',
        'Material Calc',
        ['Element', 'Wet Vol (Cum)', 'Dry Vol (Cum)', 'Mix Ratio Sum', 'Cement (Bags)', 'Sand (Cum)', 'Aggregate (Cum)'],
        [
          ['Footing RCC (1:1.5:3)', '18', '=B2*1.54', '5.5', '=ROUNDUP((C2*1/D2)*28.8,0)', '=C2*1.5/D2', '=C2*3/D2'],
          ['Slab RCC (1:2:4)', '24', '=B3*1.54', '7', '=ROUNDUP((C3*1/D3)*28.8,0)', '=C3*2/D3', '=C3*4/D3'],
          ['TOTAL', '=SUM(B2:B3)', '=SUM(C2:C3)', '', '=SUM(E2:E3)', '=SUM(F2:F3)', '=SUM(G2:G3)'],
        ]
      ),
    ],
  },
  {
    id: 'tpl-xls-student-result',
    nameEn: 'Student Result & GPA Sheet',
    nameBn: 'শিক্ষার্থী ফলাফল ও জিপিএ শিট',
    category: 'education',
    descriptionEn: 'Subject marks, total, percentage, pass/fail status, and automated letter grade.',
    descriptionBn: 'বিষয়ভিত্তিক নম্বর, মোট নম্বর, শতকরা, পাস/ফেল ও অটো গ্রেড শিট।',
    recommended: true,
    enabled: true,
    sheets: [
      buildGridSheet(
        'sheet-result',
        'Result Sheet',
        ['Roll', 'Student Name', 'Bangla', 'English', 'Math', 'Science', 'Total', 'Average %', 'Grade', 'Status'],
        [
          ['101', 'Amina Rahman', '84', '78', '92', '88', '=SUM(C2:F2)', '=AVERAGE(C2:F2)', '=IFS(H2>=80,"A+",H2>=70,"A",H2>=60,"A-",H2>=50,"B",H2>=40,"C",TRUE,"F")', '=IF(MIN(C2:F2)>=33,"PASS","FAIL")'],
          ['102', 'Tariqul Islam', '72', '65', '74', '69', '=SUM(C3:F3)', '=AVERAGE(C3:F3)', '=IFS(H3>=80,"A+",H3>=70,"A",H3>=60,"A-",H3>=50,"B",H3>=40,"C",TRUE,"F")', '=IF(MIN(C3:F3)>=33,"PASS","FAIL")'],
          ['103', 'Nusrat Jahan', '89', '85', '95', '91', '=SUM(C4:F4)', '=AVERAGE(C4:F4)', '=IFS(H4>=80,"A+",H4>=70,"A",H4>=60,"A-",H4>=50,"B",H4>=40,"C",TRUE,"F")', '=IF(MIN(C4:F4)>=33,"PASS","FAIL")'],
          ['', 'Class Average', '=AVERAGE(C2:C4)', '=AVERAGE(D2:D4)', '=AVERAGE(E2:E4)', '=AVERAGE(F2:F4)', '=AVERAGE(G2:G4)', '=AVERAGE(H2:H4)', '', ''],
        ]
      ),
    ],
  },
  {
    id: 'tpl-xls-attendance',
    nameEn: 'Attendance Sheet',
    nameBn: 'উপস্থিতি শিট (Attendance)',
    category: 'education',
    descriptionEn: 'Weekly/daily P/A/L attendance register with automated present count and attendance %.',
    descriptionBn: 'উপস্থিত (P), অনুপস্থিত (A) এবং শতকরা উপস্থিতির হিসাব।',
    enabled: true,
    sheets: [
      buildGridSheet(
        'sheet-att',
        'Attendance',
        ['ID', 'Name', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Present Days', 'Attendance %', 'Eligibility'],
        [
          ['01', 'Karim Hasan', 'P', 'P', 'P', 'A', 'P', '=COUNTIF(C2:G2,"P")', '=H2/5', '=IF(I2>=0.75,"OK","LOW")'],
          ['02', 'Sadia Afrin', 'P', 'P', 'P', 'P', 'P', '=COUNTIF(C3:G3,"P")', '=H3/5', '=IF(I3>=0.75,"OK","LOW")'],
          ['03', 'Rashed Mia', 'P', 'A', 'A', 'P', 'P', '=COUNTIF(C4:G4,"P")', '=H4/5', '=IF(I4>=0.75,"OK","LOW")'],
        ]
      ),
    ],
  },
  {
    id: 'tpl-xls-monthly-expense',
    nameEn: 'Monthly Expense Sheet',
    nameBn: 'মাসিক খরচ ও বাজেট শিট',
    category: 'finance',
    descriptionEn: 'Budget vs actual monthly spending tracker with variance and savings summary.',
    descriptionBn: 'মাসিক বাজেট বনাম প্রকৃত খরচ এবং সঞ্চয়ের হিসাব।',
    enabled: true,
    sheets: [
      buildGridSheet(
        'sheet-exp',
        'Monthly Expense',
        ['Category', 'Budget (BDT)', 'Actual (BDT)', 'Variance', 'Status'],
        [
          ['House Rent', '18000', '18000', '=B2-C2', '=IF(D2<0,"OVER","ON TRACK")'],
          ['Groceries & Food', '12000', '11400', '=B3-C3', '=IF(D3<0,"OVER","ON TRACK")'],
          ['Utilities & Internet', '4500', '4850', '=B4-C4', '=IF(D4<0,"OVER","ON TRACK")'],
          ['Transport', '4000', '3600', '=B5-C5', '=IF(D5<0,"OVER","ON TRACK")'],
          ['TOTAL', '=SUM(B2:B5)', '=SUM(C2:C5)', '=SUM(D2:D5)', '=IF(D6<0,"DEFICIT","SAVED")'],
        ]
      ),
    ],
  },
  {
    id: 'tpl-xls-salary',
    nameEn: 'Payroll & Salary Sheet',
    nameBn: 'বেতন ও পেরোল শিট',
    category: 'finance',
    descriptionEn: 'Basic salary, house rent, medical, overtime, deductions, and net payable salary.',
    descriptionBn: 'মূল বেতন, বাড়ি ভাড়া, চিকিৎসা ভাতা, ওভারটাইম ও কর্তনসহ নিট বেতন শিট।',
    enabled: true,
    sheets: [
      buildGridSheet(
        'sheet-sal',
        'Salary Sheet',
        ['Emp ID', 'Name', 'Basic', 'House Rent (40%)', 'Medical', 'Overtime', 'Gross Pay', 'Tax/PF', 'Net Salary'],
        [
          ['EMP-01', 'Mahmudul Hasan', '35000', '=C2*0.4', '2500', '3000', '=SUM(C2:F2)', '2200', '=G2-H2'],
          ['EMP-02', 'Farhana Akter', '28000', '=C3*0.4', '2500', '1500', '=SUM(C3:F3)', '1600', '=G3-H3'],
          ['EMP-03', 'Sohel Rana', '22000', '=C4*0.4', '2000', '2400', '=SUM(C4:F4)', '1100', '=G4-H4'],
          ['TOTAL', '', '=SUM(C2:C4)', '=SUM(D2:D4)', '=SUM(E2:E4)', '=SUM(F2:F4)', '=SUM(G2:G4)', '=SUM(H2:H4)', '=SUM(I2:I4)'],
        ]
      ),
    ],
  },
  {
    id: 'tpl-xls-inventory',
    nameEn: 'Inventory & Stock Control',
    nameBn: 'ইনভেন্টরি ও স্টক ম্যানেজমেন্ট শিট',
    category: 'industrial',
    descriptionEn: 'Opening stock, received, issued, closing balance, and automatic reorder alert.',
    descriptionBn: 'প্রারম্ভিক মজুদ, ক্রয়, ইস্যু, সমাপনী মজুদ ও রি-অর্ডার সতর্কতা।',
    enabled: true,
    sheets: [
      buildGridSheet(
        'sheet-inv',
        'Inventory',
        ['SKU', 'Item Name', 'Opening', 'In', 'Out', 'Closing', 'Reorder Level', 'Unit Cost', 'Stock Value', 'Alert'],
        [
          ['EL-101', 'MCB 32A 3P', '45', '20', '38', '=C2+D2-E2', '30', '850', '=F2*H2', '=IF(F2<=G2,"REORDER","OK")'],
          ['EL-102', 'NYM Cable 2.5mm (Coil)', '18', '10', '22', '=C3+D3-E3', '10', '3200', '=F3*H3', '=IF(F3<=G3,"REORDER","OK")'],
          ['CV-201', 'Portland Cement (Bag)', '240', '100', '190', '=C4+D4-E4', '100', '540', '=F4*H4', '=IF(F4<=G4,"REORDER","OK")'],
          ['TOTAL', '', '', '', '', '=SUM(F2:F4)', '', '', '=SUM(I2:I4)', ''],
        ]
      ),
    ],
  },
  {
    id: 'tpl-xls-project-cost',
    nameEn: 'Project Cost & Profit Tracker',
    nameBn: 'প্রজেক্ট কস্ট ও লাভ-ক্ষতি শিট',
    category: 'finance',
    descriptionEn: 'Contract budget vs labor, material, equipment costs, margin %, and variance.',
    descriptionBn: 'চুক্তিমূল্য, শ্রম, মালামাল, যন্ত্রপাতি খরচ ও নিট লাভের হিসাব।',
    enabled: true,
    sheets: [
      buildGridSheet(
        'sheet-proj',
        'Project Cost',
        ['Work Package', 'Contract Value', 'Material Cost', 'Labor Cost', 'Equipment', 'Total Cost', 'Profit', 'Margin %'],
        [
          ['Substation Works', '850000', '520000', '110000', '45000', '=SUM(C2:E2)', '=B2-F2', '=G2/B2'],
          ['Internal Wiring', '420000', '235000', '85000', '15000', '=SUM(C3:E3)', '=B3-F3', '=G3/B3'],
          ['Plumbing & Fire', '310000', '175000', '65000', '12000', '=SUM(C4:E4)', '=B4-F4', '=G4/B4'],
          ['TOTAL', '=SUM(B2:B4)', '=SUM(C2:C4)', '=SUM(D2:D4)', '=SUM(E2:E4)', '=SUM(F2:F4)', '=SUM(G2:G4)', '=G5/B5'],
        ]
      ),
    ],
  },
  {
    id: 'tpl-xls-daily-work',
    nameEn: 'Daily Site Work Report',
    nameBn: 'দৈনিক সাইট কাজের প্রতিবেদন',
    category: 'construction',
    descriptionEn: 'Daily workforce headcount, activity progress %, hours worked, and supervisor notes.',
    descriptionBn: 'দৈনিক শ্রমিক সংখ্যা, কাজের অগ্রগতি %, কর্মঘণ্টা ও পরিদর্শক মন্তব্য।',
    enabled: true,
    sheets: [
      buildGridSheet(
        'sheet-dwr',
        'Daily Report',
        ['Date', 'Trade / Crew', 'Workers', 'Hours', 'Man-Hours', 'Target %', 'Actual %', 'Supervisor Note'],
        [
          ['2026-11-23', 'Masonry Crew A', '12', '8', '=C2*D2', '100%', '95%', 'Slab shuttering complete'],
          ['2026-11-23', 'Electrical MEP Team', '6', '8', '=C3*D3', '100%', '100%', 'Conduit laying 2nd floor'],
          ['2026-11-23', 'Steel Fixers', '8', '8', '=C4*D4', '100%', '90%', 'Beam stirrups in progress'],
          ['TOTAL', '', '=SUM(C2:C4)', '', '=SUM(E2:E4)', '', '=AVERAGE(G2:G4)', ''],
        ]
      ),
    ],
  },
];
