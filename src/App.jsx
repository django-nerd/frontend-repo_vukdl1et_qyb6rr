import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

function Section({ title, children, actions }) {
  return (
    <div className="bg-white/80 backdrop-blur shadow rounded-xl p-4 md:p-6 border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg md:text-xl font-semibold text-gray-800">{title}</h2>
        {actions}
      </div>
      {children}
    </div>
  )
}

function Badge({ children, color = 'blue' }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    violet: 'bg-violet-50 text-violet-700 border-violet-200',
    gray: 'bg-gray-50 text-gray-700 border-gray-200',
    slate: 'bg-slate-50 text-slate-700 border-slate-200',
  }
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${colors[color] || colors.blue}`}>{children}</span>
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <div className={`w-10 h-6 rounded-full p-0.5 transition ${checked ? 'bg-blue-600' : 'bg-gray-300'}`}
        onClick={() => onChange(!checked)}>
        <div className={`h-5 w-5 rounded-full bg-white shadow transform transition ${checked ? 'translate-x-4' : ''}`}></div>
      </div>
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  )
}

function useBackend() {
  const get = (path) => fetch(`${API_BASE}${path}`).then(r => r.json())
  const post = (path, body) => fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).then(r => r.json())
  const del = (path) => fetch(`${API_BASE}${path}`, { method: 'DELETE' }).then(r => r.json())
  return { get, post, del }
}

// Fix default marker icons for Leaflet when bundling
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})
L.Marker.prototype.options.icon = DefaultIcon

function MapClickSelector({ selecting, setSelecting, setStart, setEnd }) {
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

function Planner() {
  const { post, get, del } = useBackend()
  const [mode, setMode] = useState('balanced')
  const [timeOfDay, setTimeOfDay] = useState('day')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [result, setResult] = useState(null)

  const [start, setStart] = useState({ lat: 28.6315, lon: 77.2167 })
  const [end, setEnd] = useState({ lat: 28.6129, lon: 77.2295 })
  const [selecting, setSelecting] = useState(null)

  const [chosenRoute, setChosenRoute] = useState(null)
  const [alternatives, setAlternatives] = useState([])
  const [userId, setUserId] = useState('user_a')
  const [logStatus, setLogStatus] = useState('')

  // My Trips and Bookmarks
  const [trips, setTrips] = useState([])
  const [loadingTrips, setLoadingTrips] = useState(false)
  const [tripFilter, setTripFilter] = useState('all')
  const [summary, setSummary] = useState(null)
  const [bookmarks, setBookmarks] = useState([])
  const [bookmarkName, setBookmarkName] = useState('Home ⇄ Work')

  const center = useMemo(() => ({
    lat: (start.lat + end.lat) / 2,
    lon: (start.lon + end.lon) / 2,
  }), [start, end])

  const loadTrips = async (uid) => {
    if (!uid) return
    try {
      setLoadingTrips(true)
      const t = await get(`/api/trips?user_uid=${encodeURIComponent(uid)}`)
      setTrips(t.trips || [])
      const s = await get(`/api/trips/summary?user_uid=${encodeURIComponent(uid)}`)
      setSummary(s)
    } finally {
      setLoadingTrips(false)
    }
  }

  // Bookmarks persistence (localStorage)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('sr_bookmarks')
      if (raw) setBookmarks(JSON.parse(raw))
    } catch {}
  }, [])
  const saveBookmarks = (next) => {
    setBookmarks(next)
    try { localStorage.setItem('sr_bookmarks', JSON.stringify(next)) } catch {}
  }

  useEffect(() => { loadTrips(userId) }, [userId])

  const showSafest = async (opts) => {
    const s = opts?.start || start
    const e = opts?.end || end
    const m = opts?.mode || mode
    const t = opts?.time_of_day || timeOfDay

    setChosenRoute(null)
    setAlternatives([])
    setLogStatus('')
    const data = await post('/api/routes/plan', { start: s, end: e, mode: m, time_of_day: t })
    setChosenRoute(data.chosen)
    setAlternatives(data.alternatives || [])
    setResult({
      mode: data.mode,
      eta_minutes: data.chosen?.eta_minutes,
      average_safety_score: data.chosen?.average_safety_score,
      distance_km: data.chosen ? Number((data.chosen.distance_m / 1000).toFixed(3)) : null,
    })
  }

  // Auto recompute when mode/time/start/end change (if previously computed)
  useEffect(() => {
    if (autoRefresh && result) {
      showSafest()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, timeOfDay, start, end])

  const routeId = useMemo(() => {
    if (!chosenRoute?.geometry?.coordinates?.length) return ''
    const head = chosenRoute.geometry.coordinates[0]
    const tail = chosenRoute.geometry.coordinates[chosenRoute.geometry.coordinates.length - 1]
    return `r_${head[0].toFixed(4)}_${head[1].toFixed(4)}_${tail[0].toFixed(4)}_${tail[1].toFixed(4)}_${Math.round(chosenRoute.distance_m)}`
  }, [chosenRoute])

  const logTrip = async () => {
    if (!chosenRoute) return
    setLogStatus('')
    const body = {
      user_uid: userId,
      origin: start,
      destination: end,
      route_id: routeId || `r_${Date.now()}`,
      mode,
      distance_km: Number((chosenRoute.distance_m / 1000).toFixed(3)),
      eta_minutes: chosenRoute.eta_minutes,
      safety_score: chosenRoute.average_safety_score,
    }
    const res = await post('/api/trips', body)
    if (res.trip_id) {
      setLogStatus('Saved to history')
      loadTrips(userId)
    } else setLogStatus('Could not save, try again')
  }

  // My Trips actions
  const setFromTrip = (t) => {
    if (!t) return
    setStart(t.origin)
    setEnd(t.destination)
    if (t.mode) setMode(t.mode)
  }
  const reRunTrip = async (t) => {
    if (!t) return
    setFromTrip(t)
    await showSafest({ start: t.origin, end: t.destination, mode: t.mode })
  }
  const deleteTrip = async (t) => {
    if (!t?._id) return
    await del(`/api/trips/${t._id}`)
    loadTrips(userId)
  }

  // Bookmarks actions
  const addBookmark = () => {
    if (!bookmarkName.trim()) return
    const next = [
      { id: `b_${Date.now()}`, name: bookmarkName.trim(), start, end },
      ...bookmarks
    ].slice(0, 20)
    saveBookmarks(next)
    setBookmarkName('')
  }
  const useBookmark = (b) => {
    setStart(b.start)
    setEnd(b.end)
  }
  const deleteBookmark = (id) => {
    const next = bookmarks.filter(b => b.id !== id)
    saveBookmarks(next)
  }

  // Derived filtered trips
  const visibleTrips = useMemo(() => {
    if (tripFilter === 'all') return trips
    return trips.filter(t => t.mode === tripFilter)
  }, [trips, tripFilter])

  return (
    <Section title="Safety-based Route Planner" actions={
      <div className="flex gap-2">
        <button onClick={() => setSelecting('start')} className={`px-3 py-1.5 rounded border text-sm ${selecting==='start'?'bg-blue-600 text-white border-blue-600':'bg-white hover:bg-gray-50'}`}>Pick start</button>
        <button onClick={() => setSelecting('end')} className={`px-3 py-1.5 rounded border text-sm ${selecting==='end'?'bg-green-600 text-white border-green-600':'bg-white hover:bg-gray-50'}`}>Pick end</button>
        <button onClick={() => showSafest()} className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-700">Show Safest Route</button>
      </div>
    }>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <input value={userId} onChange={e=>setUserId(e.target.value)} className="border rounded px-2 py-1 text-sm" placeholder="user id" />
          {['fastest','safest','balanced','night_safe','female_friendly'].map(m => (
            <button key={m} onClick={() => setMode(m)} className={`px-3 py-1.5 rounded border text-sm ${mode===m? 'bg-blue-600 text-white border-blue-600':'bg-white hover:bg-gray-50'}`}>{m.replace('_',' ')}</button>
          ))}
          {['day','night','dawn_dusk'].map(t => (
            <button key={t} onClick={() => setTimeOfDay(t)} className={`px-3 py-1.5 rounded border text-sm ${timeOfDay===t? 'bg-gray-900 text-white border-gray-900':'bg-white hover:bg-gray-50'}`}>{t}</button>
          ))}
          <div className="ml-auto flex items-center gap-3">
            <Toggle label="Auto recompute" checked={autoRefresh} onChange={setAutoRefresh} />
          </div>
        </div>

        <div className="rounded-lg overflow-hidden border" style={{ height: '58vh' }}>
          <MapContainer center={[center.lat, center.lon]} zoom={14} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapClickSelector selecting={selecting} setSelecting={setSelecting} setStart={setStart} setEnd={setEnd} />
            <Marker position={[start.lat, start.lon]} />
            <Marker position={[end.lat, end.lon]} />
            {alternatives.filter(a=>a!==chosenRoute).map((alt, i) => (
              <Polyline key={i} positions={(alt.geometry?.coordinates||[]).map(c=>[c[0], c[1]])} color="#9ca3af" weight={3} opacity={0.6} />
            ))}
            {chosenRoute && (
              <Polyline positions={(chosenRoute.geometry?.coordinates||[]).map(c=>[c[0], c[1]])} color="#2563eb" weight={6} />
            )}
          </MapContainer>
        </div>

        {result && (
          <div className="grid md:grid-cols-3 gap-4 items-start">
            <div className="p-3 rounded border bg-gray-50 space-y-1">
              <div className="text-sm text-gray-600">Mode</div>
              <div className="text-lg font-semibold">{result.mode}</div>
              <div className="text-sm text-gray-600 mt-2">ETA</div>
              <div className="text-lg font-semibold">{Number(result.eta_minutes).toFixed(1)} min</div>
              <div className="text-sm text-gray-600 mt-2">Distance</div>
              <div className="text-lg font-semibold">{Number(result.distance_km).toFixed(3)} km</div>
              <div className="text-sm text-gray-600 mt-2">Average Safety</div>
              <div className="text-lg font-semibold">{result.average_safety_score}</div>
              <div className="pt-2 flex gap-2 flex-wrap">
                <button onClick={logTrip} disabled={!chosenRoute} className="px-3 py-1.5 rounded bg-green-600 text-white text-sm disabled:opacity-50">Save this trip</button>
                <button onClick={() => showSafest()} className="px-3 py-1.5 rounded border text-sm">Recompute</button>
                <div className="text-xs text-gray-600 self-center">Quick compare:</div>
                {['fastest','safest','balanced','night_safe','female_friendly'].map(m => (
                  <button key={m} onClick={() => showSafest({ mode: m })} className={`px-2 py-1 rounded text-xs border ${mode===m? 'bg-blue-600 text-white border-blue-600':'bg-white hover:bg-gray-50'}`}>{m.replace('_',' ')}</button>
                ))}
              </div>
              {logStatus && <div className="text-xs text-green-700 mt-2">{logStatus}</div>}
            </div>
            <div className="md:col-span-2 space-y-3">
              <div className="text-sm text-gray-600">Route and alternatives are drawn on the map. Select a mode/time to see different options.</div>
              <div className="p-2 border rounded bg-white/60">
                <div className="text-xs text-gray-600 mb-1">Bookmark current start/end</div>
                <div className="flex gap-2">
                  <input value={bookmarkName} onChange={e=>setBookmarkName(e.target.value)} className="flex-1 border rounded px-2 py-1 text-sm" placeholder="Bookmark name" />
                  <button onClick={addBookmark} className="px-3 py-1.5 rounded border text-sm">Add</button>
                </div>
              </div>
              {!!alternatives.length && (
                <div className="p-2 border rounded bg-white/60">
                  <div className="text-xs text-gray-700 mb-1">Alternatives</div>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {alternatives.map((alt, i) => (
                      <button key={i} onClick={() => setChosenRoute(alt)} className={`text-left p-2 rounded border ${alt===chosenRoute?'border-blue-600 bg-blue-50':'hover:bg-gray-50'}`}>
                        <div className="flex items-center justify-between text-sm">
                          <div>ETA {Number(alt.eta_minutes).toFixed(1)}m · {(alt.distance_m/1000).toFixed(3)}km</div>
                          <Badge color={alt.average_safety_score>=75?'green':alt.average_safety_score>=60?'amber':'red'}>Safety {alt.average_safety_score}</Badge>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* My Trips & Bookmarks */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-3 rounded border bg-gray-50">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium">My Trips</div>
              <div className="flex items-center gap-2">
                <select value={tripFilter} onChange={e=>setTripFilter(e.target.value)} className="px-2 py-1 text-xs border rounded">
                  <option value="all">All</option>
                  <option value="fastest">Fastest</option>
                  <option value="safest">Safest</option>
                  <option value="balanced">Balanced</option>
                  <option value="night_safe">Night safe</option>
                  <option value="female_friendly">Female friendly</option>
                </select>
                <button onClick={() => loadTrips(userId)} className="px-2 py-1 text-xs rounded border">{loadingTrips ? 'Loading...' : 'Refresh'}</button>
              </div>
            </div>
            {summary && (
              <div className="mb-2 text-xs text-gray-600">{summary.total_trips} trips · {summary.total_km} km · Avg safety {summary.avg_safety} · Fav: {summary.favorite_mode || '—'}</div>
            )}
            <div className="space-y-2 max-h-64 overflow-auto pr-1">
              {visibleTrips.map(t => (
                <div key={t._id} className="p-2 bg-white rounded border">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium capitalize">{t.mode.replace('_',' ')} · {Number(t.distance_km).toFixed(3)} km</div>
                    <Badge color="blue">{Number(t.eta_minutes).toFixed(1)} min</Badge>
                  </div>
                  <div className="text-xs text-gray-600 mt-1">{t.origin?.lat?.toFixed?.(3)},{t.origin?.lon?.toFixed?.(3)} → {t.destination?.lat?.toFixed?.(3)},{t.destination?.lon?.toFixed?.(3)}</div>
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => { setFromTrip(t) }} className="px-2 py-1 text-xs rounded border">View</button>
                    <button onClick={() => reRunTrip(t)} className="px-2 py-1 text-xs rounded bg-blue-600 text-white">Re-run</button>
                    <button onClick={() => deleteTrip(t)} className="px-2 py-1 text-xs rounded border text-red-600">Delete</button>
                  </div>
                </div>
              ))}
              {!visibleTrips.length && <div className="text-sm text-gray-500">No trips yet.</div>}
            </div>
          </div>
          <div className="p-3 rounded border bg-gray-50">
            <div className="text-sm font-medium mb-2">Bookmarks</div>
            <div className="space-y-2 max-h-64 overflow-auto pr-1">
              {bookmarks.map(b => (
                <div key={b.id} className="p-2 bg-white rounded border">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">{b.name}</div>
                    <div className="flex gap-2">
                      <button onClick={() => useBookmark(b)} className="px-2 py-1 text-xs rounded border">Use</button>
                      <button onClick={() => deleteBookmark(b.id)} className="px-2 py-1 text-xs rounded border text-red-600">Delete</button>
                    </div>
                  </div>
                  <div className="text-xs text-gray-600 mt-1">{b.start.lat.toFixed(3)},{b.start.lon.toFixed(3)} → {b.end.lat.toFixed(3)},{b.end.lon.toFixed(3)}</div>
                </div>
              ))}
              {!bookmarks.length && <div className="text-sm text-gray-500">No bookmarks yet. Add one from the route summary above.</div>}
            </div>
          </div>
        </div>

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
        <p className="text-xs text-gray-600">Use the large map to click your Start and End. Routes change with mode and time-of-day for better safety vs speed tradeoffs.</p>
      </div>
    </Section>
  )
}

function HistoryAlerts() {
  const { get } = useBackend()
  const [alerts, setAlerts] = useState([])
  const [lat, setLat] = useState(28.61)
  const [lon, setLon] = useState(77.21)
  const [tod, setTod] = useState('night')

  const loadAlerts = async () => {
    const a = await get(`/api/alerts?lat=${lat}&lon=${lon}&time_of_day=${tod}`)
    setAlerts(a.alerts || [])
  }

  useEffect(()=>{ loadAlerts() }, [])

  return (
    <Section title="Smart Alerts & Trip History">
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium">Live Smart Alerts</div>
            <div className="flex items-center gap-2">
              <select value={tod} onChange={e=>setTod(e.target.value)} className="px-2 py-1 text-xs border rounded">
                <option value="day">day</option>
                <option value="night">night</option>
                <option value="dawn_dusk">dawn_dusk</option>
              </select>
              <button onClick={loadAlerts} className="px-2 py-1 text-xs rounded border">Refresh</button>
            </div>
          </div>
          <div className="grid gap-2">
            {alerts.map((al, i) => (
              <div key={i} className="p-2 border rounded text-sm flex items-start justify-between">
                <div>
                  <div className="font-medium">{al.message}</div>
                  {al.recommendation && <div className="text-xs text-gray-600 mt-0.5">{al.recommendation}</div>}
                </div>
                <div className="flex flex-col items-end gap-1">
                  {al.distance_m != null && <Badge color="slate">{al.distance_m}m</Badge>}
                  <Badge color={al.severity>=4? 'red' : al.severity>=3? 'amber':'green'}>sev {al.severity || 1}</Badge>
                </div>
              </div>
            ))}
            {!alerts.length && <div className="text-sm text-gray-500">No alerts right now.</div>}
          </div>
        </div>
        <UserTripsCompact />
      </div>
    </Section>
  )
}

function UserTripsCompact() {
  const { get } = useBackend()
  const [trips, setTrips] = useState([])
  const [uid, setUid] = useState('user_a')

  const loadTrips = async () => {
    const t = await get(`/api/trips?user_uid=${encodeURIComponent(uid)}`)
    setTrips(t.trips || [])
  }

  useEffect(()=>{ loadTrips() }, [])

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium">Recent Trips</div>
        <div className="flex items-center gap-2">
          <input value={uid} onChange={e=>setUid(e.target.value)} className="px-2 py-1 text-xs border rounded" placeholder="user id" />
          <button onClick={loadTrips} className="px-2 py-1 text-xs rounded border">Refresh</button>
        </div>
      </div>
      <div className="space-y-2">
        {trips.slice(0,6).map(t => (
          <div key={t._id} className="p-2 border rounded text-sm">
            <div className="flex items-center justify-between">
              <div className="capitalize">{t.mode.replace('_',' ')} · {Number(t.distance_km).toFixed(3)} km</div>
              <Badge color="blue">{Number(t.eta_minutes).toFixed(1)} min</Badge>
            </div>
            <div className="text-xs text-gray-600 mt-1">Safety {t.safety_score} · {t.origin?.lat?.toFixed?.(2)},{t.origin?.lon?.toFixed?.(2)} → {t.destination?.lat?.toFixed?.(2)},{t.destination?.lon?.toFixed?.(2)}</div>
          </div>
        ))}
        {!trips.length && <div className="text-sm text-gray-500">No trips logged yet.</div>}
      </div>
    </div>
  )
}

function Companions() {
  const { post, get } = useBackend()
  const [uid, setUid] = useState('user_a')
  const [gender, setGender] = useState('female')
  const [reqId, setReqId] = useState(null)
  const [matches, setMatches] = useState([])

  const createRequest = async () => {
    const now = new Date()
    const body = {
      user_uid: uid,
      gender,
      origin: { lat: 28.61, lon: 77.21 },
      destination: { lat: 28.615, lon: 77.225 },
      earliest_departure: new Date(now.getTime() - 5*60000).toISOString(),
      latest_departure: new Date(now.getTime() + 30*60000).toISOString(),
      active: true
    }
    const res = await post('/api/companions/request', body)
    setReqId(res.request_id)
  }

  const findMatches = async () => {
    const res = await get(`/api/companions/match?user_uid=${uid}`)
    setMatches(res)
  }

  return (
    <Section title="Same-gender Travel Companion">
      <div className="grid md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <input value={uid} onChange={e=>setUid(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" placeholder="Your user id" />
          <select value={gender} onChange={e=>setGender(e.target.value)} className="w-full border rounded px-3 py-2 text-sm">
            <option>female</option>
            <option>male</option>
            <option>non-binary</option>
            <option>prefer-not-to-say</option>
          </select>
          <div className="flex gap-2">
            <button onClick={createRequest} className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm">Create Request</button>
            <button onClick={findMatches} className="px-3 py-1.5 rounded border text-sm">Find Matches</button>
          </div>
          {reqId && <Badge color="green">Request created</Badge>}
        </div>
        <div className="md:col-span-2 space-y-2">
          {matches.map(m => (
            <div key={m.request_id} className="p-3 border rounded flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">{m.user_uid}</div>
                <div className="text-xs text-gray-600">Origin {m.distance_to_origin_m}m · Dest {m.distance_to_destination_m}m</div>
              </div>
              <Badge color={m.score>0.6?'green':m.score>0.4?'amber':'gray'}>Score {m.score}</Badge>
            </div>
          ))}
          {!matches.length && <div className="text-sm text-gray-500">No matches yet. Create requests for a couple of users to test.</div>}
        </div>
      </div>
    </Section>
  )
}

function CommunityReports() {
  const { post } = useBackend()
  const [status, setStatus] = useState(null)
  const [category, setCategory] = useState('dark_spot')
  const [desc, setDesc] = useState('')

  const submit = async () => {
    const res = await post('/api/reports', {
      category,
      description: desc,
      location: { lat: 28.613, lon: 77.209 },
      reporter_uid: 'user_a'
    })
    setStatus(`Report ${res.report_id} submitted`)
  }

  return (
    <Section title="Community Safety Reporting">
      <div className="grid md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <select value={category} onChange={e=>setCategory(e.target.value)} className="w-full border rounded px-3 py-2 text-sm">
            <option value="dark_spot">Dark spot</option>
            <option value="harassment">Harassment</option>
            <option value="suspicious_activity">Suspicious activity</option>
            <option value="hazard">Hazard</option>
            <option value="other">Other</option>
          </select>
          <textarea value={desc} onChange={e=>setDesc(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" placeholder="Add optional description" />
          <button onClick={submit} className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm">Submit</button>
          {status && <div className="text-sm text-green-700">{status}</div>}
        </div>
        <div className="md:col-span-2">
          <div className="text-sm text-gray-600">Users can attach photos, vote, and help keep the map safe. Spam is filtered automatically.</div>
        </div>
      </div>
    </Section>
  )
}

function SOS() {
  const { post } = useBackend()
  const [triggered, setTriggered] = useState(null)
  const [auto, setAuto] = useState(null)
  const [alarm, setAlarm] = useState(false)

  const trigger = async () => {
    const res = await post('/api/sos/trigger', {
      user_uid: 'user_a',
      location: { lat: 28.61, lon: 77.21 },
      triggered_by: 'manual'
    })
    setTriggered(res)
    setAlarm(true)
    if (navigator.vibrate) navigator.vibrate([300, 150, 300])
  }

  useEffect(() => {
    let audio
    if (alarm) {
      audio = new Audio('https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg')
      audio.loop = true
      audio.play().catch(()=>{})
      const t = setTimeout(()=>{ setAlarm(false); audio.pause() }, 5000)
      return () => { clearTimeout(t); audio && audio.pause() }
    }
  }, [alarm])

  const autoCheck = async () => {
    const res = await post('/api/sos/auto-check', {
      risk_level: 0.85,
      is_stationary_minutes: 6,
      fall_detected: false,
      heart_rate: 130,
      hr_baseline: 70
    })
    setAuto(res)
  }

  return (
    <Section title="SOS & Auto-SOS">
      <div className="flex flex-wrap gap-2">
        <button onClick={trigger} className="px-4 py-2 rounded bg-red-600 text-white text-sm">Trigger SOS</button>
        <button onClick={autoCheck} className="px-4 py-2 rounded border text-sm">Run Auto Check</button>
      </div>
      {triggered && (
        <div className="mt-3 p-3 rounded border bg-red-50 text-sm">
          Triggered. Actions: call police, share live location, alarm, recording, cloud upload.
        </div>
      )}
      {auto && (
        <div className="mt-3 text-sm text-gray-700">Auto-SOS: {auto.should_trigger? 'Would trigger' : 'No trigger'} · Reasons: {auto.reasons.join(', ')}</div>
      )}
    </Section>
  )
}

function SharingGuardian() {
  const { post } = useBackend()
  const [share, setShare] = useState('')
  const [battery, setBattery] = useState(78)
  const [guardianMsg, setGuardianMsg] = useState('Starting trip, ETA 20 min.')

  const createShare = async () => {
    const res = await post('/api/location/share', {
      user_uid: 'user_a',
      route_id: 'route123',
      eta_minutes: 18,
      battery_level: battery,
      platform: 'generic'
    })
    setShare(`${res.text}`)
  }

  const notifyGuardian = async () => {
    await post('/api/guardians/notify', { user_uid: 'user_a', message: guardianMsg })
    setGuardianMsg('Update sent to guardians.')
  }

  return (
    <Section title="Live Sharing & Guardian Mode">
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="text-sm text-gray-700">Live Share</div>
          <div className="flex items-center gap-2">
            <input type="number" value={battery} onChange={e=>setBattery(parseInt(e.target.value||'0'))} className="w-28 border rounded px-3 py-2 text-sm" />
            <button onClick={createShare} className="px-3 py-1.5 rounded border text-sm">Generate Share Text</button>
          </div>
          {share && <div className="p-2 bg-gray-50 rounded border text-xs whitespace-pre-wrap">{share}</div>}
        </div>
        <div className="space-y-2">
          <div className="text-sm text-gray-700">Guardian Mode</div>
          <div className="flex gap-2">
            <input value={guardianMsg} onChange={e=>setGuardianMsg(e.target.value)} className="flex-1 border rounded px-3 py-2 text-sm" />
            <button onClick={notifyGuardian} className="px-3 py-1.5 rounded bg-green-600 text-white text-sm">Send</button>
          </div>
        </div>
      </div>
    </Section>
  )
}

export default function App() {
  const [night, setNight] = useState(false)
  const [women, setWomen] = useState(false)
  const [saver, setSaver] = useState(false)

  useEffect(()=>{
    document.documentElement.classList.toggle('dark', night)
  }, [night])

  return (
    <div className={`min-h-screen ${night ? 'bg-gray-950' : 'bg-gradient-to-br from-blue-50 to-indigo-50'}`}>
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-9 w-9 rounded-xl ${night ? 'bg-violet-500' : 'bg-blue-600'} shadow-inner`}></div>
            <div>
              <h1 className={`text-xl md:text-2xl font-bold ${night? 'text-white':'text-gray-900'}`}>SafeRoutes</h1>
              <p className={`${night? 'text-gray-300':'text-gray-600'} text-xs`}>Fastest · Safest · Balanced · Night-safe · Women-friendly</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 items-center">
            <Toggle label="NightShield Mode" checked={night} onChange={setNight} />
            <Toggle label="Women Safety Mode" checked={women} onChange={setWomen} />
            <Toggle label="Battery Saver" checked={saver} onChange={setSaver} />
            {night && <Badge color="violet">High-contrast UI + frequent guardian updates</Badge>}
            {women && <Badge color="red">Female-focused alerts enabled</Badge>}
            {saver && <Badge color="gray">Reduced updates to save battery</Badge>}
          </div>
        </header>

        <Planner />
        <HistoryAlerts />
        <SharingGuardian />
        <CommunityReports />
        <Companions />
        <SOS />

        <footer className={`text-xs text-center pt-4 ${night? 'text-gray-400':'text-gray-500'}`}>English labels and map. Offline maps, vibration alerts, and prediction-ready backend are prepared. Add SDKs for full mobile features.</footer>
      </div>
    </div>
  )
}
