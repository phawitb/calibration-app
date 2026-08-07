export interface IsoMethodConfig {
  code: string           // e.g. 'ELC-001'
  name: string           // English name
  nameTh: string         // Thai name
  deviceType: string     // e.g. 'Centrifuge'
  measurementType: 'speed' | 'temperature' | 'temperature_multi_sensor'
  unit: string           // e.g. 'r/min', '°C'
  sensorCount: number    // number of sensors/probes (1 for centrifuge, 5 for enclosure)
  readingsPerPoint: number // readings per calibration point (4 for centrifuge, 30 for enclosure)
  defaultCalPoints: number // default number of calibration points
  hasTimeCheck: boolean  // whether it includes time measurement
  referenceStandards: string[] // available reference standard codes
  formFields: {          // additional form fields specific to this method
    key: string
    label: string
    labelTh: string
    type: 'text' | 'number' | 'select'
    options?: string[]
  }[]
}

export const ISO_METHODS: IsoMethodConfig[] = [
  {
    code: 'ELC-001',
    name: 'Centrifuge',
    nameTh: 'เครื่องหมุนเหวี่ยง',
    deviceType: 'Centrifuge',
    measurementType: 'speed',
    unit: 'r/min',
    sensorCount: 1,
    readingsPerPoint: 4,
    defaultCalPoints: 6,  // up to 6 speed points (pairs of 2 on the form)
    hasTimeCheck: true,
    referenceStandards: ['W-ELC-001', 'W-ELC-002', 'W-ELC-003'],
    formFields: [
      { key: 'uucResolution', label: 'UUC Resolution', labelTh: 'ความละเอียด UUC', type: 'number' },
      { key: 'condition', label: 'Condition', labelTh: 'สภาพเครื่อง', type: 'text' },
    ]
  },
  {
    code: 'TEM-001-1',
    name: 'Empty Chamber',
    nameTh: 'ตู้ควบคุมอุณหภูมิ (ว่าง)',
    deviceType: 'Enclosure',
    measurementType: 'temperature_multi_sensor',
    unit: '°C',
    sensorCount: 5,
    readingsPerPoint: 30,
    defaultCalPoints: 1,
    hasTimeCheck: false,
    referenceStandards: ['W_TEM_005', 'W_TEM_006', 'W_TEM_007'],
    formFields: []
  },
  {
    code: 'TEM-001-2',
    name: 'Loaded Chamber',
    nameTh: 'ตู้ควบคุมอุณหภูมิ (มีโหลด)',
    deviceType: 'Enclosure',
    measurementType: 'temperature_multi_sensor',
    unit: '°C',
    sensorCount: 5,
    readingsPerPoint: 30,
    defaultCalPoints: 1,
    hasTimeCheck: false,
    referenceStandards: ['W_TEM_005', 'W_TEM_006', 'W_TEM_007'],
    formFields: []
  },
  {
    code: 'TEM-002',
    name: 'Liquid Bath',
    nameTh: 'อ่างควบคุมอุณหภูมิ',
    deviceType: 'Liquid Bath',
    measurementType: 'temperature_multi_sensor',
    unit: '°C',
    sensorCount: 5,
    readingsPerPoint: 30,
    defaultCalPoints: 1,
    hasTimeCheck: false,
    referenceStandards: ['W_TEM_005', 'W_TEM_006', 'W_TEM_007'],
    formFields: []
  },
  {
    code: 'TEM-003-1',
    name: 'DTM Permanent',
    nameTh: 'ดิจิทัลเทอร์โมมิเตอร์ (ถาวร)',
    deviceType: 'DTM',
    measurementType: 'temperature',
    unit: '°C',
    sensorCount: 1,  // per probe, but can have 1-10 probes
    readingsPerPoint: 4,
    defaultCalPoints: 3,
    hasTimeCheck: false,
    referenceStandards: ['S-TEM-001', 'W-TEM-001'],
    formFields: [
      { key: 'sensorType', label: 'Sensor Type', labelTh: 'ชนิด Sensor', type: 'text' },
      { key: 'probeCount', label: 'Number of Probes', labelTh: 'จำนวน Probe', type: 'number' },
    ]
  },
  {
    code: 'TEM-003-2',
    name: 'DTM Onsite',
    nameTh: 'ดิจิทัลเทอร์โมมิเตอร์ (ออกสถานที่)',
    deviceType: 'DTM',
    measurementType: 'temperature',
    unit: '°C',
    sensorCount: 1,
    readingsPerPoint: 4,
    defaultCalPoints: 3,
    hasTimeCheck: false,
    referenceStandards: ['S-TEM-001', 'W-TEM-001'],
    formFields: [
      { key: 'sensorType', label: 'Sensor Type', labelTh: 'ชนิด Sensor', type: 'text' },
    ]
  },
  {
    code: 'TEM-003-3',
    name: 'Type K',
    nameTh: 'Thermocouple Type K',
    deviceType: 'DTM',
    measurementType: 'temperature',
    unit: '°C',
    sensorCount: 1,
    readingsPerPoint: 4,
    defaultCalPoints: 3,
    hasTimeCheck: false,
    referenceStandards: ['S-TEM-001', 'W-TEM-001'],
    formFields: [
      { key: 'sensorType', label: 'Sensor Type', labelTh: 'ชนิด Sensor', type: 'text' },
    ]
  },
  {
    code: 'TEM-004',
    name: 'Autoclave',
    nameTh: 'หม้อแรงดัน (Autoclave)',
    deviceType: 'Autoclave',
    measurementType: 'temperature_multi_sensor',
    unit: '°C',
    sensorCount: 5,
    readingsPerPoint: 30,
    defaultCalPoints: 1,
    hasTimeCheck: false,
    referenceStandards: ['W_TEM_005', 'W_TEM_006', 'W_TEM_007'],
    formFields: []
  },
]

export function getIsoMethod(code: string): IsoMethodConfig | undefined {
  return ISO_METHODS.find(m => m.code === code)
}

export function getIsoMethodsByDeviceType(deviceType: string): IsoMethodConfig[] {
  return ISO_METHODS.filter(m => m.deviceType === deviceType)
}
