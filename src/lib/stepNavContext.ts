import { createContext, useContext } from 'react'

export type StepNavContextType = {
  goToNext: () => void
  /** Form registers a validator; returns true if data is sufficient to proceed */
  registerValidator: (fn: () => boolean) => void
}

export const StepNavContext = createContext<StepNavContextType>({
  goToNext: () => {},
  registerValidator: () => {},
})
export const useStepNav = () => useContext(StepNavContext)
