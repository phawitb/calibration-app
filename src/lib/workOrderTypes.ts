export type OrderHospital = { unitName: string; deviceIds: string[] }
export type WorkOrderInput = {
  orderNo: string
  title: string
  startDate: string
  endDate: string
  notes: string
  hospitals: OrderHospital[]
  memberIds: string[]
  /** _id ของเครื่องมือมาตรฐาน (stdinstrumentrefs) ที่นำไปตามคำสั่ง ว่างได้ = ไม่จำกัด */
  standardIds: string[]
}
export type OrderMember = {
  _id: string
  name: string
  username: string
  isActive: boolean
}
export type OrderDevice = {
  _id: string
  unitName: string
  amedNo: string
  deviceName: string
  model: string
  serialNo: string
  brand?: string
}
export type OrderStandard = {
  _id: string
  no: string
  name: string
  manufacture?: string
  model?: string
  serialNo?: string
  measurement?: string
}
export type WorkOrderSummary = WorkOrderInput & {
  _id: string
  revision: number
  updatedAt: string
  members: OrderMember[]
  devices: OrderDevice[]
  standards: OrderStandard[]
}
