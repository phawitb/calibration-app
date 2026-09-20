import { formatCalibrationValue } from './uncertainty'

/** Round upward at the displayed precision, without changing calculation values. */
export function formatPdfUncertainty(value: number | null | undefined, time = false): string {
  if (value == null || !Number.isFinite(value)) return '-'
  // Decimal exponent shifting avoids e.g. 1.1 * 100 becoming 110.00000000000001.
  const [mantissa, exponent = '0'] = String(value).split('e')
  const rounded = Math.ceil(Number(`${mantissa}e${Number(exponent) + 2}`)) / 100
  return time ? formatCalibrationValue(rounded, true, 2) : rounded.toFixed(2)
}
