import { useState, useEffect } from 'react'

export default function Clock() {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="centered-clock-container">
      <span className="clock-date">
        {time.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' }).toUpperCase()}
      </span>
      <span className="clock-separator">//</span>
      <span className="clock-time">
        {time.toLocaleTimeString('en-IN', { hour12: false })}
      </span>
    </div>
  )
}
