import { createContext, useContext, useState } from 'react'

const TopbarContext = createContext()

export function TopbarProvider({ children }) {
  const [actions, setActions] = useState(null)

  return (
    <TopbarContext.Provider value={{ actions, setActions }}>
      {children}
    </TopbarContext.Provider>
  )
}

export function useTopbar() {
  return useContext(TopbarContext)
}
