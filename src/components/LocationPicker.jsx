import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const presets = [
  { label: 'Central Park, NYC', start: { lat: 40.7812, lon: -73.9665 }, end: { lat: 40.758, lon: -73.9855 } },
  { label: 'Connaught Place, Delhi', start: { lat: 28.6315, lon: 77.2167 }, end: { lat: 28.6129, lon: 77.2295 } },
  { label: 'Marina Bay, Singapore', start: { lat: 1.283, lon: 103.860 }, end: { lat: 1.279, lon: 103.854 } },
]

// Fix default marker icons for Leaflet when bundling
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})
L.Marker.prototype.options.icon = DefaultIcon

function ClickSelector({ start, setStart, end, setEnd, selecting, setSelecting }) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng
      if (selecting === 'start') {
        setStart({ lat, lon: lng })
        setSelecting('end')
      } else if (selecting === 'end') {
        setEnd({ lat, lon: lng })
        setSelecting(null)
      }
    }
  })
  return null
}

export default function LocationPicker({ start, setStart, end, setEnd }) {
  const [presetIdx, setPresetIdx] = useState('')
  const [selecting, setSelecting] = useState(null) // 'start' | 'end' | null

  useEffect(() => {
    if (presetIdx === '') return
    const p = presets[Number(presetIdx)]
    setStart(p.start)
    setEnd(p.end)
  }, [presetIdx])

  const center = useMemo(() => ({
    lat: (start.lat + end.lat) / 2,
    lon: (start.lon + end.lon) / 2,
  }), [start, end])

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-600">Start (lat, lon)</label>
          <div className="flex gap-2">
            <input type="number" step="0.0001" value={start.lat}
              onChange={e => setStart({ ...start, lat: parseFloat(e.target.value) })}
              className="w-full border rounded px-2 py-1 text-sm" />
            <input type="number" step="0.0001" value={start.lon}
              onChange={e => setStart({ ...start, lon: parseFloat(e.target.value) })}
              className="w-full border rounded px-2 py-1 text-sm" />
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-600">End (lat, lon)</label>
          <div className="flex gap-2">
            <input type="number" step="0.0001" value={end.lat}
              onChange={e => setEnd({ ...end, lat: parseFloat(e.target.value) })}
              className="w-full border rounded px-2 py-1 text-sm" />
            <input type="number" step="0.0001" value={end.lon}
              onChange={e => setEnd({ ...end, lon: parseFloat(e.target.value) })}
              className="w-full border rounded px-2 py-1 text-sm" />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-600">Quick presets:</span>
        <select value={presetIdx} onChange={e => setPresetIdx(e.target.value)} className="border rounded px-2 py-1 text-sm">
          <option value="">Choose a location</option>
          {presets.map((p, i) => <option key={i} value={i}>{p.label}</option>)}
        </select>
        <button onClick={() => setSelecting('start')} className={`px-2 py-1 rounded text-xs border ${selecting==='start'?'bg-blue-600 text-white':'bg-white'}`}>Pick start on map</button>
        <button onClick={() => setSelecting('end')} className={`px-2 py-1 rounded text-xs border ${selecting==='end'?'bg-green-600 text-white':'bg-white'}`}>Pick end on map</button>
      </div>

      <div className="aspect-[16/9] w-full rounded-lg overflow-hidden border">
        <MapContainer center={[center.lat, center.lon]} zoom={14} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickSelector start={start} setStart={setStart} end={end} setEnd={setEnd} selecting={selecting} setSelecting={setSelecting} />
          <Marker position={[start.lat, start.lon]} />
          <Marker position={[end.lat, end.lon]} />
          <Polyline positions={[[start.lat, start.lon], [end.lat, end.lon]]} color="#2563eb" />
        </MapContainer>
      </div>
      <p className="text-xs text-gray-500">Click the map to set points. First click sets Start, second sets End. Use the button below to find the safest route.</p>
    </div>
  )
}
