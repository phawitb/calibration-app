// Seed data for IsoMethodTemplate — derived from Excel analysis of old-methods/
// Each entry matches the exact uncertainty budget and configuration from the P-WI procedure files

import type { IIsoMethodTemplate } from '@/models/IsoMethodTemplate'

type Seed = Omit<IIsoMethodTemplate, keyof import('mongoose').Document | 'createdAt' | 'updatedAt'>

const SQRT3 = 1.732050808
const SQRT6 = 2.449489743

export const ISO_METHOD_SEEDS: Seed[] = [
  // ═══════════════════════════════════════════════════════════════════════
  // ELC-001: Centrifuge
  // ═══════════════════════════════════════════════════════════════════════
  {
    code: 'ELC-001',
    name: 'Centrifuge',
    nameTh: 'เครื่องหมุนเหวี่ยง',
    deviceType: 'Centrifuge',
    measurementPattern: 'comparison',
    unit: 'r/min',
    procedureRef: 'WI-09-ELC-001',
    methodStandard: 'Comparison with Standard Hand Tachometer',

    gridConfig: {
      sensorCountFixed: 1,
      sensorCountMin: 1,
      sensorCountMax: 1,
      sensorCountDynamic: false,
      sensorLabels: [],
      readingsPerPoint: 4,
      defaultCalPoints: 6,
      hasStdReadingColumn: true,
      hasDualChannel: false,
    },

    formFields: [
      { key: 'uucResolution', label: 'UUC Resolution (r/min)', labelTh: 'ความละเอียด UUC (r/min)', type: 'number', required: true },
      { key: 'condition', label: 'Condition', labelTh: 'สภาพเครื่อง', type: 'text' },
    ],

    uncertaintySources: [
      {
        key: 'dTCal_Std', name: 'Calibration of STD', nameTh: 'ค่าความไม่แน่นอนจากการสอบเทียบ STD',
        type: 'B', distribution: 'normal', divisor: 2, sensitivityCoefficient: 1,
        valueSource: { type: 'from_std_instrument', stdField: 'uTStd' },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 1,
      },
      {
        key: 'dT_Drift_Std', name: 'Drift of STD', nameTh: 'ค่า Drift ของ STD',
        type: 'B', distribution: 'triangular', divisor: SQRT6, sensitivityCoefficient: 1,
        valueSource: { type: 'from_std_instrument', stdField: 'uTDrif' },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 2,
      },
      {
        key: 'dT_Res_Std', name: 'Resolution of STD', nameTh: 'ความละเอียดของ STD',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 1,
        valueSource: { type: 'from_std_instrument', stdField: 'uTResStd' },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 3,
      },
      {
        key: 'dT_Res_UUC', name: 'Resolution of UUC', nameTh: 'ความละเอียดของ UUC',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 1,
        valueSource: { type: 'from_uuc_resolution' },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 4,
      },
      {
        key: 'dT_Int', name: 'Interpolation of STD', nameTh: 'ค่า Interpolation ของ STD',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 1,
        valueSource: { type: 'from_std_instrument', stdField: 'uTInt' },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 5,
      },
      {
        key: 'dT_Rep_Std', name: 'Repeatability of STD', nameTh: 'ความสามารถทำซ้ำของ STD',
        type: 'A', distribution: 'normal', divisor: 1, sensitivityCoefficient: 1,
        valueSource: { type: 'computed_repeatability', target: 'std' },
        degreesOfFreedom: 'n-1', enabled: true, sortOrder: 6,
      },
      {
        key: 'dT_Rep_UUC', name: 'Repeatability of UUC', nameTh: 'ความสามารถทำซ้ำของ UUC',
        type: 'A', distribution: 'normal', divisor: 1, sensitivityCoefficient: 1,
        valueSource: { type: 'computed_repeatability', target: 'uuc' },
        degreesOfFreedom: 'n-1', enabled: true, sortOrder: 7,
      },
    ],

    cmcTable: [
      { rangeMin: -99999, rangeMax: 1000, value: 1.2, label: '< 1,000 r/min' },
      { rangeMin: 1000, rangeMax: 5000, value: 2.4, label: '1,000 - 5,000 r/min' },
      { rangeMin: 5000, rangeMax: 99999, value: 2.5, label: '> 5,000 r/min' },
    ],

    correctionMethod: 'linear_interpolation',
    hasTimeCheck: true,
    hasCalRef: false,
    hasPressure: false,
    calibrationPlace: 'both',
    referenceStandards: ['W-ELC-001', 'W-ELC-002', 'W-ELC-003'],
    envTempScope: { min: 20, max: 30 },
    envHumidityScope: { min: 40, max: 80 },
    hasLineVoltage: false,
    isActive: true,
    sortOrder: 1,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // TEM-001-1: Empty Chamber (TLAS G-20)
  // ═══════════════════════════════════════════════════════════════════════
  {
    code: 'TEM-001-1',
    name: 'Empty Chamber (TLAS G-20)',
    nameTh: 'ตู้ควบคุมอุณหภูมิ ว่าง (TLAS G-20)',
    deviceType: 'Enclosure',
    measurementPattern: 'spatial_uniformity',
    unit: '°C',
    procedureRef: 'WI-09-TEM-001',
    methodStandard: 'TLAS G-20 under no load condition',

    gridConfig: {
      sensorCountFixed: 9,
      sensorCountMin: 5,
      sensorCountMax: 15,
      sensorCountDynamic: false,
      sensorLabels: ['#1 (corner)', '#2 (corner)', '#3 (corner)', '#4 (corner)', '#5 (corner)', '#6 (corner)', '#7 (corner)', '#8 (corner)', '#9 (center)'],
      readingsPerPoint: 30,
      defaultCalPoints: 1,
      hasStdReadingColumn: false,
      hasDualChannel: false,
    },

    formFields: [
      { key: 'chamberWidth', label: 'Chamber Width (cm)', labelTh: 'กว้าง (cm)', type: 'number', group: 'chamber' },
      { key: 'chamberLength', label: 'Chamber Length (cm)', labelTh: 'ยาว (cm)', type: 'number', group: 'chamber' },
      { key: 'chamberHeight', label: 'Chamber Height (cm)', labelTh: 'สูง (cm)', type: 'number', group: 'chamber' },
      { key: 'uucResolution', label: 'UUC Resolution (°C)', labelTh: 'ความละเอียด UUC (°C)', type: 'number', required: true },
    ],

    uncertaintySources: [
      {
        key: 'dTCal_Std', name: 'Calibration of STD', nameTh: 'ค่าความไม่แน่นอนจากการสอบเทียบ STD',
        type: 'B', distribution: 'normal', divisor: 2, sensitivityCoefficient: 1,
        valueSource: { type: 'fixed', fixedValue: 0.05 },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 1,
      },
      {
        key: 'dT_Drift_Std', name: 'Drift of STD', nameTh: 'ค่า Drift ของ STD',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 1,
        valueSource: { type: 'fixed', fixedValue: 0.15 },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 2,
      },
      {
        key: 'dT_Int', name: 'Interpolation (Residuals)', nameTh: 'ค่า Interpolation (Residuals)',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 1,
        valueSource: { type: 'polynomial_residual' },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 3,
      },
      {
        key: 'dT_Res_Std', name: 'Resolution of STD', nameTh: 'ความละเอียดของ STD',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 1,
        valueSource: { type: 'fixed', fixedValue: 0.005 },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 4,
      },
      {
        key: 'dT_Self_Heat', name: 'Self-heating of STD', nameTh: 'Self-heating ของ STD',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 1,
        valueSource: { type: 'fixed', fixedValue: 0.05 },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 5,
      },
      {
        key: 'dT_TC_Std', name: 'Temperature Coefficient', nameTh: 'สัมประสิทธิ์อุณหภูมิ',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 1,
        valueSource: { type: 'computed_from_data', expression: 'tempCoefficient' },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 6,
      },
      {
        key: 'dT_Stab', name: 'Stability of Chamber', nameTh: 'เสถียรภาพของตู้',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 1,
        valueSource: { type: 'computed_stability' },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 7,
      },
      {
        key: 'dT_Load', name: 'Loading Effect', nameTh: 'ผลจากโหลด',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 1,
        valueSource: { type: 'computed_uniformity', multiplier: 0.2 },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 8,
      },
      {
        key: 'dT_Rad', name: 'Radiation Effect', nameTh: 'ผลจากการแผ่รังสี',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 1,
        valueSource: { type: 'fixed', fixedValue: 0.01196 },  // 0.0598 * 0.2
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 9,
      },
      {
        key: 'dT_Res_UUC', name: 'Resolution of UUC', nameTh: 'ความละเอียดของ UUC',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 1,
        valueSource: { type: 'from_uuc_resolution' },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 10,
      },
      {
        key: 'dT_Rep_UUC', name: 'Repeatability of UUC', nameTh: 'ความสามารถทำซ้ำของ UUC',
        type: 'A', distribution: 'normal', divisor: 1, sensitivityCoefficient: 1,
        valueSource: { type: 'computed_repeatability', target: 'uuc' },
        degreesOfFreedom: 'n-1', enabled: true, sortOrder: 11,
      },
    ],

    cmcTable: [
      { rangeMin: -99999, rangeMax: 0, value: 0.22, label: '< 0°C' },
      { rangeMin: 0, rangeMax: 40, value: 0.29, label: '0 - 40°C' },
      { rangeMin: 40, rangeMax: 99999, value: 1.0, label: '> 40°C' },
    ],

    correctionMethod: 'polynomial',
    hasTimeCheck: false,
    hasCalRef: false,
    hasPressure: false,
    calibrationPlace: 'onsite_only',
    referenceStandards: ['W-TEM-005', 'W-TEM-006', 'W-TEM-007'],
    envTempScope: { min: 18, max: 35 },
    envHumidityScope: { min: 40, max: 80 },
    hasLineVoltage: true,
    isActive: true,
    sortOrder: 10,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // TEM-001-2: Loaded Chamber (DKD-R 5-7)
  // ═══════════════════════════════════════════════════════════════════════
  {
    code: 'TEM-001-2',
    name: 'Loaded Chamber (DKD-R 5-7)',
    nameTh: 'ตู้ควบคุมอุณหภูมิ มีโหลด (DKD-R 5-7)',
    deviceType: 'Enclosure',
    measurementPattern: 'spatial_uniformity',
    unit: '°C',
    procedureRef: 'WI-09-TEM-001',
    methodStandard: 'DKD-R 5-7 under loaded condition',

    gridConfig: {
      sensorCountFixed: 9,
      sensorCountMin: 5,
      sensorCountMax: 15,
      sensorCountDynamic: false,
      sensorLabels: ['#1 (corner)', '#2 (corner)', '#3 (corner)', '#4 (corner)', '#5 (corner)', '#6 (corner)', '#7 (corner)', '#8 (corner)', '#9 (center)'],
      readingsPerPoint: 30,
      defaultCalPoints: 1,
      hasStdReadingColumn: false,
      hasDualChannel: false,
    },

    formFields: [
      { key: 'chamberWidth', label: 'Chamber Width (cm)', labelTh: 'กว้าง (cm)', type: 'number', group: 'chamber' },
      { key: 'chamberLength', label: 'Chamber Length (cm)', labelTh: 'ยาว (cm)', type: 'number', group: 'chamber' },
      { key: 'chamberHeight', label: 'Chamber Height (cm)', labelTh: 'สูง (cm)', type: 'number', group: 'chamber' },
      { key: 'uucResolution', label: 'UUC Resolution (°C)', labelTh: 'ความละเอียด UUC (°C)', type: 'number', required: true },
    ],

    uncertaintySources: [
      {
        key: 'dTCal_Std', name: 'Calibration of STD', nameTh: 'ค่าความไม่แน่นอนจากการสอบเทียบ STD',
        type: 'B', distribution: 'normal', divisor: 2, sensitivityCoefficient: 1,
        valueSource: { type: 'fixed', fixedValue: 0.05 },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 1,
      },
      {
        key: 'dT_Drift_Std', name: 'Drift of STD', nameTh: 'ค่า Drift ของ STD',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 1,
        valueSource: { type: 'fixed', fixedValue: 0.15 },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 2,
      },
      {
        key: 'dT_Int', name: 'Interpolation (Residuals)', nameTh: 'ค่า Interpolation (Residuals)',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 1,
        valueSource: { type: 'polynomial_residual' },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 3,
      },
      {
        key: 'dT_Res_Std', name: 'Resolution of STD', nameTh: 'ความละเอียดของ STD',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 1,
        valueSource: { type: 'fixed', fixedValue: 0.005 },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 4,
      },
      {
        key: 'dT_Self_Heat', name: 'Self-heating of STD', nameTh: 'Self-heating ของ STD',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 1,
        valueSource: { type: 'fixed', fixedValue: 0.05 },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 5,
      },
      {
        key: 'dT_TC_Std', name: 'Temperature Coefficient', nameTh: 'สัมประสิทธิ์อุณหภูมิ',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 1,
        valueSource: { type: 'computed_from_data', expression: 'tempCoefficient' },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 6,
      },
      {
        key: 'dT_Stab', name: 'Stability of Chamber', nameTh: 'เสถียรภาพของตู้',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 1,
        valueSource: { type: 'computed_stability' },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 7,
      },
      {
        key: 'dT_Uni', name: 'Uniformity of Chamber', nameTh: 'ความสม่ำเสมอของตู้',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 1,
        valueSource: { type: 'computed_uniformity' },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 8,
      },
      {
        key: 'dT_Load', name: 'Loading Effect', nameTh: 'ผลจากโหลด',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 1,
        valueSource: { type: 'computed_uniformity', multiplier: 0.2 },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 9,
      },
      {
        key: 'dT_Rad', name: 'Radiation Effect', nameTh: 'ผลจากการแผ่รังสี',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 1,
        valueSource: { type: 'fixed', fixedValue: 0.01196 },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 10,
      },
      {
        key: 'dT_Res_UUC', name: 'Resolution of UUC', nameTh: 'ความละเอียดของ UUC',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 1,
        valueSource: { type: 'from_uuc_resolution' },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 11,
      },
      {
        key: 'dT_Rep_UUC', name: 'Repeatability of UUC', nameTh: 'ความสามารถทำซ้ำของ UUC',
        type: 'A', distribution: 'normal', divisor: 1, sensitivityCoefficient: 1,
        valueSource: { type: 'computed_repeatability', target: 'uuc' },
        degreesOfFreedom: 'n-1', enabled: true, sortOrder: 12,
      },
    ],

    cmcTable: [
      { rangeMin: -99999, rangeMax: 0, value: 1.1, label: '< 0°C' },
      { rangeMin: 0, rangeMax: 40, value: 0.66, label: '0 - 40°C' },
    ],

    correctionMethod: 'polynomial',
    hasTimeCheck: false,
    hasCalRef: false,
    hasPressure: false,
    calibrationPlace: 'onsite_only',
    referenceStandards: ['W-TEM-005', 'W-TEM-006', 'W-TEM-007'],
    envTempScope: { min: 18, max: 35 },
    envHumidityScope: { min: 40, max: 80 },
    hasLineVoltage: true,
    isActive: true,
    sortOrder: 11,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // TEM-002: Liquid Bath
  // ═══════════════════════════════════════════════════════════════════════
  {
    code: 'TEM-002',
    name: 'Liquid Bath',
    nameTh: 'อ่างควบคุมอุณหภูมิ',
    deviceType: 'Liquid Bath',
    measurementPattern: 'spatial_uniformity',
    unit: '°C',
    procedureRef: 'WI-09-TEM-002',
    methodStandard: 'ASTM E 715-80',

    gridConfig: {
      sensorCountFixed: 5,
      sensorCountMin: 3,
      sensorCountMax: 10,
      sensorCountDynamic: false,
      sensorLabels: ['#1 (corner)', '#2 (corner)', '#3 (corner)', '#4 (corner)', '#5 (center)'],
      readingsPerPoint: 30,
      defaultCalPoints: 1,
      hasStdReadingColumn: false,
      hasDualChannel: false,
    },

    formFields: [
      { key: 'chamberWidth', label: 'Chamber Width (cm)', labelTh: 'กว้าง (cm)', type: 'number', group: 'chamber' },
      { key: 'chamberLength', label: 'Chamber Length (cm)', labelTh: 'ยาว (cm)', type: 'number', group: 'chamber' },
      { key: 'chamberHeight', label: 'Chamber Height (cm)', labelTh: 'สูง (cm)', type: 'number', group: 'chamber' },
      { key: 'waterLevel', label: 'Water Level (cm)', labelTh: 'ระดับน้ำ (cm)', type: 'number' },
      { key: 'uucResolution', label: 'UUC Resolution (°C)', labelTh: 'ความละเอียด UUC (°C)', type: 'number', required: true },
    ],

    uncertaintySources: [
      {
        key: 'dTCal_Std', name: 'Calibration of STD', nameTh: 'ค่าความไม่แน่นอนจากการสอบเทียบ STD',
        type: 'B', distribution: 'normal', divisor: 2, sensitivityCoefficient: 1,
        valueSource: { type: 'fixed', fixedValue: 0.05 },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 1,
      },
      {
        key: 'dT_Drift_Std', name: 'Drift of STD', nameTh: 'ค่า Drift ของ STD',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 1,
        valueSource: { type: 'fixed', fixedValue: 0.15 },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 2,
      },
      {
        key: 'dT_Int', name: 'Interpolation (Residuals)', nameTh: 'ค่า Interpolation (Residuals)',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 1,
        valueSource: { type: 'polynomial_residual' },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 3,
      },
      {
        key: 'dT_Res_Std', name: 'Resolution of STD', nameTh: 'ความละเอียดของ STD',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 1,
        valueSource: { type: 'fixed', fixedValue: 0.005 },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 4,
      },
      {
        key: 'dT_Stem', name: 'Stem/Heat Conduction', nameTh: 'การนำความร้อนทางก้าน',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 1,
        valueSource: { type: 'fixed', fixedValue: 0 },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 5,
      },
      {
        key: 'dT_TC_Std', name: 'Thermoelectric Effect', nameTh: 'ผลทางเทอร์โมอิเล็กทริก',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 1,
        valueSource: { type: 'fixed', fixedValue: 0 },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 6,
      },
      {
        key: 'dT_Stab', name: 'Stability of Bath', nameTh: 'เสถียรภาพของอ่าง',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 1,
        valueSource: { type: 'computed_stability' },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 7,
      },
      {
        key: 'dT_Vert', name: 'Vertical Uniformity', nameTh: 'ความสม่ำเสมอแนวตั้ง',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 1,
        valueSource: { type: 'computed_vertical_uniformity' },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 8,
      },
      {
        key: 'dT_Res_UUC', name: 'Resolution of UUC', nameTh: 'ความละเอียดของ UUC',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 1,
        valueSource: { type: 'from_uuc_resolution' },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 9,
      },
      {
        key: 'dT_Rep_UUC', name: 'Repeatability of UUC', nameTh: 'ความสามารถทำซ้ำของ UUC',
        type: 'A', distribution: 'normal', divisor: 1, sensitivityCoefficient: 1,
        valueSource: { type: 'computed_repeatability', target: 'uuc' },
        degreesOfFreedom: 'n-1', enabled: true, sortOrder: 10,
      },
    ],

    cmcTable: [
      { rangeMin: -99999, rangeMax: 99999, value: 0.23, label: 'ทุกช่วง' },
    ],

    correctionMethod: 'polynomial',
    hasTimeCheck: false,
    hasCalRef: false,
    hasPressure: false,
    calibrationPlace: 'onsite_only',
    referenceStandards: ['W-TEM-005', 'W-TEM-006', 'W-TEM-007'],
    envTempScope: { min: 18, max: 30 },
    envHumidityScope: { min: 40, max: 80 },
    hasLineVoltage: true,
    isActive: true,
    sortOrder: 20,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // TEM-003-1: DTM Permanent (SPRT in liquid bath)
  // ═══════════════════════════════════════════════════════════════════════
  {
    code: 'TEM-003-1',
    name: 'DTM Permanent',
    nameTh: 'ดิจิทัลเทอร์โมมิเตอร์ (ถาวร)',
    deviceType: 'DTM',
    measurementPattern: 'comparison_with_ref_bath',
    unit: '°C',
    procedureRef: 'WI-09-TEM-003',
    methodStandard: 'Comparison with SPRT in liquid bath',

    gridConfig: {
      sensorCountFixed: undefined,
      sensorCountMin: 1,
      sensorCountMax: 10,
      sensorCountDynamic: true,
      sensorLabels: [],
      readingsPerPoint: 5,
      defaultCalPoints: 3,
      hasStdReadingColumn: true,
      hasDualChannel: false,
    },

    formFields: [
      { key: 'sensorType', label: 'Sensor Type', labelTh: 'ชนิด Sensor', type: 'text', required: true },
      { key: 'probeCount', label: 'Number of Probes', labelTh: 'จำนวน Probe', type: 'number', required: true, defaultValue: 1 },
      { key: 'immersionDepth', label: 'Immersion Depth (cm)', labelTh: 'ความลึกจุ่ม (cm)', type: 'number' },
      { key: 'uucResolution', label: 'UUC Resolution (°C)', labelTh: 'ความละเอียด UUC (°C)', type: 'number', required: true },
    ],

    uncertaintySources: [
      {
        key: 'dTSp', name: 'SPRT Calibration', nameTh: 'ค่าความไม่แน่นอนจาก SPRT',
        type: 'B', distribution: 'normal', divisor: 2, sensitivityCoefficient: 1,
        valueSource: { type: 'fixed', fixedValue: 0.003 },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 1,
      },
      {
        key: 'dT_Drift_Std', name: 'Drift of STD', nameTh: 'ค่า Drift ของ STD',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 10,
        valueSource: { type: 'fixed', fixedValue: 0.0016 },  // in Ohms
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 2,
      },
      {
        key: 'dT_Int', name: 'Interpolation', nameTh: 'ค่า Interpolation',
        type: 'B', distribution: 'rectangular', divisor: 2, sensitivityCoefficient: 10,
        valueSource: { type: 'fixed', fixedValue: 0.001 },  // in Ohms
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 3,
      },
      {
        key: 'dT_Self_Heat', name: 'Self-heating (SPRT)', nameTh: 'Self-heating ของ SPRT',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 10,
        valueSource: { type: 'fixed', fixedValue: 0.001 },  // in Ohms
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 4,
      },
      {
        key: 'dT_Res_Std', name: 'Resolution of STD', nameTh: 'ความละเอียดของ STD',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 1,
        valueSource: { type: 'computed_from_data', expression: 'stdResolution' },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 5,
      },
      {
        key: 'dT_Uni', name: 'Bath Uniformity', nameTh: 'ความสม่ำเสมอของอ่าง',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 1,
        valueSource: { type: 'computed_uniformity' },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 6,
      },
      {
        key: 'dT_Stab', name: 'Bath Stability', nameTh: 'เสถียรภาพของอ่าง',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 1,
        valueSource: { type: 'computed_stability' },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 7,
      },
      {
        key: 'dT_Res_UUC', name: 'Resolution of UUC', nameTh: 'ความละเอียดของ UUC',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 1,
        valueSource: { type: 'from_uuc_resolution' },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 8,
      },
      {
        key: 'dT_STS', name: 'Short-term Stability', nameTh: 'เสถียรภาพระยะสั้น',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 1,
        valueSource: { type: 'computed_from_data', expression: 'shortTermStability' },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 9,
      },
      {
        key: 'dT_Stem', name: 'Heat Conduction', nameTh: 'การนำความร้อนทางก้าน',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 1,
        valueSource: { type: 'fixed', fixedValue: 0 },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 10,
      },
      {
        key: 'dT_Rep_Std', name: 'Repeatability of STD', nameTh: 'ความสามารถทำซ้ำของ STD',
        type: 'A', distribution: 'normal', divisor: 1, sensitivityCoefficient: 1,
        valueSource: { type: 'computed_repeatability', target: 'std' },
        degreesOfFreedom: 9, enabled: true, sortOrder: 11,
      },
      {
        key: 'dT_Rep_UUC', name: 'Repeatability of UUC', nameTh: 'ความสามารถทำซ้ำของ UUC',
        type: 'A', distribution: 'normal', divisor: 1, sensitivityCoefficient: 1,
        valueSource: { type: 'computed_repeatability', target: 'uuc' },
        degreesOfFreedom: 9, enabled: true, sortOrder: 12,
      },
    ],

    cmcTable: [
      { rangeMin: -99999, rangeMax: 0, value: 0.04, label: '< 0°C' },
      { rangeMin: 0, rangeMax: 99999, value: 0.03, label: '>= 0°C' },
    ],

    correctionMethod: 'polynomial',
    hasTimeCheck: false,
    hasCalRef: true,
    hasPressure: false,
    calibrationPlace: 'both',
    referenceStandards: ['S-TEM-001', 'W-TEM-001'],
    envTempScope: { min: 18, max: 28 },
    envHumidityScope: { min: 40, max: 80 },
    hasLineVoltage: false,
    isActive: true,
    sortOrder: 30,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // TEM-003-2: DTM Onsite
  // ═══════════════════════════════════════════════════════════════════════
  {
    code: 'TEM-003-2',
    name: 'DTM Onsite',
    nameTh: 'ดิจิทัลเทอร์โมมิเตอร์ (ออกสถานที่)',
    deviceType: 'DTM',
    measurementPattern: 'comparison_with_ref_bath',
    unit: '°C',
    procedureRef: 'WI-09-TEM-003',
    methodStandard: 'Comparison with SPRT in liquid bath (field)',

    gridConfig: {
      sensorCountFixed: 1,
      sensorCountMin: 1,
      sensorCountMax: 1,
      sensorCountDynamic: false,
      sensorLabels: [],
      readingsPerPoint: 5,
      defaultCalPoints: 3,
      hasStdReadingColumn: true,
      hasDualChannel: false,
    },

    formFields: [
      { key: 'sensorType', label: 'Sensor Type', labelTh: 'ชนิด Sensor', type: 'text', required: true },
      { key: 'immersionDepth', label: 'Immersion Depth (cm)', labelTh: 'ความลึกจุ่ม (cm)', type: 'number' },
      { key: 'uucResolution', label: 'UUC Resolution (°C)', labelTh: 'ความละเอียด UUC (°C)', type: 'number', required: true },
    ],

    // Same uncertainty sources as DTM Permanent
    uncertaintySources: [
      {
        key: 'dTSp', name: 'SPRT Calibration', nameTh: 'ค่าความไม่แน่นอนจาก SPRT',
        type: 'B', distribution: 'normal', divisor: 2, sensitivityCoefficient: 1,
        valueSource: { type: 'fixed', fixedValue: 0.003 },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 1,
      },
      {
        key: 'dT_Drift_Std', name: 'Drift of STD', nameTh: 'ค่า Drift ของ STD',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 10,
        valueSource: { type: 'fixed', fixedValue: 0.0016 },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 2,
      },
      {
        key: 'dT_Int', name: 'Interpolation', nameTh: 'ค่า Interpolation',
        type: 'B', distribution: 'rectangular', divisor: 2, sensitivityCoefficient: 10,
        valueSource: { type: 'fixed', fixedValue: 0.001 },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 3,
      },
      {
        key: 'dT_Self_Heat', name: 'Self-heating (SPRT)', nameTh: 'Self-heating ของ SPRT',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 10,
        valueSource: { type: 'fixed', fixedValue: 0.001 },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 4,
      },
      {
        key: 'dT_Res_Std', name: 'Resolution of STD', nameTh: 'ความละเอียดของ STD',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 1,
        valueSource: { type: 'computed_from_data', expression: 'stdResolution' },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 5,
      },
      {
        key: 'dT_Uni', name: 'Bath Uniformity', nameTh: 'ความสม่ำเสมอของอ่าง',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 1,
        valueSource: { type: 'computed_uniformity' },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 6,
      },
      {
        key: 'dT_Stab', name: 'Bath Stability', nameTh: 'เสถียรภาพของอ่าง',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 1,
        valueSource: { type: 'computed_stability' },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 7,
      },
      {
        key: 'dT_Res_UUC', name: 'Resolution of UUC', nameTh: 'ความละเอียดของ UUC',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 1,
        valueSource: { type: 'from_uuc_resolution' },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 8,
      },
      {
        key: 'dT_STS', name: 'Short-term Stability', nameTh: 'เสถียรภาพระยะสั้น',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 1,
        valueSource: { type: 'computed_from_data', expression: 'shortTermStability' },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 9,
      },
      {
        key: 'dT_Stem', name: 'Heat Conduction', nameTh: 'การนำความร้อนทางก้าน',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 1,
        valueSource: { type: 'fixed', fixedValue: 0 },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 10,
      },
      {
        key: 'dT_Rep_Std', name: 'Repeatability of STD', nameTh: 'ความสามารถทำซ้ำของ STD',
        type: 'A', distribution: 'normal', divisor: 1, sensitivityCoefficient: 1,
        valueSource: { type: 'computed_repeatability', target: 'std' },
        degreesOfFreedom: 9, enabled: true, sortOrder: 11,
      },
      {
        key: 'dT_Rep_UUC', name: 'Repeatability of UUC', nameTh: 'ความสามารถทำซ้ำของ UUC',
        type: 'A', distribution: 'normal', divisor: 1, sensitivityCoefficient: 1,
        valueSource: { type: 'computed_repeatability', target: 'uuc' },
        degreesOfFreedom: 9, enabled: true, sortOrder: 12,
      },
    ],

    cmcTable: [
      { rangeMin: -99999, rangeMax: 0, value: 0.04, label: '< 0°C' },
      { rangeMin: 0, rangeMax: 99999, value: 0.03, label: '>= 0°C' },
    ],

    correctionMethod: 'polynomial',
    hasTimeCheck: false,
    hasCalRef: true,
    hasPressure: false,
    calibrationPlace: 'both',
    referenceStandards: ['S-TEM-001', 'W-TEM-001'],
    envTempScope: { min: 18, max: 28 },
    envHumidityScope: { min: 40, max: 80 },
    hasLineVoltage: false,
    isActive: true,
    sortOrder: 31,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // TEM-003-3: Type K Thermocouple
  // ═══════════════════════════════════════════════════════════════════════
  {
    code: 'TEM-003-3',
    name: 'Type K Thermocouple',
    nameTh: 'Thermocouple Type K',
    deviceType: 'DTM',
    measurementPattern: 'comparison_with_ref_bath',
    unit: '°C',
    procedureRef: 'WI-09-TEM-003',
    methodStandard: 'Comparison with SPRT in liquid bath (Type K)',

    gridConfig: {
      sensorCountFixed: 1,
      sensorCountMin: 1,
      sensorCountMax: 1,
      sensorCountDynamic: false,
      sensorLabels: [],
      readingsPerPoint: 5,
      defaultCalPoints: 3,
      hasStdReadingColumn: true,
      hasDualChannel: false,
    },

    formFields: [
      { key: 'sensorType', label: 'Sensor Type', labelTh: 'ชนิด Sensor', type: 'text', required: true, defaultValue: 'Type K' },
      { key: 'wireCondition', label: 'Wire Condition', labelTh: 'สภาพสาย', type: 'select', options: ['new', 'used'], required: true, defaultValue: 'new' },
      { key: 'immersionDepth', label: 'Immersion Depth (cm)', labelTh: 'ความลึกจุ่ม (cm)', type: 'number' },
      { key: 'uucResolution', label: 'UUC Resolution (°C)', labelTh: 'ความละเอียด UUC (°C)', type: 'number', required: true },
    ],

    uncertaintySources: [
      {
        key: 'dTSp', name: 'SPRT Calibration', nameTh: 'ค่าความไม่แน่นอนจาก SPRT',
        type: 'B', distribution: 'normal', divisor: 2, sensitivityCoefficient: 1,
        valueSource: { type: 'fixed', fixedValue: 0.003 },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 1,
      },
      {
        key: 'dT_Drift_Std', name: 'Drift of STD', nameTh: 'ค่า Drift ของ STD',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 10,
        valueSource: { type: 'fixed', fixedValue: 0.0016 },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 2,
      },
      {
        key: 'dT_Int', name: 'Interpolation', nameTh: 'ค่า Interpolation',
        type: 'B', distribution: 'rectangular', divisor: 2, sensitivityCoefficient: 10,
        valueSource: { type: 'fixed', fixedValue: 0.001 },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 3,
      },
      {
        key: 'dT_Self_Heat', name: 'Self-heating (SPRT)', nameTh: 'Self-heating ของ SPRT',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 10,
        valueSource: { type: 'fixed', fixedValue: 0.001 },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 4,
      },
      {
        key: 'dT_Res_Std', name: 'Resolution of STD', nameTh: 'ความละเอียดของ STD',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 1,
        valueSource: { type: 'computed_from_data', expression: 'stdResolution' },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 5,
      },
      {
        key: 'dT_Uni', name: 'Bath Uniformity', nameTh: 'ความสม่ำเสมอของอ่าง',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 1,
        valueSource: { type: 'computed_uniformity' },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 6,
      },
      {
        key: 'dT_Stab', name: 'Bath Stability', nameTh: 'เสถียรภาพของอ่าง',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 1,
        valueSource: { type: 'computed_stability' },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 7,
      },
      {
        key: 'dT_Res_UUC', name: 'Resolution of UUC', nameTh: 'ความละเอียดของ UUC',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 1,
        valueSource: { type: 'from_uuc_resolution' },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 8,
      },
      {
        key: 'dT_IRJ', name: 'Internal Reference Junction', nameTh: 'Internal Reference Junction',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 1,
        valueSource: { type: 'computed_from_data', expression: 'irjError' },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 9,
      },
      {
        key: 'dT_Inh', name: 'Inhomogeneity', nameTh: 'ความไม่สม่ำเสมอของสาย',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 1,
        valueSource: {
          type: 'conditional',
          conditions: [
            { condition: 'wireCondition=new', value: 0.1 },
            { condition: 'wireCondition=used', value: 0.44 },
          ],
        },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 10,
      },
      {
        key: 'dT_Rep_Std', name: 'Repeatability of STD', nameTh: 'ความสามารถทำซ้ำของ STD',
        type: 'A', distribution: 'normal', divisor: 1, sensitivityCoefficient: 1,
        valueSource: { type: 'computed_repeatability', target: 'std' },
        degreesOfFreedom: 9, enabled: true, sortOrder: 11,
      },
      {
        key: 'dT_Rep_UUC', name: 'Repeatability of UUC', nameTh: 'ความสามารถทำซ้ำของ UUC',
        type: 'A', distribution: 'normal', divisor: 1, sensitivityCoefficient: 1,
        valueSource: { type: 'computed_repeatability', target: 'uuc' },
        degreesOfFreedom: 9, enabled: true, sortOrder: 12,
      },
    ],

    cmcTable: [
      { rangeMin: -99999, rangeMax: 50, value: 0.4, label: '<= 50°C' },
      { rangeMin: 50, rangeMax: 99999, value: 0.5, label: '> 50°C' },
    ],

    correctionMethod: 'polynomial',
    hasTimeCheck: false,
    hasCalRef: true,
    hasPressure: false,
    calibrationPlace: 'both',
    referenceStandards: ['S-TEM-001', 'W-TEM-001'],
    envTempScope: { min: 18, max: 28 },
    envHumidityScope: { min: 40, max: 80 },
    hasLineVoltage: false,
    isActive: true,
    sortOrder: 32,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // TEM-004: Autoclave
  // ═══════════════════════════════════════════════════════════════════════
  {
    code: 'TEM-004',
    name: 'Autoclave',
    nameTh: 'หม้อแรงดัน (Autoclave)',
    deviceType: 'Autoclave',
    measurementPattern: 'spatial_uniformity',
    unit: '°C',
    procedureRef: 'WI-09-TEM-004',
    methodStandard: 'Comparison with calibrated RTD sensors',

    gridConfig: {
      sensorCountFixed: 3,
      sensorCountMin: 3,
      sensorCountMax: 5,
      sensorCountDynamic: false,
      sensorLabels: ['#1 (Drain)', '#2 (Upper Half)', '#3 (Sensor)'],
      readingsPerPoint: 30,
      defaultCalPoints: 1,
      hasStdReadingColumn: false,
      hasDualChannel: false,
    },

    formFields: [
      { key: 'chamberShape', label: 'Chamber Shape', labelTh: 'รูปทรง Chamber', type: 'select', options: ['cylindrical', 'rectangular'] },
      { key: 'chamberDiameter', label: 'Diameter (cm)', labelTh: 'เส้นผ่านศูนย์กลาง (cm)', type: 'number', group: 'chamber' },
      { key: 'chamberDepth', label: 'Depth (cm)', labelTh: 'ความลึก (cm)', type: 'number', group: 'chamber' },
      { key: 'chamberWidth', label: 'Width (cm)', labelTh: 'กว้าง (cm)', type: 'number', group: 'chamber' },
      { key: 'chamberHeight', label: 'Height (cm)', labelTh: 'สูง (cm)', type: 'number', group: 'chamber' },
      { key: 'sterilizationTime', label: 'Sterilization Time (min)', labelTh: 'เวลาทำลายเชื้อ (นาที)', type: 'number' },
      { key: 'uucResolution', label: 'UUC Resolution (°C)', labelTh: 'ความละเอียด UUC (°C)', type: 'number', required: true },
    ],

    uncertaintySources: [
      {
        key: 'dTCal_Std', name: 'Calibration of STD', nameTh: 'ค่าความไม่แน่นอนจากการสอบเทียบ STD',
        type: 'B', distribution: 'normal', divisor: 2, sensitivityCoefficient: 1,
        valueSource: { type: 'fixed', fixedValue: 0.05 },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 1,
      },
      {
        key: 'dT_Drift_Std', name: 'Drift of STD', nameTh: 'ค่า Drift ของ STD',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 1,
        valueSource: { type: 'fixed', fixedValue: 0.15 },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 2,
      },
      {
        key: 'dT_Int', name: 'Interpolation (Residuals)', nameTh: 'ค่า Interpolation (Residuals)',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 1,
        valueSource: { type: 'polynomial_residual' },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 3,
      },
      {
        key: 'dT_Res_Std', name: 'Resolution of STD', nameTh: 'ความละเอียดของ STD',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 1,
        valueSource: { type: 'fixed', fixedValue: 0.005 },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 4,
      },
      {
        key: 'dT_Self_Heat', name: 'Self-heating of STD', nameTh: 'Self-heating ของ STD',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 1,
        valueSource: { type: 'fixed', fixedValue: 0.05 },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 5,
      },
      {
        key: 'dT_TC_Std', name: 'Temperature Coefficient', nameTh: 'สัมประสิทธิ์อุณหภูมิ',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 1,
        valueSource: { type: 'computed_from_data', expression: 'tempCoefficient' },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 6,
      },
      {
        key: 'dT_Stab', name: 'Stability', nameTh: 'เสถียรภาพ',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 1,
        valueSource: { type: 'computed_stability' },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 7,
      },
      {
        key: 'dT_Load', name: 'Loading Effect', nameTh: 'ผลจากโหลด',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 1,
        valueSource: { type: 'computed_uniformity', multiplier: 0.2 },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 8,
      },
      {
        key: 'dT_Rad', name: 'Radiation Effect', nameTh: 'ผลจากการแผ่รังสี',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 1,
        valueSource: { type: 'fixed', fixedValue: 0.01196 },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 9,
      },
      {
        key: 'dT_Res_UUC', name: 'Resolution of UUC', nameTh: 'ความละเอียดของ UUC',
        type: 'B', distribution: 'rectangular', divisor: SQRT3, sensitivityCoefficient: 1,
        valueSource: { type: 'from_uuc_resolution' },
        degreesOfFreedom: 'infinity', enabled: true, sortOrder: 10,
      },
      {
        key: 'dT_Rep_UUC', name: 'Repeatability of UUC', nameTh: 'ความสามารถทำซ้ำของ UUC',
        type: 'A', distribution: 'normal', divisor: 1, sensitivityCoefficient: 1,
        valueSource: { type: 'computed_repeatability', target: 'uuc' },
        degreesOfFreedom: 'n-1', enabled: true, sortOrder: 11,
      },
    ],

    cmcTable: [
      { rangeMin: -99999, rangeMax: 0, value: 0.22, label: '< 0°C' },
      { rangeMin: 0, rangeMax: 40, value: 0.29, label: '0 - 40°C' },
      { rangeMin: 40, rangeMax: 99999, value: 1.0, label: '> 40°C' },
    ],

    correctionMethod: 'polynomial',
    hasTimeCheck: false,
    hasCalRef: false,
    hasPressure: true,
    calibrationPlace: 'onsite_only',
    referenceStandards: ['W-TEM-005', 'W-TEM-006', 'W-TEM-007'],
    envTempScope: { min: 20, max: 40 },
    envHumidityScope: { min: 40, max: 80 },
    hasLineVoltage: true,
    isActive: true,
    sortOrder: 40,
  },
]
