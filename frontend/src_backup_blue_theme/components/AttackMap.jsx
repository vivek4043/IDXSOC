import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet'

const API = 'http://localhost:8000'

// Severity → color
const SEV_COLOR = {
  CRITICAL: '#ff4757',
  HIGH:     '#ff6b35',
  MEDIUM:   '#ffa502',
  LOW:      '#2ed573',
}

export default function AttackMap() {
  const [markers, setMarkers] = useState([])

  useEffect(() => {
    const load = async () => {
      try {
        const res  = await fetch(`${API}/api/geo-attacks`)
        const data = await res.json()
        setMarkers(data.filter(d => d.lat && d.lon))
      } catch { /* noop */ }
    }
    load()
    const id = setInterval(load, 10000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="map-container" id="attack-map">
      <MapContainer
        center={[20, 0]}
        zoom={2}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
        zoomControl={true}
        attributionControl={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="© OpenStreetMap"
        />
        {markers.map((m, i) => (
          <CircleMarker
            key={i}
            center={[m.lat, m.lon]}
            radius={Math.min(8 + Math.log(m.count + 1) * 4, 22)}
            fillColor={SEV_COLOR.CRITICAL}
            color={SEV_COLOR.CRITICAL}
            fillOpacity={0.45}
            weight={1.5}
          >
            <Tooltip>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, minWidth: 120 }}>
                <strong>{m.country}</strong><br />
                <span style={{ color: '#ff4757' }}>⚠ {m.count} attack{m.count > 1 ? 's' : ''}</span>
              </div>
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  )
}
