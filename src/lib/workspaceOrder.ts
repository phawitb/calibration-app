import type { WorkOrderSummary } from './workOrderTypes'
export function selectedVisibleOrder(orders: WorkOrderSummary[], id: string) {
  return orders.find((o) => o._id === id) || null
}
export function orderStorageKey(identity: string) {
  return `workspace-order:${identity}`
}

export function resolveWorkspaceHospitals(input: {
  historical: boolean
  locked: boolean
  hospitalUnit: string
  allHospitals: string[]
  orderHospitals: string[]
  hasSelectedOrder?: boolean
}) {
  if (input.historical && !input.hasSelectedOrder)
    return input.locked
      ? [input.hospitalUnit].filter(Boolean)
      : input.allHospitals
  return input.orderHospitals
}
