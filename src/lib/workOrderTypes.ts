export type OrderHospital = { unitName: string; deviceIds: string[] }
export type WorkOrderInput = {
  orderNo: string
  title: string
  startDate: string
  endDate: string
  notes: string
  hospitals: OrderHospital[]
  memberIds: string[]
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
export type WorkOrderSummary = WorkOrderInput & {
  _id: string
  revision: number
  updatedAt: string
  members: OrderMember[]
  devices: OrderDevice[]
}
