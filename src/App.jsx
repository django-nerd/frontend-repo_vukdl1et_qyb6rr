import { useEffect, useMemo, useState } from 'react'

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
  }
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${colors[color]}`}>{children}</span>
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
  return { get, post }
}

function Planner() {
  const { post } = useBackend()
  const [mode, setMode] = useState('balanced')
  const [timeOfDay, setTimeOfDay] = useState('day')
  const [result, setResult] = useState(null)

  const segments = useMemo(() => ([
    {
      segment_id: 'A',
      start: { lat: 28.61, lon: 77.21 },
      end: { lat: 28.612, lon: 77.22 },
      distance_m: 800,
      avg_speed_kmh: 28,
      signals: {
        streetlight_intensity: 0.75,
        cctv_density: 0.6,
        police_proximity: 0.65,
        crowd_density: 0.55,
        crime_index: 0.2,
        community_reports_safety: 0.7,
      }
    },
    {
      segment_id: 'B',
      start: { lat: 28.612, lon: 77.22 },
      end: { lat: 28.615, lon: 77.225 },
      distance_m: 1200,
      avg_speed_kmh: 35,
      signals: {
        streetlight_intensity: 0.4,
        cctv_density: 0.3,
        police_proximity: 0.4,
        crowd_density: 0.35,
        crime_index: 0.6,
        community_reports_safety: 0.2,
      }
    },
  ]), [])

  const scoreRoute = async () => {
    const data = await post('/api/routes/score', { segments, time_of_day: timeOfDay, mode })
    setResult(data)
  }

  return (
    <Section title="Safety-based Route Planner" actions={
      <button onClick={scoreRoute} className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-700">Score Route</button>
    }>
      <div className="grid md:grid-cols-3 gap-4">
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            {['fastest','safest','balanced','night_safe','female_friendly'].map(m => (
              <button key={m} onClick={() => setMode(m)} className={`px-3 py-1.5 rounded border text-sm ${mode===m? 'bg-blue-600 text-white border-blue-600':'bg-white hover:bg-gray-50'}`}>{m.replace('_',' ')}</button>
            ))}
          </div>
          <div className="flex gap-2">
            {['day','night','dawn_dusk'].map(t => (
              <button key={t} onClick={() => setTimeOfDay(t)} className={`px-3 py-1.5 rounded border text-sm ${timeOfDay===t? 'bg-gray-900 text-white border-gray-900':'bg-white hover:bg-gray-50'}`}>{t}</button>
            ))}
          </div>
          <div className="text-xs text-gray-600">Each road segment gets a 0–100 Safety Score calculated from lighting, CCTV, police proximity, crowds, crime, community reports, and time of day.</div>
        </div>
        <div className="md:col-span-2">
          <div className="aspect-[16/9] w-full rounded-lg overflow-hidden border">
            <iframe title="map" className="w-full h-full" src="https://www.openstreetmap.org/export/embed.html?bbox=77.20%2C28.60%2C77.24%2C28.62&layer=mapnik"></iframe>
          </div>
        </div>
      </div>
      {result && (
        <div className="mt-4 grid md:grid-cols-3 gap-4">
          <div className="p-3 rounded border bg-gray-50">
            <div className="text-sm text-gray-600">Mode</div>
            <div className="text-lg font-semibold">{result.mode}</div>
            <div className="text-sm text-gray-600 mt-2">ETA</div>
            <div className="text-lg font-semibold">{result.eta_minutes} min</div>
            <div className="text-sm text-gray-600 mt-2">Average Safety</div>
            <div className="text-lg font-semibold">{result.average_safety_score}</div>
          </div>
          <div className="md:col-span-2 space-y-2">
            {result.segment_scores?.map(s => (
              <div key={s.segment_id} className="flex items-center justify-between p-2 rounded border">
                <div className="flex items-center gap-2"><Badge color={s.safety_score>70?'green':s.safety_score>50?'amber':'red'}>Seg {s.segment_id}</Badge></div>
                <div className="text-sm">Safety Score</div>
                <div className="text-base font-semibold">{s.safety_score}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Section>
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

function HistoryAlerts() {
  const { get } = useBackend()
  const [alerts, setAlerts] = useState([])
  const [trips, setTrips] = useState([])

  const load = async () => {
    const a = await get('/api/alerts?lat=28.61&lon=77.21&time_of_day=night')
    setAlerts(a.alerts || [])
    const t = await get('/api/trips?user_uid=user_a')
    setTrips(t.trips || [])
  }

  useEffect(()=>{ load() }, [])

  return (
    <Section title="Smart Alerts & Trip History">
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <div className="text-sm font-medium mb-2">Live Smart Alerts</div>
          <div className="space-y-2">
            {alerts.map((al, i) => (
              <div key={i} className="p-2 border rounded text-sm flex items-center justify-between">
                <div>{al.message}</div>
                <Badge color="amber">{al.type}</Badge>
              </div>
            ))}
            {!alerts.length && <div className="text-sm text-gray-500">No alerts right now.</div>}
          </div>
        </div>
        <div>
          <div className="text-sm font-medium mb-2">Recent Trips</div>
          <div className="space-y-2">
            {trips.map(t => (
              <div key={t._id} className="p-2 border rounded text-sm">
                <div className="flex items-center justify-between">
                  <div>{t.mode} · {t.distance_km} km</div>
                  <Badge color="blue">{t.eta_minutes} min</Badge>
                </div>
              </div>
            ))}
            {!trips.length && <div className="text-sm text-gray-500">No trips logged yet.</div>}
          </div>
        </div>
      </div>
    </Section>
  )
}

function ModesBar({ night, setNight, women, setWomen, saver, setSaver }) {
  useEffect(()=>{
    document.documentElement.classList.toggle('dark', night)
  }, [night])
  return (
    <div className="flex flex-wrap gap-4 items-center">
      <Toggle label="NightShield Mode" checked={night} onChange={setNight} />
      <Toggle label="Women Safety Mode" checked={women} onChange={setWomen} />
      <Toggle label="Battery Saver" checked={saver} onChange={setSaver} />
      {night && <Badge color="violet">High-contrast UI + frequent guardian updates</Badge>}
      {women && <Badge color="red">Female-focused alerts enabled</Badge>}
      {saver && <Badge color="gray">Reduced updates to save battery</Badge>}
    </div>
  )
}

export default function App() {
  const [night, setNight] = useState(false)
  const [women, setWomen] = useState(false)
  const [saver, setSaver] = useState(false)

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
          <ModesBar night={night} setNight={setNight} women={women} setWomen={setWomen} saver={saver} setSaver={setSaver} />
        </header>

        <Planner />
        <Companions />
        <CommunityReports />
        <SharingGuardian />
        <SOS />
        <HistoryAlerts />

        <footer className={`${night? 'text-gray-400':'text-gray-500'} text-xs text-center pt-4`}>Offline maps, vibration alerts, and prediction-ready architecture included in backend design. Connect native SDKs for full mobile features.</footer>
      </div>
    </div>
  )
}
