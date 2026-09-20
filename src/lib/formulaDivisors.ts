export const DIVISOR_COMPONENTS = [
  {key:'repeatUuc',label:'uT Rep.(UUC)',fallback:1},
  {key:'repeatStd',label:'uT Rep.(STD)',fallback:1},
  {key:'calibrationStd',label:'uT STD',fallback:2},
  {key:'drift',label:'uT Drif',fallback:Math.sqrt(3)},
  {key:'resolutionStd',label:'uT Res.(STD)',fallback:Math.sqrt(3)},
  {key:'resolutionUuc',label:'uT Res.(UUC)',fallback:Math.sqrt(3)},
  {key:'interpolation',label:'uT Int.',fallback:Math.sqrt(3)},
] as const
export type DivisorKey = typeof DIVISOR_COMPONENTS[number]['key']
export type ComponentDivisors = Partial<Record<DivisorKey, number>>
export function validateComponentDivisors(input: unknown): ComponentDivisors {
  if (input == null || typeof input !== 'object' || Array.isArray(input)) throw new Error('Divisor ต้องเป็นรายการค่าของแต่ละองค์ประกอบ')
  const result: ComponentDivisors = {}
  for (const [key,value] of Object.entries(input)) {
    if (!DIVISOR_COMPONENTS.some(c=>c.key===key) || typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw new Error(`Divisor ${key} ต้องเป็นตัวเลขมากกว่า 0`)
    result[key as DivisorKey]=value
  }
  return result
}
export function resolveComponentDivisors(formula: {componentDivisors?:ComponentDivisors;divisorNormal?:number;divisorRect?:number}) {
  const overrides=validateComponentDivisors(formula.componentDivisors ?? {})
  return Object.fromEntries(DIVISOR_COMPONENTS.map(c=>[c.key,overrides[c.key] ?? (c.key==='calibrationStd' ? formula.divisorNormal ?? 2 : c.key==='repeatUuc'||c.key==='repeatStd' ? 1 : formula.divisorRect ?? Math.sqrt(3))])) as Record<DivisorKey,number>
}

export const STANDARD_DIVISOR_FIELDS = DIVISOR_COMPONENTS.map(c => ({...c,field:`divisor${c.key[0].toUpperCase()}${c.key.slice(1)}`}))
export function standardDivisorFields(std: Record<string,any> = {}) {
  return Object.fromEntries(STANDARD_DIVISOR_FIELDS.map(c => [c.field, std[c.field] == null || std[c.field] === '' ? c.fallback : Number(std[c.field])]))
}
export function standardComponentDivisors(std: Record<string,any> = {}): ComponentDivisors {
  const fields=standardDivisorFields(std)
  return validateComponentDivisors(Object.fromEntries(STANDARD_DIVISOR_FIELDS.map(c=>[c.key,fields[c.field]])))
}
