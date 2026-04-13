import { useLocation } from 'react-router-dom'
import Clock from './Clock'

export default function Topbar({ user, actions }) {
  const location = useLocation()

  // Dynamic path based on current route
  const path = location.pathname.substring(1) || 'dashboard'
  
  return (
    <div className="topbar">
      <div className="topbar-left">
        <span className="topbar-user">idxsoc@soc:~$</span>{' '}
        <span className="topbar-path">{path}</span>
      </div>

      <div className="topbar-center">
        <Clock />
      </div>

      <div className="topbar-right">
        {actions}
        <div className="live-badge">
          <div className="live-dot" /> LIVE
        </div>
      </div>
    </div>
  )
}
