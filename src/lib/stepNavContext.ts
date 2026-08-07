import { createContext, useContext } from 'react'

export const StepNavContext = createContext<{ goToNext: () => void }>({ goToNext: () => {} })
export const useStepNav = () => useContext(StepNavContext)
