import { useEffect, useMemo, useRef, useState } from 'react'

// A lightweight OSM map using Leaflet-like interaction via maplibre-gl would need deps.
// To keep the MVP dependency-free, we use the OSM embed plus text inputs for lat/lon
// and an English UI. Users can paste or click presets, and we reflect bbox around
// start/end.

const presets = [
  { label: 'Central Park, NYC', start: { lat: 40.7812, lon: -73.9665 }, end: { lat: 40.758, lon: -73.9855 } },
  { label: 'Connaught Place, Delhi', start: { lat: 28.6315, lon: 77.2167 }, end: { lat: 28.6129, lon: 77.2295 } },
  { label: 'Marina Bay, Singapore', start: { lat: 1.283, lon: 103.860 }, end: { lat: 1.279, lon: 103.854 } },
]

export default function LocationPicker({ start, setStart, end, setEnd }) {
  const [presetIdx, setPresetIdx] = useState('')

  useEffect(() => {
    if (presetIdx === '') return
    const p = presets[Number(presetIdx)]
    setStart(p.start)
    setEnd(p.end)
  }, [presetIdx])

  const bbox = useMemo(() => {
    const lats = [start.lat, end.lat].filter(x => typeof x === 'number')
    const lons = [start.lon, end.lon].filter(x => typeof x === 'number')
    if (lats.length < 2 || lons.length < 2) return '77.20,28.60,77.24,28.62'
    const minLat = Math.min(...lats)
    const maxLat = Math.max(...lats)
    const minLon = Math.min(...lons)
    const maxLon = Math.max(...lons)
    const padLat = (maxLat - minLat) * 0.2 || 0.01
    const padLon = (maxLon - minLon) * 0.2 || 0.01
    return `${minLon - padLon},${minLat - padLat},${maxLon + padLon},${maxLat + padLat}`
  }, [start, end])

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

      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-600">Quick presets:</span>
        <select value={presetIdx} onChange={e => setPresetIdx(e.target.value)} className="border rounded px-2 py-1 text-sm">
          <option value="">Choose a location</option>
          {presets.map((p, i) => <option key={i} value={i}>{p.label}</option>)}
        </select>
      </div>

      <div className="aspect-[16/9] w-full rounded-lg overflow-hidden border">
        <iframe title="map" className="w-full h-full" src={`https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik`}></iframe>
      </div>
      <p className="text-xs text-gray-500">Map language: English. You can paste coordinates or use presets. Full SDK routing can be added next.</p>
    </div>
  )
}
