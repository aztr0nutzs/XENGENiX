/* global React, ReactDOM, gsap */

const { useEffect, useMemo, useRef, useState } = React;

const PALETTE = { green: "#39FF14", blue: "#00FFFF" };

const LS_KEYS = {
  geneCredits: "xg_gene_credits_v1",
  bestRun: "xg_best_run_v1",
  settings: "xg_settings_v1",
  upgrades: "xg_upgrades_v1",
  knctScores: "xg_knct4_scores_v1",
  knctChipSet: "xg_knct4_chipset_v1",
  knctLastResult: "xg_knct4_last_result_v1",
};

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function roll(p) { return Math.random() < p; }
function safeParseInt(v, fallback) { const n = parseInt(v, 10); return Number.isFinite(n) ? n : fallback; }

const SUPABASE_URL = window.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || "";
const DEVICE_ID_KEY = "xg_device_id_v1";

function getDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = `dev_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function makeRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function normalizeRoomCode(code) {
  return (code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

function vibrate(pattern, enabled) {
  try { if (enabled && window?.navigator?.vibrate) window.navigator.vibrate(pattern); } catch (_) {}
}
function playTone(freq, durationMs, enabled) {
  if (!enabled) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.value = 0.07;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + durationMs / 1000);
    osc.onended = () => ctx.close();
  } catch (_) {}
}

function rarityColor(r) {
  switch (r) {
    case "UNCOMMON": return "rgba(0,255,255,0.85)";
    case "RARE": return "rgba(57,255,20,0.90)";
    case "EPIC": return "rgba(255,0,255,0.85)";
    case "LEGENDARY": return "rgba(255,140,0,0.90)";
    default: return "rgba(233,255,251,0.8)";
  }
}

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch (_) {
    return fallback;
  }
}
function saveJSON(key, obj) {
  try { localStorage.setItem(key, JSON.stringify(obj)); } catch (_) {}
}

/** ---------------------------
 *  SETTINGS + UPGRADES (persistent)
 *  --------------------------- */
const DEFAULT_SETTINGS = {
  haptics: true,
  sound: true,
  reducedMotion: false,
  uiIntensity: 1.0,        // 0.6 .. 1.2
  difficulty: "STANDARD",  // "EASY" | "STANDARD" | "HARD"
  maxCycles: 12,           // user tweakable
};

const DEFAULT_UPGRADES = {
  startTokens: 0,
  startAlarmDown: 0,
  startStabilityUp: 0,
  contamShield: 0,         // flat reduction after % modifiers
  ghostBoost: 0,
  ventBoost: 0,
  unlockedSectorPackA: false,
  unlockedSectorPackB: false,
};

function difficultyPreset(diff) {
  if (diff === "EASY") return { maxCycles: 14, startStability: 52, startAlarm: 0, startContam: 0 };
  if (diff === "HARD") return { maxCycles: 10, startStability: 32, startAlarm: 6, startContam: 0 };
  return { maxCycles: 12, startStability: 40, startAlarm: 0, startContam: 0 };
}

/** ---------------------------
 *  PRIMARY CONTRACT IDENTITY
 *  --------------------------- */
const PRIMARY_CONTRACT = {
  id: "QUIET_EXTRACTION",
  title: "Quiet Extraction",
  desc: "Extract with Alarm < 50.",
  bonus: 70,
};

/** ---------------------------
 *  CONNECT-4 LOGIC
 *  --------------------------- */
const KNCT4_ROWS = 6;
const KNCT4_COLS = 7;
const KNCT4_TO_WIN = 4;

function makeKnct4Board() {
  return Array.from({ length: KNCT4_ROWS }, () => Array.from({ length: KNCT4_COLS }, () => 0));
}

function knct4DropRow(board, col) {
  for (let row = KNCT4_ROWS - 1; row >= 0; row -= 1) {
    if (board[row][col] === 0) return row;
  }
  return -1;
}

function knct4CollectLine(board, row, col, dr, dc, player) {
  const line = [{ row, col }];

  for (let step = 1; step < KNCT4_TO_WIN; step += 1) {
    const r = row + dr * step;
    const c = col + dc * step;
    if (r < 0 || r >= KNCT4_ROWS || c < 0 || c >= KNCT4_COLS) break;
    if (board[r][c] !== player) break;
    line.push({ row: r, col: c });
  }

  for (let step = 1; step < KNCT4_TO_WIN; step += 1) {
    const r = row - dr * step;
    const c = col - dc * step;
    if (r < 0 || r >= KNCT4_ROWS || c < 0 || c >= KNCT4_COLS) break;
    if (board[r][c] !== player) break;
    line.unshift({ row: r, col: c });
  }

  return line;
}

function knct4CheckWin(board, row, col, player) {
  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];

  for (const [dr, dc] of directions) {
    const line = knct4CollectLine(board, row, col, dr, dc, player);
    if (line.length >= KNCT4_TO_WIN) return line;
  }
  return null;
}

const KNCT4_CHIPSETS = [
  {
    id: "classic",
    label: "Cyan / Green",
    p1: { color: "#00FFFF", image: null },
    p2: { color: "#39FF14", image: null },
  },
  {
    id: "amber-blue",
    label: "Amber / Blue",
    p1: { color: "#ffb347", image: "../knct4/assets/blob_amber_happy.png" },
    p2: { color: "#5ad1ff", image: "../knct4/assets/blob_blue_grin.png" },
  },
  {
    id: "magenta-lime",
    label: "Magenta / Lime",
    p1: { color: "#ff4fd8", image: "../knct4/assets/blob_magenta_happy.png" },
    p2: { color: "#7cff57", image: "../knct4/assets/blob_lime_grin.png" },
  },
];

function IconBadge({ icon: IconComp, label, color, className }) {
  if (!IconComp) {
    return (
      <span className={className} style={{ color }}>
        {label}
      </span>
    );
  }
  return <IconComp className={className} color={color} size="1.6em" />;
}

/** ---------------------------
 *  SECTORS + PROCEDURES
 *  --------------------------- */
const BASE_SECTORS = [
  { key: "CRYO_KD9", type: "MUTAGEN", name: "Cryo-Mutagen: K-Δ9", rarity: "UNCOMMON" },
  { key: "HELIX_RUST", type: "MUTAGEN", name: "Splice Agent: Helix-Rust", rarity: "RARE" },
  { key: "ONYX_BLOOM", type: "MUTAGEN", name: "Onyx Serum: Black Bloom", rarity: "EPIC" },

  { key: "GHOST_BUS", type: "NEURAL LINK", name: "Neuro-Link: Ghost Bus", rarity: "UNCOMMON" },
  { key: "SYNAPTIC_VPN", type: "NEURAL LINK", name: "Neural Mesh: Synaptic VPN", rarity: "RARE" },
  { key: "CORTEX_KEY", type: "NEURAL LINK", name: "Cortex Key: Bluebackdoor", rarity: "EPIC" },

  { key: "PULSE_FORGE", type: "SYNTH-ORGAN", name: "Synth-Heart: Pulse Forge", rarity: "UNCOMMON" },
  { key: "DEEP_BREATHER", type: "SYNTH-ORGAN", name: "Cyber-Gills: Deep Breather", rarity: "RARE" },
  { key: "TITANIUM_LACE", type: "SYNTH-ORGAN", name: "Bone Lattice: Titanium Lace", rarity: "EPIC" },

  { key: "NULL_GENOME", type: "ANOMALY", name: "Glitched Genome: ███-NULL", rarity: "LEGENDARY" },
];

const SECTOR_PACK_A = [
  { key: "MUTAGEN_VIRID", type: "MUTAGEN", name: "Virid Spill: Emerald Fever", rarity: "RARE" },
  { key: "NEURO_TUNNEL", type: "NEURAL LINK", name: "Neuro-Tunnel: Whisper Route", rarity: "UNCOMMON" },
  { key: "ORGAN_LENS", type: "SYNTH-ORGAN", name: "Retina-Lens: Spectral IR", rarity: "RARE" },
];

const SECTOR_PACK_B = [
  { key: "MUTAGEN_NOVA", type: "MUTAGEN", name: "Nova Serum: Whiteout Pulse", rarity: "EPIC" },
  { key: "NEURO_SPOOF", type: "NEURAL LINK", name: "Cortex Spoofer: Grey Key", rarity: "RARE" },
  { key: "ANOMALY_ECHO", type: "ANOMALY", name: "Echo Strain: MIRROR-FLARE", rarity: "LEGENDARY" },
];

const PROCEDURES = {
  CRYO_KD9: (ctx) => {
    const hasCryo = ctx.tags.includes("CRYO");
    return {
      log: [
        ["SEQ", "Injecting Cryo-Mutagen: K-Δ9..."],
        ["SYS", "Cold-chain protocol engaged."],
        ...(hasCryo ? [["WARN", "Overchill detected: system strain escalates."]] : []),
      ],
      effects: { stability: +20, contamination: +10, alarm: hasCryo ? +8 : 0 },
      tagsAdded: ["CRYO"],
    };
  },

  HELIX_RUST: (ctx) => {
    const corruption = roll(0.20) && !ctx.hasNeuralLinkInstalled;
    return {
      log: [
        ["SEQ", "Deploying Splice Agent: Helix-Rust..."],
        ["SYS", "Rewriting strand junctions (high volatility)."],
        ...(corruption ? [["ERR", "Corruption Burst: strand integrity falters."]] : []),
      ],
      effects: { stability: +28 + (corruption ? -12 : 0), contamination: +18, alarm: 0 },
      tagsAdded: ["RUST"],
    };
  },

  ONYX_BLOOM: (_ctx) => ({
    log: [
      ["SEQ", "Infusing Onyx Serum: Black Bloom..."],
      ["SYS", "Cellular bloom forced through dark catalyst."],
    ],
    effects: { stability: +34, contamination: +22, alarm: +6 },
    tagsAdded: ["ONYX"],
  }),

  GHOST_BUS: (_ctx) => ({
    log: [
      ["NET", "Neuro-Link: Ghost Bus established."],
      ["SYS", "Signal shadowing online. Control token issued."],
    ],
    effects: { stability: 0, contamination: 0, alarm: -10 },
    controlTokensDelta: +1,
    tagsAdded: ["NEURO"],
    installsNeuralLink: true,
  }),

  SYNAPTIC_VPN: (_ctx) => ({
    log: [
      ["NET", "Neural Mesh: Synaptic VPN engaged."],
      ["SYS", "Routing cognition through encrypted mesh. Control token issued."],
    ],
    effects: { stability: 0, contamination: 0, alarm: -14 },
    controlTokensDelta: +1,
    tagsAdded: ["NEURO"],
    installsNeuralLink: true,
  }),

  CORTEX_KEY: (_ctx) => ({
    log: [
      ["NET", "Cortex Key: Bluebackdoor acquired."],
      ["SYS", "Privilege escalation confirmed. Control tokens issued."],
    ],
    effects: { stability: 0, contamination: 0, alarm: -18 },
    controlTokensDelta: +2,
    tagsAdded: ["NEURO"],
    installsNeuralLink: true,
  }),

  PULSE_FORGE: (_ctx) => ({
    log: [
      ["BIO", "Synth-Heart: Pulse Forge fabricated."],
      ["SYS", "Passive: +3 stability per spin. Under high alarm, runs hot."],
    ],
    effects: { stability: 0, contamination: 0, alarm: 0 },
    organInstall: {
      id: "PULSE_FORGE",
      name: "Synth-Heart: Pulse Forge",
      desc: "Each spin: Stability +3. If Alarm > 60 at decay: Contamination +2.",
    },
    tagsAdded: ["ORGAN"],
  }),

  DEEP_BREATHER: (_ctx) => ({
    log: [
      ["BIO", "Cyber-Gills: Deep Breather installed."],
      ["SYS", "Passive: Contamination increases reduced 25%. Mutagen stability gains -10%."],
    ],
    effects: { stability: 0, contamination: 0, alarm: 0 },
    organInstall: {
      id: "DEEP_BREATHER",
      name: "Cyber-Gills: Deep Breather",
      desc: "Reduce contamination increases by 25%. Mutagen stability gains -10%.",
    },
    tagsAdded: ["ORGAN"],
  }),

  TITANIUM_LACE: (_ctx) => ({
    log: [
      ["BIO", "Bone Lattice: Titanium Lace fused."],
      ["SYS", "Passive: Prevent first critical failure. Alarm increases amplified +10%."],
    ],
    effects: { stability: 0, contamination: 0, alarm: 0 },
    organInstall: {
      id: "TITANIUM_LACE",
      name: "Bone Lattice: Titanium Lace",
      desc: "Negates first critical failure event. Alarm increases +10%.",
    },
    tagsAdded: ["ORGAN"],
  }),

  NULL_GENOME: (_ctx) => ({
    log: [
      ["ANOM", "Glitched Genome detected: ███-NULL"],
      ["SYS", "Choice required. Procedure cannot continue without operator decision."],
    ],
    effects: { stability: 0, contamination: 0, alarm: 0 },
    anomalyChoice: true,
  }),

  MUTAGEN_VIRID: (_ctx) => ({
    log: [
      ["SEQ", "Virid Spill released: Emerald Fever..."],
      ["SYS", "Aggressive metabolic acceleration initiated."],
    ],
    effects: { stability: +26, contamination: +16, alarm: +4 },
    tagsAdded: ["VIRID"],
  }),

  NEURO_TUNNEL: (_ctx) => ({
    log: [
      ["NET", "Neuro-Tunnel: Whisper Route established."],
      ["SYS", "Low-noise rerouting online. Control token issued."],
    ],
    effects: { stability: 0, contamination: 0, alarm: -12 },
    controlTokensDelta: +1,
    tagsAdded: ["NEURO"],
    installsNeuralLink: true,
  }),

  ORGAN_LENS: (_ctx) => ({
    log: [
      ["BIO", "Retina-Lens: Spectral IR grafted."],
      ["SYS", "Passive: reduces Camera Sweep penalty; increases anomaly detection."],
    ],
    effects: { stability: 0, contamination: 0, alarm: 0 },
    organInstall: {
      id: "ORGAN_LENS",
      name: "Retina-Lens: Spectral IR",
      desc: "Camera Sweep penalty reduced. Anomalies more frequent (but less lethal).",
    },
    tagsAdded: ["ORGAN"],
  }),

  MUTAGEN_NOVA: (_ctx) => ({
    log: [
      ["SEQ", "Nova Serum injected: Whiteout Pulse..."],
      ["SYS", "High-energy strand reset. Massive gains with heavy trace."],
    ],
    effects: { stability: +42, contamination: +26, alarm: +10 },
    tagsAdded: ["NOVA"],
  }),

  NEURO_SPOOF: (_ctx) => ({
    log: [
      ["NET", "Cortex Spoofer: Grey Key deployed."],
      ["SYS", "Identity spoof locked. Control tokens issued."],
    ],
    effects: { stability: 0, contamination: 0, alarm: -20 },
    controlTokensDelta: +2,
    tagsAdded: ["NEURO"],
    installsNeuralLink: true,
  }),

  ANOMALY_ECHO: (_ctx) => ({
    log: [
      ["ANOM", "Echo Strain detected: MIRROR-FLARE"],
      ["SYS", "Reality duplication event: choose stability vs stealth."],
    ],
    effects: { stability: 0, contamination: 0, alarm: 0 },
    anomalyChoice: "ECHO",
  }),
};

function buildConicGradient(sectors) {
  const n = sectors.length;
  const slices = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 100;
    const b = ((i + 1) / n) * 100;
    const base = i % 2 === 0 ? "rgba(0,255,255,0.18)" : "rgba(57,255,20,0.16)";
    const glow =
      sectors[i].rarity === "LEGENDARY" ? "rgba(255,140,0,0.14)"
      : sectors[i].rarity === "EPIC" ? "rgba(255,0,255,0.12)"
      : base;
    slices.push(`${glow} ${a}% ${b}%`);
  }
  return `conic-gradient(from -90deg, ${slices.join(", ")})`;
}

function GlitchOverlay() {
  const slices = Array.from({ length: 8 }).map((_, i) => i);
  return (
    <div className="glitch-overlay active">
      {slices.map((i) => (
        <div
          key={i}
          className="slice"
          style={{
            top: `${i * 11}vh`,
            transform: `translateX(${(i % 2 === 0 ? -1 : 1) * (2 + i)}vmin)`,
            opacity: 0.15 + i * 0.05,
          }}
        />
      ))}
    </div>
  );
}

function Meter({ label, value, max, color, warnAt, dangerAt }) {
  const pct = clamp((value / max) * 100, 0, 100);
  const state = value >= dangerAt ? "DANGER" : value >= warnAt ? "WARN" : "OK";
  return (
    <div className="panel p-[1.4vmin]">
      <div className="flex items-center justify-between">
        <div className="os-title text-[1.3vmin]" style={{ color }}>{label}</div>
        <div className="badge">
          <span style={{ color: state === "DANGER" ? "rgba(255,140,0,0.9)" : state === "WARN" ? "rgba(0,255,255,0.9)" : "rgba(57,255,20,0.9)" }}>
            {state}
          </span>{" "}
          <span className="opacity-80">{Math.round(value)}/{max}</span>
        </div>
      </div>
      <div className="meter mt-[1.0vmin]" style={{ borderRadius: "0.9vmin", border: "1px solid rgba(0,255,255,0.18)", overflow: "hidden", background: "rgba(0,0,0,0.35)", height: "2.3vmin", minHeight: "16px" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, transition: "width 240ms ease", boxShadow: "0 0 1.3vmin rgba(0,255,255,0.25)" }} />
      </div>
    </div>
  );
}

function Switch({ label, value, onChange }) {
  return (
    <div className="panel p-[1.4vmin] flex items-center justify-between">
      <div className="text-[1.35vmin] opacity-90">{label}</div>
      <div className="switch">
        <div
          className={`switch-btn ${value ? "on" : ""}`}
          role="switch"
          aria-checked={value}
          tabIndex={0}
          onClick={() => onChange(!value)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onChange(!value); }}
        >
          <div className="switch-knob" />
        </div>
      </div>
    </div>
  );
}

function SequencerWheel({ sectors, rotationRef }) {
  const wheelRef = useRef(null);
  useEffect(() => { rotationRef.current = { wheelEl: wheelRef.current }; }, [rotationRef]);

  const gradient = useMemo(() => buildConicGradient(sectors), [sectors]);
  const n = sectors.length;

  return (
    <div className="sequencer-wrap" style={{ width: "min(92vmin, 92vw)", height: "min(92vmin, 92vw)", maxWidth: "96vmin", maxHeight: "96vmin", position: "relative" }}>
      <div className="pointer" />
      <div ref={wheelRef} className="sequencer" style={{ backgroundImage: gradient }} aria-label="Genetic Sequencer">
        {sectors.map((s, i) => {
          const angle = (i / n) * 360;
          return (
            <div
              key={`${s.key}-${i}`}
              className="sector-label"
              style={{ transform: `rotate(${angle}deg) translate(0, -50%)` }}
              title={`${s.type} | ${s.rarity} | ${s.name}`}
            >
              <span style={{ color: rarityColor(s.rarity) }}>[{s.type}]&nbsp;</span>
              <span>{s.name}</span>
            </div>
          );
        })}
        <div className="core">
          <div className="status" style={{ color: PALETTE.blue }}>SYSTEM // SEQUENCER</div>
          <div className="sub"><span style={{ color: PALETTE.green }}>XG-OS</span> | lobby / store / settings / run</div>
        </div>
      </div>
    </div>
  );
}

/** ---------------------------
 *  STORE ITEMS (persistent upgrades)
 *  --------------------------- */
function makeStoreItems(upgrades) {
  return [
    {
      id: "START_TOKENS_1",
      title: "Bootleg Control Token",
      cost: 120,
      desc: "Start each run with +1 Control Token.",
      owned: upgrades.startTokens >= 1,
      canBuy: upgrades.startTokens < 1,
      apply: (u) => ({ ...u, startTokens: 1 }),
    },
    {
      id: "START_TOKENS_2",
      title: "Smuggled Token Cache",
      cost: 260,
      desc: "Start each run with +2 Control Tokens (overrides +1).",
      owned: upgrades.startTokens >= 2,
      canBuy: upgrades.startTokens < 2,
      apply: (u) => ({ ...u, startTokens: 2 }),
    },
    {
      id: "ALARM_SHUNT",
      title: "Alarm Shunt",
      cost: 180,
      desc: "Reduce starting Alarm by 10 (min 0).",
      owned: upgrades.startAlarmDown >= 10,
      canBuy: upgrades.startAlarmDown < 10,
      apply: (u) => ({ ...u, startAlarmDown: 10 }),
    },
    {
      id: "STABILITY_PRIMER",
      title: "Stability Primer",
      cost: 180,
      desc: "Increase starting Stability by +12.",
      owned: upgrades.startStabilityUp >= 12,
      canBuy: upgrades.startStabilityUp < 12,
      apply: (u) => ({ ...u, startStabilityUp: 12 }),
    },
    {
      id: "CONTAM_SHIELD",
      title: "Contamination Micro-Shield",
      cost: 220,
      desc: "Each time contamination increases, reduce it by 2 (after % modifiers).",
      owned: upgrades.contamShield >= 2,
      canBuy: upgrades.contamShield < 2,
      apply: (u) => ({ ...u, contamShield: 2 }),
    },
    {
      id: "VENT_BOOST",
      title: "Vent Booster",
      cost: 160,
      desc: "Vent action removes +8 extra contamination.",
      owned: upgrades.ventBoost >= 8,
      canBuy: upgrades.ventBoost < 8,
      apply: (u) => ({ ...u, ventBoost: 8 }),
    },
    {
      id: "GHOST_BOOST",
      title: "Ghost Amplifier",
      cost: 160,
      desc: "Ghost action reduces +6 extra Alarm.",
      owned: upgrades.ghostBoost >= 6,
      canBuy: upgrades.ghostBoost < 6,
      apply: (u) => ({ ...u, ghostBoost: 6 }),
    },
    {
      id: "SECTOR_PACK_A",
      title: "Sector Pack A: Greenline Mods",
      cost: 240,
      desc: "Adds 3 new sectors (Mutagen/Neural/Organ) to the sequencer pool.",
      owned: upgrades.unlockedSectorPackA,
      canBuy: !upgrades.unlockedSectorPackA,
      apply: (u) => ({ ...u, unlockedSectorPackA: true }),
    },
    {
      id: "SECTOR_PACK_B",
      title: "Sector Pack B: Blacksite Echo",
      cost: 320,
      desc: "Adds 3 new sectors including a new anomaly strain.",
      owned: upgrades.unlockedSectorPackB,
      canBuy: !upgrades.unlockedSectorPackB,
      apply: (u) => ({ ...u, unlockedSectorPackB: true }),
    },
  ];
}

/** ---------------------------
 *  MAIN APP
 *  --------------------------- */
function App() {
  const rotationRef = useRef({ wheelEl: null });
  const glitchHostRef = useRef(null);

  // Screens: lobby | game | knct4 | store | settings
  const [screen, setScreen] = useState("lobby");
  const [iconSet, setIconSet] = useState({});

  const supabaseClient = useMemo(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !window.supabase) return null;
    try {
      return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true },
      });
    } catch (_) {
      return null;
    }
  }, []);

  const [mpStatus, setMpStatus] = useState({
    configured: !!supabaseClient,
    connected: false,
    mode: null,
    roomCode: null,
    role: null,
    playerId: null,
    lastEvent: "-",
    error: null,
    presence: 0,
  });
  const [mpUserId, setMpUserId] = useState(null);
  const mpChannelRef = useRef(null);
  const [mpJoinModal, setMpJoinModal] = useState({ open: false, mode: null, code: "" });
  const [raceOpponent, setRaceOpponent] = useState({ status: "IDLE", lastEvent: "-", winner: null });
  const [offlineBanner, setOfflineBanner] = useState(!supabaseClient);

  // Persistent settings/upgrades
  const [settings, setSettings] = useState(() => ({ ...DEFAULT_SETTINGS, ...loadJSON(LS_KEYS.settings, {}) }));
  const [upgrades, setUpgrades] = useState(() => ({ ...DEFAULT_UPGRADES, ...loadJSON(LS_KEYS.upgrades, {}) }));

  const [geneCredits, setGeneCredits] = useState(() => safeParseInt(localStorage.getItem(LS_KEYS.geneCredits), 0));
  const bestRun = safeParseInt(localStorage.getItem(LS_KEYS.bestRun), 0);
  const [knctChipSetId, setKnctChipSetId] = useState(
    () => localStorage.getItem(LS_KEYS.knctChipSet) || KNCT4_CHIPSETS[0].id
  );
  const [knctLastResult, setKnctLastResult] = useState(
    () => loadJSON(LS_KEYS.knctLastResult, null)
  );

  useEffect(() => {
    let active = true;
    import("https://cdn.skypack.dev/lucide-react")
      .then((mod) => {
        if (active) setIconSet(mod || {});
      })
      .catch(() => {
        if (active) setIconSet({});
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!supabaseClient) {
      setMpStatus((s) => ({ ...s, configured: false, connected: false }));
      setOfflineBanner(true);
      return;
    }
    setMpStatus((s) => ({ ...s, configured: true }));
    setOfflineBanner(false);
    supabaseClient.auth.getSession().then(({ data }) => {
      if (data?.session?.user?.id) setMpUserId(data.session.user.id);
    });
    supabaseClient.auth.signInAnonymously().then(({ data, error }) => {
      if (error) {
        setMpStatus((s) => ({ ...s, error: error.message }));
        return;
      }
      if (data?.user?.id) setMpUserId(data.user.id);
    });
  }, [supabaseClient]);

  useEffect(() => {
    return () => {
      if (mpChannelRef.current && supabaseClient) {
        supabaseClient.removeChannel(mpChannelRef.current);
      }
    };
  }, [supabaseClient]);

  // Apply UI intensity to CSS variable
  useEffect(() => {
    const v = clamp(Number(settings.uiIntensity || 1), 0.6, 1.2);
    document.documentElement.style.setProperty("--ui-intensity", String(v));
  }, [settings.uiIntensity]);

  // Build sector pool depending on store purchases
  const sectors = useMemo(() => {
    let pool = [...BASE_SECTORS];
    if (upgrades.unlockedSectorPackA) pool = pool.concat(SECTOR_PACK_A);
    if (upgrades.unlockedSectorPackB) pool = pool.concat(SECTOR_PACK_B);
    return pool;
  }, [upgrades.unlockedSectorPackA, upgrades.unlockedSectorPackB]);

  const n = sectors.length;

  // Game phases (only relevant on game screen)
  const [phase, setPhase] = useState("await_spin");
  const [isSpinning, setIsSpinning] = useState(false);

  // Run state
  const [cycle, setCycle] = useState(1);
  const [maxCycles, setMaxCycles] = useState(settings.maxCycles || 12);

  const [stability, setStability] = useState(40);
  const [contamination, setContamination] = useState(0);
  const [alarm, setAlarm] = useState(0);

  const [tags, setTags] = useState([]);
  const [organs, setOrgans] = useState([]);
  const [organSlots, setOrganSlots] = useState(3);

  const [controlTokens, setControlTokens] = useState(0);
  const [biasShift, setBiasShift] = useState(0);
  const [patchArmed, setPatchArmed] = useState(false);

  const [negatedCritical, setNegatedCritical] = useState(false);
  const [rustCount, setRustCount] = useState(0);

  const [lastDrop, setLastDrop] = useState(null);
  const [runEnd, setRunEnd] = useState(null);

  const [anomalyMode, setAnomalyMode] = useState(null); // null | "NULL" | "ECHO"

  // Run stats (contracts + clarity)
  const [runStats, setRunStats] = useState({
    maxAlarm: 0,
    maxContamination: 0,
    mutagenCount: 0,
    tokensGained: 0,
    anomalySeen: false,
    extractedWithAlarm: null,
  });

  // Track peaks over time
  useEffect(() => {
    setRunStats((s) => ({
      ...s,
      maxAlarm: Math.max(s.maxAlarm, alarm),
      maxContamination: Math.max(s.maxContamination, contamination),
    }));
  }, [alarm, contamination]);

  const [logLines, setLogLines] = useState([
    { t: "BOOT", m: "XG-OS kernel loaded." },
    { t: "SYS",  m: "Main lobby online. Awaiting operator." },
  ]);
  const [knctLogLines, setKnctLogLines] = useState([
    { t: "BOOT", m: "Connect-4 grid initialized." },
    { t: "SYS", m: "Awaiting link signal." },
  ]);

  const [knctBoard, setKnctBoard] = useState(() => makeKnct4Board());
  const [knctPlayer, setKnctPlayer] = useState(1);
  const [knctStarter, setKnctStarter] = useState(1);
  const [knctMoves, setKnctMoves] = useState([]);
  const [knctWinner, setKnctWinner] = useState(null);
  const [knctHoverCol, setKnctHoverCol] = useState(null);
  const [knctScores, setKnctScores] = useState(() => ({
    p1: 0,
    p2: 0,
    draws: 0,
    ...loadJSON(LS_KEYS.knctScores, {}),
  }));


  // Snapshot helper
  const snapshotRef = useRef(null);
  useEffect(() => {
    snapshotRef.current = { stability, contamination, alarm, tags, organs, controlTokens, cycle, rustCount, organSlots, patchArmed };
  }, [stability, contamination, alarm, tags, organs, controlTokens, cycle, rustCount, organSlots, patchArmed]);
  function getSnapshot() { return snapshotRef.current || { stability, contamination, alarm, tags, organs, controlTokens, cycle, rustCount, organSlots, patchArmed }; }

  function pushLog(tag, msg) {
    setLogLines((prev) => {
      const next = [...prev, { t: tag, m: msg }];
      return next.slice(-16);
    });
  }

  function pushKnctLog(tag, msg) {
    setKnctLogLines((prev) => {
      const next = [...prev, { t: tag, m: msg }];
      return next.slice(-16);
    });
  }

  function setMpEvent(msg) {
    setMpStatus((s) => ({ ...s, lastEvent: msg }));
  }

  function copyRoomCode(code) {
    if (!code) return;
    try {
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(code);
      } else {
        window.prompt("Copy invite code", code);
      }
      setMpEvent("code-copied");
    } catch (_) {
      window.prompt("Copy invite code", code);
    }
  }

  function leaveRoom(reason = null) {
    if (mpChannelRef.current && supabaseClient) {
      supabaseClient.removeChannel(mpChannelRef.current);
    }
    mpChannelRef.current = null;
    setMpStatus((s) => ({
      ...s,
      connected: false,
      mode: null,
      roomCode: null,
      role: null,
      playerId: null,
      presence: 0,
      error: reason || null,
      lastEvent: reason ? `left: ${reason}` : s.lastEvent,
    }));
    setRaceOpponent({ status: "IDLE", lastEvent: "-", winner: null });
  }

  function mpBroadcast(event, payload) {
    const ch = mpChannelRef.current;
    if (!ch) return;
    ch.send({ type: "broadcast", event, payload });
    setMpEvent(event);
  }

  function broadcastKnctState(reason = "state", override = {}) {
    const payload = {
      board: knctBoard,
      player: knctPlayer,
      starter: knctStarter,
      moves: knctMoves,
      winner: knctWinner,
      scores: knctScores,
      chipSetId: knctChipSetId,
      lastResult: knctLastResult,
      reason,
      ...override,
    };
    mpBroadcast("knct4-state", payload);
  }

  function applyKnctSnapshot(payload) {
    if (!payload) return;
    setKnctBoard(payload.board || makeKnct4Board());
    setKnctPlayer(payload.player || 1);
    setKnctStarter(payload.starter || 1);
    setKnctMoves(payload.moves || []);
    setKnctWinner(payload.winner || null);
    setKnctScores(payload.scores || { p1: 0, p2: 0, draws: 0 });
    if (payload.chipSetId) setKnctChipSetId(payload.chipSetId);
    if (payload.lastResult) setKnctLastResult(payload.lastResult);
    setKnctHoverCol(null);
  }

  function handleRaceEvent(payload) {
    if (!payload) return;
    if (payload.type === "status") {
      setRaceOpponent((s) => ({ ...s, status: payload.status || s.status, lastEvent: payload.msg || s.lastEvent }));
    } else if (payload.type === "win") {
      setRaceOpponent((s) => ({ ...s, status: "WIN", winner: payload.playerId || "OPP", lastEvent: payload.msg || "Opponent extracted" }));
    }
  }

  function connectRoom(mode, code, role) {
    if (!supabaseClient) {
      setOfflineBanner(true);
      setMpStatus((s) => ({ ...s, error: "Supabase not configured" }));
      return;
    }
    const roomCode = normalizeRoomCode(code);
    if (!roomCode) {
      setMpStatus((s) => ({ ...s, error: "Invalid room code" }));
      return;
    }
    leaveRoom();

    const channel = supabaseClient.channel(`xg-${mode}-${roomCode}`, {
      config: { presence: { key: mpUserId || getDeviceId() } },
    });
    mpChannelRef.current = channel;
    setMpStatus((s) => ({
      ...s,
      mode,
      roomCode,
      role,
      playerId: role === "host" ? 1 : 2,
      connected: false,
      error: null,
      presence: 0,
    }));
    setRaceOpponent({ status: "WAITING", lastEvent: "-", winner: null });

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      const count = Object.keys(state || {}).length;
      setMpStatus((s) => ({ ...s, presence: count }));
      if (count > 2) {
        leaveRoom("Room full");
      }
    });

    channel.on("broadcast", { event: "hello" }, ({ payload }) => {
      if (role === "host" && mode === "knct4") {
        broadcastKnctState("sync");
      }
      if (role === "host" && mode === "race") {
        mpBroadcast("race-event", { type: "status", msg: "Host ready", playerId: 1 });
      }
      setMpEvent(`hello:${payload?.from || "peer"}`);
    });

    channel.on("broadcast", { event: "knct4-move" }, ({ payload }) => {
      if (mode === "knct4" && role === "host" && payload?.col !== undefined) {
        handleKnctDrop(payload.col, { remote: true });
        setMpEvent("knct4-move");
      }
    });

    channel.on("broadcast", { event: "knct4-state" }, ({ payload }) => {
      if (mode === "knct4" && role === "guest") {
        applyKnctSnapshot(payload);
        setMpEvent(payload?.reason || "knct4-state");
      }
    });

    channel.on("broadcast", { event: "race-event" }, ({ payload }) => {
      if (mode === "race") {
        handleRaceEvent(payload);
        setMpEvent(payload?.type || "race-event");
      }
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        channel.track({ joinedAt: Date.now(), role });
        setMpStatus((s) => ({ ...s, connected: true }));
        setMpEvent("connected");
        if (role === "guest") {
          mpBroadcast("hello", { from: role });
        }
        if (role === "host" && mode === "knct4") {
          broadcastKnctState("sync");
        }
        if (role === "host" && mode === "race") {
          mpBroadcast("race-event", { type: "status", status: "HOST_READY", msg: "Host ready", playerId: 1 });
        }
      }
    });
  }

  function createRoom(mode) {
    const code = makeRoomCode();
    connectRoom(mode, code, "host");
    if (mode === "knct4") {
      setScreen("knct4");
      resetKnctMatch(1);
    } else if (mode === "race") {
      setScreen("game");
    }
  }

  function joinRoom(mode, code) {
    connectRoom(mode, code, "guest");
    if (mode === "knct4") setScreen("knct4");
    if (mode === "race") setScreen("game");
  }

  function glitchPulse(duration = 0.35) {
    if (!glitchHostRef.current || settings.reducedMotion) return;
    gsap.killTweensOf(glitchHostRef.current);
    gsap.fromTo(glitchHostRef.current, { opacity: 0 }, { opacity: 1, duration: duration * 0.25, ease: "power2.out" });
    gsap.to(glitchHostRef.current, { opacity: 0, duration, ease: "power2.in", delay: duration * 0.2 });
  }

  useEffect(() => {
    if (!glitchHostRef.current) return;
    gsap.set(glitchHostRef.current, { opacity: 0 });
  }, []);

  useEffect(() => {
    if (settings.reducedMotion) return;
    const tl = gsap.timeline({ repeat: -1, yoyo: true });
    tl.to(".panel, .panel-2", { duration: 1.6, opacity: 0.98, ease: "sine.inOut" })
      .to(".panel, .panel-2", { duration: 1.9, opacity: 0.92, ease: "sine.inOut" });
    return () => tl.kill();
  }, [settings.reducedMotion]);

  useEffect(() => {
    saveJSON(LS_KEYS.knctScores, knctScores);
  }, [knctScores]);

  useEffect(() => {
    if (knctChipSetId) localStorage.setItem(LS_KEYS.knctChipSet, knctChipSetId);
  }, [knctChipSetId]);

  useEffect(() => {
    saveJSON(LS_KEYS.knctLastResult, knctLastResult);
  }, [knctLastResult]);


  useEffect(() => {
    if (screen !== "knct4") return;
    pushKnctLog("SYS", "Connect-4 lobby handshake complete.");
  }, [screen]);


  function resetKnctMatch(nextStarter = null) {
    const isMp = mpStatus.connected && mpStatus.mode === "knct4";
    if (isMp && mpStatus.role !== "host") {
      pushKnctLog("ERR", "Host only: reset match.");
      return;
    }
    const starter = nextStarter ?? knctStarter;
    const newBoard = makeKnct4Board();
    setKnctBoard(newBoard);
    setKnctMoves([]);
    setKnctWinner(null);
    setKnctPlayer(starter);
    setKnctHoverCol(null);
    pushKnctLog("SYS", `Match reset. Player ${starter} takes first move.`);
    if (isMp && mpStatus.role === "host") {
      broadcastKnctState("reset", { board: newBoard, player: starter, moves: [], winner: null });
    }
  }

  function startNextKnctMatch() {
    const isMp = mpStatus.connected && mpStatus.mode === "knct4";
    if (isMp && mpStatus.role !== "host") {
      pushKnctLog("ERR", "Host only: new match.");
      return;
    }
    const nextStarter = knctStarter === 1 ? 2 : 1;
    setKnctStarter(nextStarter);
    resetKnctMatch(nextStarter);
  }

  function resetKnctScores() {
    const isMp = mpStatus.connected && mpStatus.mode === "knct4";
    if (isMp && mpStatus.role !== "host") {
      pushKnctLog("ERR", "Host only: reset scores.");
      return;
    }
    setKnctScores({ p1: 0, p2: 0, draws: 0 });
    pushKnctLog("SYS", "Score cache cleared.");
    vibrate([0, 40], settings.haptics);
    if (isMp && mpStatus.role === "host") broadcastKnctState("scores-reset", { scores: { p1: 0, p2: 0, draws: 0 } });
  }

  function updateKnctChipSet(id) {
    const isMp = mpStatus.connected && mpStatus.mode === "knct4";
    if (isMp && mpStatus.role !== "host") {
      pushKnctLog("ERR", "Host only: chip set.");
      return;
    }
    setKnctChipSetId(id);
    if (isMp && mpStatus.role === "host") broadcastKnctState("chipset", { chipSetId: id });
  }

  function handleKnctDrop(col, opts = {}) {
    const { remote = false } = opts;
    if (knctWinner) return;

    const isMp = mpStatus.connected && mpStatus.mode === "knct4";
    if (isMp && !remote) {
      if (knctPlayer !== mpStatus.playerId) {
        pushKnctLog("ERR", "Not your turn.");
        vibrate([0, 40], settings.haptics);
        return;
      }
      if (mpStatus.role === "guest") {
        mpBroadcast("knct4-move", { col });
        pushKnctLog("SYS", "Move sent.");
        return;
      }
    }

    const row = knct4DropRow(knctBoard, col);
    if (row < 0) {
      pushKnctLog("ERR", "Column blocked: no capacity.");
      vibrate([0, 60], settings.haptics);
      return;
    }

    const nextBoard = knctBoard.map((r) => r.slice());
    nextBoard[row][col] = knctPlayer;

    const nextMoves = [...knctMoves, { row, col, player: knctPlayer }];
    setKnctBoard(nextBoard);
    setKnctMoves(nextMoves);

    const winLine = knct4CheckWin(nextBoard, row, col, knctPlayer);
    if (winLine) {
      const nextScores = {
        ...knctScores,
        p1: knctScores.p1 + (knctPlayer === 1 ? 1 : 0),
        p2: knctScores.p2 + (knctPlayer === 2 ? 1 : 0),
      };
      const nextWinner = { player: knctPlayer, cells: winLine };
      const nextLast = { result: "WIN", player: knctPlayer, at: Date.now() };
      setKnctWinner(nextWinner);
      setKnctLastResult(nextLast);
      setKnctScores(nextScores);
      pushKnctLog("WIN", `Player ${knctPlayer} connected 4.`);
      glitchPulse(0.4);
      vibrate([0, 45, 70, 45, 90], settings.haptics);
      playTone(880, 180, settings.sound);
      if (isMp && mpStatus.role === "host") {
        broadcastKnctState("win", {
          board: nextBoard,
          player: knctPlayer,
          moves: nextMoves,
          winner: nextWinner,
          scores: nextScores,
          lastResult: nextLast,
        });
      }
      return;
    }

    if (nextMoves.length >= KNCT4_ROWS * KNCT4_COLS) {
      const nextWinner = { player: 0, cells: [] };
      const nextLast = { result: "DRAW", player: 0, at: Date.now() };
      const nextScores = { ...knctScores, draws: knctScores.draws + 1 };
      setKnctWinner(nextWinner);
      setKnctLastResult(nextLast);
      setKnctScores(nextScores);
      pushKnctLog("SYS", "Grid saturated. Draw logged.");
      vibrate([0, 30, 30, 30], settings.haptics);
      playTone(420, 160, settings.sound);
      if (isMp && mpStatus.role === "host") {
        broadcastKnctState("draw", {
          board: nextBoard,
          player: knctPlayer,
          moves: nextMoves,
          winner: nextWinner,
          scores: nextScores,
          lastResult: nextLast,
        });
      }
      return;
    }

    const nextPlayer = knctPlayer === 1 ? 2 : 1;
    setKnctPlayer(nextPlayer);
    pushKnctLog("SYS", `Player ${nextPlayer} active.`);
    vibrate([0, 16], settings.haptics);
    if (isMp && mpStatus.role === "host") {
      broadcastKnctState("move", {
        board: nextBoard,
        player: nextPlayer,
        moves: nextMoves,
        winner: null,
      });
    }
  }


  function hasOrgan(id) { return organs.some(o => o.id === id); }

  function addTags(newTags) {
    if (!newTags?.length) return;
    setTags((prev) => {
      const set = new Set(prev);
      newTags.forEach(t => set.add(t));
      return Array.from(set);
    });
  }

  function tryComboProcessing(nextTagsSnapshot, nextOrgansSnapshot) {
    const tagSet = new Set(nextTagsSnapshot);

    if (tagSet.has("CRYO") && tagSet.has("NEURO") && !tagSet.has("COLD_SYNC")) {
      pushLog("COMBO", "Cold Sync unlocked: next Mutagen contamination reduced by 50% (one-shot).");
      tagSet.add("COLD_SYNC");
    }

    const hasNull = tagSet.has("NULL");
    const hasAnyOrgan = nextOrgansSnapshot.length > 0;
    if (hasNull && hasAnyOrgan && !tagSet.has("UNLICENSED")) {
      pushLog("COMBO", "Unlicensed Integration: extra organ slot unlocked (max 4). Alarm +8 each cycle.");
      tagSet.add("UNLICENSED");
      setOrganSlots(4);
    }

    return Array.from(tagSet);
  }

  function applyContaminationIncrease(rawInc) {
    let inc = rawInc;
    if (hasOrgan("DEEP_BREATHER")) inc = Math.round(inc * 0.75);
    if (upgrades.contamShield > 0 && inc > 0) inc = Math.max(0, inc - upgrades.contamShield);
    return inc;
  }

  function applyMutagenStabilityGain(rawGain) {
    let g = rawGain;
    if (hasOrgan("DEEP_BREATHER")) g = Math.round(g * 0.90);
    return g;
  }

  function applyAlarmIncrease(rawInc) {
    let inc = rawInc;
    if (hasOrgan("TITANIUM_LACE")) inc = Math.ceil(inc * 1.10);
    return inc;
  }

  function computeSelectedIndex(finalRotationDeg) {
    const normalized = ((finalRotationDeg % 360) + 360) % 360;
    const pointerLocal = (360 - normalized + 90) % 360;
    const sectorSize = 360 / n;
    const baseIndex = Math.floor(pointerLocal / sectorSize);
    return clamp(baseIndex, 0, n - 1);
  }

  function applyProcedure(procSector) {
    const ctx = {
      tags: [...tags],
      hasNeuralLinkInstalled: tags.includes("NEURO"),
      organs: [...organs],
    };

    const fn = PROCEDURES[procSector.key];
    if (!fn) {
      pushLog("ERR", `Missing procedure for sector key: ${procSector.key}`);
      return { forcedChoice: false };
    }

    const out = fn(ctx);
    (out.log || []).forEach(([t, m]) => pushLog(t, m));

    // Anomaly entry
    if (out.anomalyChoice) {
      setRunStats((s) => ({ ...s, anomalySeen: true }));
      if (out.anomalyChoice === true) setAnomalyMode("NULL");
      else if (out.anomalyChoice === "ECHO") setAnomalyMode("ECHO");
      setPhase("anomaly_choice");
      setLastDrop({ ...procSector });
      return { forcedChoice: true };
    }

    let ds = out.effects?.stability || 0;
    let dc = out.effects?.contamination || 0;
    let da = out.effects?.alarm || 0;

    if (procSector.type === "MUTAGEN") {
      ds = applyMutagenStabilityGain(ds);

      if (tags.includes("COLD_SYNC")) {
        pushLog("SYS", "Cold Sync applied: mutagen contamination reduced by 50% (one-shot).");
        dc = Math.round(dc * 0.5);
        setTags((prev) => prev.filter(t => t !== "COLD_SYNC"));
      }
    }

    if (dc > 0) dc = applyContaminationIncrease(dc);
    if (da > 0) da = applyAlarmIncrease(da);

    setStability((v) => v + ds);
    setContamination((v) => v + dc);
    setAlarm((v) => Math.max(0, v + da));

    if (out.controlTokensDelta) {
      setControlTokens((v) => Math.max(0, v + out.controlTokensDelta));
      setRunStats((s) => ({ ...s, tokensGained: s.tokensGained + out.controlTokensDelta }));
    }
    if (out.installsNeuralLink) addTags(["NEURO"]);

    if (out.organInstall) {
      setOrgans((prev) => {
        if (prev.some(o => o.id === out.organInstall.id)) {
          pushLog("SYS", `Organ already installed: ${out.organInstall.name}`);
          return prev;
        }
        const slotMax = organSlots;
        if (prev.length >= slotMax) {
          pushLog("WARN", `No organ slots available (${slotMax}). Organ scrapped.`);
          return prev;
        }
        pushLog("SYS", `Organ installed: ${out.organInstall.name}`);
        return [...prev, out.organInstall];
      });
    }

    if (out.tagsAdded?.length) {
      if (out.tagsAdded.includes("RUST")) setRustCount((c) => c + 1);
      addTags(out.tagsAdded);
    }

    setLastDrop({ ...procSector });

    // Stats: mutagen count
    if (procSector.type === "MUTAGEN") {
      setRunStats((s) => ({ ...s, mutagenCount: s.mutagenCount + 1 }));
    }

    // Rust combo
    if (procSector.key === "HELIX_RUST") {
      const nextRust = rustCount + 1;
      if (nextRust >= 2) {
        pushLog("COMBO", "Oxidation Cascade: Stability +20, Alarm +15.");
        setStability((v) => v + 20);
        setAlarm((v) => v + applyAlarmIncrease(15));
      }
    }

    setTags((prev) => tryComboProcessing(prev, organs));
    return { forcedChoice: false };
  }

  function triggerPhase(nextStability, nextContam, nextAlarm) {
    let negEventTriggered = false;

    if (nextContam >= 85 && !tags.includes("FOG")) {
      negEventTriggered = true;
      if (patchArmed) {
        pushLog("NET", "PATCH consumed: Containment Fog prevented.");
        setPatchArmed(false);
      } else {
        pushLog("WARN", "Containment Fog: Bias disabled until you Vent once.");
        addTags(["FOG"]);
      }
    }

    if (nextContam >= 60 && !tags.includes("BIOFILM")) {
      pushLog("SYS", "Biofilm Bloom active: Mutagens get +5 stability, but contamination spikes +8.");
      addTags(["BIOFILM"]);
    }

    if (nextContam >= 30) {
      if (roll(0.10)) {
        negEventTriggered = true;
        if (patchArmed) {
          pushLog("NET", "PATCH consumed: Spore Drift canceled.");
          setPatchArmed(false);
        } else {
          pushLog("ERR", "Spore Drift: Stability -10.");
          setStability((v) => v - 10);
        }
      }
    }

    if (nextAlarm >= 30 && !tags.includes("CAM_SWEEP")) {
      pushLog("SYS", "Camera Sweep: Ghost effectiveness reduced.");
      addTags(["CAM_SWEEP"]);
    }

    if (nextAlarm >= 60 && !tags.includes("SENTINEL_WARMUP")) {
      pushLog("WARN", "Sentinel Warmup: each spin adds Alarm +3.");
      addTags(["SENTINEL_WARMUP"]);
    }

    if (nextAlarm >= 80 && tags.includes("NULL") && !tags.includes("TRACE_LOCK")) {
      negEventTriggered = true;
      if (patchArmed) {
        pushLog("NET", "PATCH consumed: Sentinel Trace prevented.");
        setPatchArmed(false);
      } else {
        pushLog("ERR", "Sentinel Trace: Alarm +10. Next cycle actions restricted.");
        setAlarm((v) => v + applyAlarmIncrease(10));
        addTags(["TRACE_LOCK"]);
      }
    }

    if (hasOrgan("TITANIUM_LACE") && negEventTriggered && !negatedCritical) {
      pushLog("SYS", "Titanium Lace triggered: first critical failure NEGATED.");
      setNegatedCritical(true);
      setTags((prev) => prev.filter(t => t !== "TRACE_LOCK" && t !== "FOG"));
      setStability((v) => v + 10);
      setAlarm((v) => Math.max(0, v - 10));
    }
  }

  function decayPhase() {
    if (hasOrgan("PULSE_FORGE") && alarm > 60) {
      pushLog("WARN", "Pulse Forge runs hot under pressure: Contamination +2.");
      setContamination((v) => v + applyContaminationIncrease(2));
    }
    if (tags.includes("UNLICENSED")) {
      pushLog("WARN", "Unlicensed Integration trace bleed: Alarm +8.");
      setAlarm((v) => v + applyAlarmIncrease(8));
    }
  }

  function checkEndConditions(nextStability, nextContam, nextAlarm) {
    if (nextContam >= 100) { endRun("FAIL", "Containment Breach: contamination reached 100."); return true; }
    if (nextAlarm >= 100) { endRun("FAIL", "Blacksite Lockdown: alarm reached 100."); return true; }
    return false;
  }

  function computeBaseCredits({ win }) {
    const comboCount =
      (tags.includes("COLD_SYNC") ? 1 : 0) +
      (rustCount >= 2 ? 1 : 0) +
      (tags.includes("UNLICENSED") ? 1 : 0);

    const risk = Math.floor((Math.max(contamination, alarm) / 100) * 25);
    const base = win ? 80 : 25;
    const stabBonus = Math.floor(clamp(stability, 0, 150) * 0.5);
    const comboBonus = comboCount * 18;

    return base + stabBonus + comboBonus + risk;
  }

  function computeContractBonus({ win, extractedAlarm }) {
    if (!win) return { bonus: 0, met: false, reason: "Contract requires extraction success." };

    // PRIMARY IDENTITY: Quiet Extraction
    const met = extractedAlarm < 50;
    return met
      ? { bonus: PRIMARY_CONTRACT.bonus, met: true, reason: null }
      : { bonus: 0, met: false, reason: `Alarm was ${extractedAlarm}. Must be < 50.` };
  }

  function endRun(type, reason, options = {}) {
    if (phase === "ended") return;

    const win = type === "WIN";
    const extractedAlarm = win ? (options.extractedAlarmOverride ?? alarm) : null;

    const baseEarned = computeBaseCredits({ win });
    const contract = computeContractBonus({ win, extractedAlarm: extractedAlarm ?? 999 });
    const earned = baseEarned + contract.bonus;

    const newCredits = geneCredits + earned;
    setGeneCredits(newCredits);
    localStorage.setItem(LS_KEYS.geneCredits, String(newCredits));

    const best = safeParseInt(localStorage.getItem(LS_KEYS.bestRun), 0);
    if (earned > best) localStorage.setItem(LS_KEYS.bestRun, String(earned));

    setRunStats((s) => ({ ...s, extractedWithAlarm: extractedAlarm }));

    setRunEnd({
      type,
      reason,
      creditsEarned: earned,
      baseEarned,
      contractBonus: contract.bonus,
      contractMet: contract.met,
      contractReason: contract.reason,
      extractedAlarm,
      runStats,
      contract: PRIMARY_CONTRACT,
    });

    setPhase("ended");
    setIsSpinning(false);

    pushLog(win ? "WIN" : "FAIL", reason);
    pushLog("SYS", `Gene Credits earned: +${earned}. Total: ${newCredits}.`);
    if (win) {
      if (contract.bonus > 0) pushLog("CONTRACT", `${PRIMARY_CONTRACT.title} met: +${contract.bonus} GC bonus.`);
      else pushLog("CONTRACT", `${PRIMARY_CONTRACT.title} missed: ${contract.reason}`);
    }

    if (mpStatus.connected && mpStatus.mode === "race") {
      if (win) {
        mpBroadcast("race-event", { type: "win", msg: "Extracted", playerId: mpStatus.playerId });
      } else {
        mpBroadcast("race-event", { type: "status", status: "FAILED", msg: "Run failed", playerId: mpStatus.playerId });
      }
    }

    glitchPulse(0.55);
    vibrate(win ? [0, 40, 80, 40, 120] : [0, 140, 60, 140], settings.haptics);
  }

  function startNewRun() {
    const preset = difficultyPreset(settings.difficulty);
    const cycles = clamp(settings.maxCycles || preset.maxCycles, 8, 18);

    setScreen("game");
    setPhase("await_spin");
    setIsSpinning(false);

    setCycle(1);
    setMaxCycles(cycles);

    const baseSt = preset.startStability + (upgrades.startStabilityUp || 0);
    const baseAl = Math.max(0, preset.startAlarm - (upgrades.startAlarmDown || 0));
    const baseCo = preset.startContam;

    setStability(baseSt);
    setAlarm(baseAl);
    setContamination(baseCo);

    setTags([]);
    setOrgans([]);
    setOrganSlots(3);

    setControlTokens(upgrades.startTokens || 0);
    setBiasShift(0);
    setPatchArmed(false);

    setNegatedCritical(false);
    setRustCount(0);

    setLastDrop(null);
    setRunEnd(null);

    setAnomalyMode(null);

    setRunStats({
      maxAlarm: 0,
      maxContamination: 0,
      mutagenCount: 0,
      tokensGained: 0,
      anomalySeen: false,
      extractedWithAlarm: null,
    });

    setLogLines([
      { t: "BOOT", m: "XG-OS kernel loaded." },
      { t: "SYS", m: "Run initialized from Lobby parameters." },
      { t: "HINT", m: "Cycle 1: use tokens (if any), then spin SEQUENCE." },
      { t: "CONTRACT", m: `${PRIMARY_CONTRACT.title}: ${PRIMARY_CONTRACT.desc} (+${PRIMARY_CONTRACT.bonus} GC)` },
    ]);

    glitchPulse(0.4);
    vibrate([0, 20, 40, 20], settings.haptics);

    if (mpStatus.connected && mpStatus.mode === "race") {
      mpBroadcast("race-event", { type: "status", status: "RUNNING", msg: "Run started", playerId: mpStatus.playerId });
    }
  }

  function abortToLobby() {
    setScreen("lobby");
    pushLog("SYS", "Returned to Lobby.");
    glitchPulse(0.25);
  }

  /** --------- Token controls (pre-spin) --------- */
  function useBias(dir) {
    if (phase !== "await_spin" || isSpinning) return;
    if (controlTokens <= 0) return;
    if (tags.includes("FOG")) {
      pushLog("WARN", "Containment Fog: Bias disabled until Vent clears it.");
      return;
    }
    setControlTokens((v) => v - 1);
    setBiasShift(dir);
    pushLog("NET", `Bias armed (${dir > 0 ? "+1" : "-1"}): next stop nudged.`);
    glitchPulse(0.22);
    vibrate([0, 18], settings.haptics);
  }

  function usePatch() {
    if (phase !== "await_spin" || isSpinning) return;
    if (controlTokens <= 0) return;
    setControlTokens((v) => v - 1);
    setPatchArmed(true);
    pushLog("NET", "Patch armed: next negative threshold event canceled.");
    glitchPulse(0.22);
    vibrate([0, 18], settings.haptics);
  }

  /** --------- Spin --------- */
  function spinSequencer() {
    if (phase !== "await_spin" || isSpinning) return;

    const wheelEl = rotationRef.current.wheelEl;
    if (!wheelEl) { pushLog("ERR", "Wheel DOM not ready."); return; }

    if (tags.includes("SENTINEL_WARMUP")) {
      pushLog("WARN", "Sentinel Warmup tax: Alarm +3 on spin.");
      setAlarm((v) => v + applyAlarmIncrease(3));
    }

    if (hasOrgan("PULSE_FORGE")) {
      pushLog("SYS", "Pulse Forge passive: Stability +3.");
      setStability((v) => v + 3);
    }

    setIsSpinning(true);
    glitchPulse(0.45);
    pushLog("SEQ", `Cycle ${cycle}/${maxCycles}: Sequencer armed.`);

    const turns = 5 + Math.random() * 4;
    const extra = Math.random() * 360;
    const final = turns * 360 + extra;

    gsap.killTweensOf(wheelEl);
    gsap.fromTo(wheelEl, { rotate: 0 }, { rotate: 12, duration: 0.12, ease: "power2.out" });

    gsap.to(wheelEl, {
      rotate: final,
      duration: settings.reducedMotion ? 1.2 : 3.0,
      ease: "power4.out",
      onStart: () => glitchPulse(0.25),
      onComplete: () => {
        setIsSpinning(false);
        vibrate([0, 35, 45, 35], settings.haptics);

        const baseIdx = computeSelectedIndex(final);
        let idx = baseIdx;

        if (biasShift !== 0) {
          idx = clamp(baseIdx + biasShift, 0, n - 1);
          pushLog("NET", `Bias applied: ${baseIdx} → ${idx}.`);
          setBiasShift(0);
        }

        const picked = sectors[idx];
        pushLog("LOCK", `Stop achieved. Sector index=${idx}.`);
        pushLog("DROP", `${picked.type}: ${picked.name} (${picked.rarity}).`);
        glitchPulse(0.35);

        if (tags.includes("BIOFILM") && picked.type === "MUTAGEN") {
          pushLog("SYS", "Biofilm Bloom: Mutagen Stability +5, Contamination +8.");
          setStability((v) => v + 5);
          setContamination((v) => v + applyContaminationIncrease(8));
        }

        const { forcedChoice } = applyProcedure(picked);

        if (!forcedChoice) {
          setPhase("await_action");
          setTimeout(() => {
            const st = getSnapshot();
            triggerPhase(st.stability, st.contamination, st.alarm);
            const ended = checkEndConditions(st.stability, st.contamination, st.alarm);
            if (!ended) pushLog("HINT", "Action Phase: choose one action.");
          }, 0);
        }

        if (!settings.reducedMotion) {
          gsap.to(wheelEl, {
            rotate: final + (Math.random() > 0.5 ? 1 : -1) * (2 + Math.random() * 3),
            duration: 0.28,
            ease: "sine.inOut",
            yoyo: true,
            repeat: 1,
          });
        }
      },
    });
  }

  /** --------- Anomaly choices --------- */
  function chooseAnomaly(option) {
    if (phase !== "anomaly_choice") return;

    if (anomalyMode === "NULL") {
      if (option === "PURGE") {
        pushLog("SYS", "Purge & Stabilize: Stability -15, Contamination -25, Alarm +10.");
        setStability((v) => v - 15);
        setContamination((v) => Math.max(0, v - 25));
        setAlarm((v) => v + applyAlarmIncrease(10));
      } else {
        pushLog("ANOM", "Embrace Null: Stability +35, Alarm +25, Tag NULL.");
        setStability((v) => v + 35);
        setAlarm((v) => v + applyAlarmIncrease(25));
        addTags(["NULL"]);
      }
    } else if (anomalyMode === "ECHO") {
      if (option === "STABILITY") {
        pushLog("ANOM", "Echo: Stability Fork selected. Stability +30, Contamination +12.");
        setStability((v) => v + 30);
        setContamination((v) => v + applyContaminationIncrease(12));
      } else {
        pushLog("ANOM", "Echo: Stealth Fork selected. Alarm -22, Stability -8.");
        setAlarm((v) => Math.max(0, v - 22));
        setStability((v) => v - 8);
      }
    }

    glitchPulse(0.45);
    vibrate([0, 22, 40, 22], settings.haptics);

    setPhase("await_action");
    setTimeout(() => {
      const st = getSnapshot();
      triggerPhase(st.stability, st.contamination, st.alarm);
      checkEndConditions(st.stability, st.contamination, st.alarm);
      pushLog("HINT", "Action Phase: choose one action.");
    }, 0);
  }

  /** --------- Actions --------- */
  function clearFogIfVent() {
    if (tags.includes("FOG")) {
      pushLog("SYS", "Vent cleared FOG: Bias re-enabled.");
      setTags((prev) => prev.filter(t => t !== "FOG"));
    }
  }

  function consumeTraceLockIfActionTaken() {
    if (tags.includes("TRACE_LOCK")) {
      pushLog("SYS", "Trace lock decayed after action.");
      setTags((prev) => prev.filter(t => t !== "TRACE_LOCK"));
    }
  }

  function endCycleAdvance() {
    decayPhase();
    setCycle((c) => c + 1);

    setTimeout(() => {
      const st = getSnapshot();
      const ended = checkEndConditions(st.stability, st.contamination, st.alarm);
      if (!ended) {
        if (cycle >= maxCycles) {
          endRun("FAIL", `Protocol timeout: exceeded ${maxCycles} cycles without extraction.`);
        } else {
          setPhase("await_spin");
          pushLog("HINT", `Cycle ${cycle + 1}/${maxCycles}: use tokens then spin.`);
        }
      }
    }, 0);
  }

  function actionExtract() {
    if (phase !== "await_action") return;
    const st = getSnapshot();
    if (st.stability < 100) { pushLog("ERR", "Extraction denied: Stability must be >= 100."); vibrate([0, 70], settings.haptics); return; }
    if (st.contamination >= 100 || st.alarm >= 100) { pushLog("ERR", "Extraction impossible: facility already failed."); return; }

    let extractedAlarm = st.alarm;
    if (st.stability >= 120) {
      extractedAlarm = Math.max(0, st.alarm - 10);
      pushLog("SYS", "Clean exit: Stability >= 120 reduced Alarm by 10.");
      setAlarm(extractedAlarm);
    }

    // Store extraction alarm for stats clarity
    setRunStats((s) => ({ ...s, extractedWithAlarm: extractedAlarm }));

    endRun("WIN", "Extraction successful: Stability >= 100 and facility meters remained below 100.", { extractedAlarmOverride: extractedAlarm });
  }

  function actionVent() {
    if (phase !== "await_action") return;
    if (tags.includes("TRACE_LOCK")) { pushLog("ERR", "Trace Lock: Vent blocked this cycle."); vibrate([0, 60], settings.haptics); return; }

    const base = 18 + (upgrades.ventBoost || 0);
    pushLog("ACT", `Vent Chamber: Contamination -${base}, Alarm +8.`);
    setContamination((v) => Math.max(0, v - base));
    setAlarm((v) => v + applyAlarmIncrease(8));

    clearFogIfVent();
    consumeTraceLockIfActionTaken();
    glitchPulse(0.22);

    setTimeout(() => {
      const st = getSnapshot();
      triggerPhase(st.stability, st.contamination, st.alarm);
    }, 0);

    endCycleAdvance();
  }

  function actionGhost() {
    if (phase !== "await_action") return;

    const half = tags.includes("CAM_SWEEP") && !hasOrgan("ORGAN_LENS");
    const base = half ? -8 : -15;
    const boosted = base - (upgrades.ghostBoost || 0);

    pushLog("ACT", `Ghost Network: Alarm ${boosted}, Stability -6.`);
    if (half) pushLog("WARN", "Camera Sweep penalty: Ghost halved (Spectral IR can reduce this).");

    setAlarm((v) => Math.max(0, v + boosted));
    setStability((v) => v - 6);

    consumeTraceLockIfActionTaken();
    glitchPulse(0.22);

    setTimeout(() => {
      const st = getSnapshot();
      triggerPhase(st.stability, st.contamination, st.alarm);
    }, 0);

    endCycleAdvance();
  }

  function actionBuffer() {
    if (phase !== "await_action") return;
    if (tags.includes("TRACE_LOCK")) { pushLog("ERR", "Trace Lock: Buffer blocked this cycle."); vibrate([0, 60], settings.haptics); return; }

    const hasNeuro = tags.includes("NEURO");
    const contamInc = hasNeuro ? 4 : 7;

    pushLog("ACT", `Synthesize Buffer: Stability +10, Contamination +${contamInc}.`);
    setStability((v) => v + 10);
    setContamination((v) => v + applyContaminationIncrease(contamInc));

    consumeTraceLockIfActionTaken();
    glitchPulse(0.22);

    setTimeout(() => {
      const st = getSnapshot();
      triggerPhase(st.stability, st.contamination, st.alarm);
    }, 0);

    endCycleAdvance();
  }

  function actionReroute() {
    if (phase !== "await_action") return;
    if (controlTokens <= 0) { pushLog("ERR", "Re-route denied: no Control Tokens."); return; }

    pushLog("NET", "Re-route: immediate re-spin. Overprocessing: Contamination +5.");
    setControlTokens((v) => v - 1);
    setContamination((v) => v + applyContaminationIncrease(5));

    glitchPulse(0.35);
    vibrate([0, 22], settings.haptics);

    setPhase("await_spin");
    setTimeout(() => {
      const st = getSnapshot();
      triggerPhase(st.stability, st.contamination, st.alarm);
      checkEndConditions(st.stability, st.contamination, st.alarm);
      pushLog("HINT", "Re-route: spin again (must accept second result).");
    }, 0);
  }

  /** ---------------------------
   *  SETTINGS SCREEN handlers
   *  --------------------------- */
  function persistSettings(next) {
    const merged = { ...settings, ...next };
    merged.uiIntensity = clamp(Number(merged.uiIntensity || 1.0), 0.6, 1.2);
    merged.maxCycles = clamp(safeParseInt(merged.maxCycles, 12), 8, 18);
    setSettings(merged);
    saveJSON(LS_KEYS.settings, merged);
    pushLog("SYS", "Settings saved.");
    glitchPulse(0.2);
    vibrate([0, 14], merged.haptics);
  }

  function resetProgress() {
    localStorage.removeItem(LS_KEYS.geneCredits);
    localStorage.removeItem(LS_KEYS.bestRun);
    localStorage.removeItem(LS_KEYS.upgrades);

    setGeneCredits(0);
    setUpgrades({ ...DEFAULT_UPGRADES });
    saveJSON(LS_KEYS.upgrades, { ...DEFAULT_UPGRADES });

    pushLog("SYS", "Progress wiped: credits/upgrades reset.");
    glitchPulse(0.35);
    vibrate([0, 90], settings.haptics);
  }

  /** ---------------------------
   *  STORE SCREEN handlers
   *  --------------------------- */
  function buyItem(item) {
    if (!item.canBuy) return;
    if (geneCredits < item.cost) {
      pushLog("ERR", "Insufficient Gene Credits.");
      vibrate([0, 70], settings.haptics);
      return;
    }

    const nextUp = item.apply(upgrades);
    const nextCredits = geneCredits - item.cost;

    setUpgrades(nextUp);
    saveJSON(LS_KEYS.upgrades, nextUp);

    setGeneCredits(nextCredits);
    localStorage.setItem(LS_KEYS.geneCredits, String(nextCredits));

    pushLog("SYS", `Purchased: ${item.title} (-${item.cost} GC).`);
    glitchPulse(0.35);
    vibrate([0, 22, 40, 22], settings.haptics);
  }

  const storeItems = useMemo(() => makeStoreItems(upgrades), [upgrades]);

  /** ---------------------------
   *  UI Helpers
   *  --------------------------- */
  const extractReady = stability >= 100 && contamination < 100 && alarm < 100;
  const knctChipSet = KNCT4_CHIPSETS.find((set) => set.id === knctChipSetId) || KNCT4_CHIPSETS[0];
  const knctWinningSet = useMemo(() => {
    const entries = knctWinner?.cells || [];
    return new Set(entries.map((cell) => `${cell.row}-${cell.col}`));
  }, [knctWinner]);
  const knctStatusText = knctWinner
    ? (knctWinner.player === 0 ? "GRID DRAW" : `PLAYER ${knctWinner.player} CONNECTED`)
    : `PLAYER ${knctPlayer} TURN`;
  const knctMovesLeft = KNCT4_ROWS * KNCT4_COLS - knctMoves.length;
  const knctMotionStyle = settings.reducedMotion ? { transition: "none" } : null;
  const DnaIcon = iconSet.Dna;
  const ActivityIcon = iconSet.Activity;
  const GamepadIcon = iconSet.Gamepad2;
  const SettingsIcon = iconSet.Settings;
  const SparklesIcon = iconSet.Sparkles;
  const LayersIcon = iconSet.Layers;
  const CircleDotIcon = iconSet.CircleDot;

  function navButton(id, label) {
    const active = screen === id;
    return (
      <button
        className="xg-btn"
        style={active ? { background: "rgba(0,255,255,0.18)", borderColor: "rgba(0,255,255,0.35)" } : null}
        onClick={() => { setScreen(id); pushLog("SYS", `Opened ${label}.`); glitchPulse(0.18); }}
      >
        {label}
      </button>
    );
  }

  function openJoinModal(mode) {
    setMpJoinModal({ open: true, mode, code: "" });
  }

  function submitJoin() {
    if (!mpJoinModal.code) return;
    joinRoom(mpJoinModal.mode, mpJoinModal.code);
    setMpJoinModal({ open: false, mode: null, code: "" });
  }

  /** ---------------------------
   *  RENDER SCREENS
   *  --------------------------- */
  function LobbyScreen() {
    return (
      <div className="grid grid-cols-1 md:grid-cols-[1.15fr_0.85fr] gap-[1.6vmin] min-h-0 lobby-screen">
        <div className="panel p-[2vmin] min-h-0 flex flex-col lobby-hero">
          <div className="flex items-center justify-between">
            <div className="os-title text-[1.8vmin]" style={{ color: PALETTE.blue }}>MAIN LOBBY</div>
            <div className="text-[1.25vmin] opacity-80">
              Credits: <span style={{ color: PALETTE.green }}>{geneCredits}</span>{" "}
              | Best: <span style={{ color: PALETTE.blue }}>{bestRun}</span>
            </div>
          </div>
          <div className="hr-scan my-[1.2vmin]" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-[1.2vmin]">
            <div className="panel-2 p-[1.8vmin] md:col-span-2 lobby-accent lobby-banner">
              <div className="os-title text-[1.35vmin]" style={{ color: PALETTE.green }}>GAME BAY</div>
              <div className="mt-[1.2vmin] grid grid-cols-1 md:grid-cols-2 gap-[1.2vmin]">
                <div className="game-card">
                  <div className="flex items-center gap-[1.0vmin]">
                    <div className="game-icon">
                      <IconBadge icon={DnaIcon} label="DNA" color={PALETTE.green} className="game-icon-svg" />
                    </div>
                    <div>
                      <div className="os-title text-[1.3vmin]" style={{ color: PALETTE.green }}>SEQUENCER WHEEL</div>
                      <div className="text-[1.2vmin] opacity-80">Bio-lab extraction runs</div>
                    </div>
                  </div>
                  <div className="mt-[1.0vmin] text-[1.25vmin] opacity-85">
                    Spin the sequencer, stack mutagens, and extract with stealth discipline.
                  </div>
                  <button className="xg-btn w-full mt-[1.2vmin]" onClick={startNewRun}>
                    Enter Sequencer
                  </button>
                </div>


                <div className="game-card">
                  <div className="flex items-center gap-[1.0vmin]">
                    <div className="game-icon">
                      <IconBadge icon={GamepadIcon} label="GRID" color={PALETTE.blue} className="game-icon-svg" />
                    </div>
                    <div>
                      <div className="os-title text-[1.3vmin]" style={{ color: PALETTE.blue }}>CONNECT-4</div>
                      <div className="text-[1.2vmin] opacity-80">Two-player drop duel</div>
                    </div>
                  </div>
                  <div className="mt-[1.0vmin] text-[1.25vmin] opacity-85">
                    Drop chips, build a 4-in-a-row chain, and block your rival.
                  </div>
                  <button className="xg-btn w-full mt-[1.2vmin]" onClick={() => setScreen("knct4")}>
                    Launch Connect-4
                  </button>
                </div>
              </div>
            </div>

            <div className="panel-2 p-[1.8vmin] lobby-accent">
              <div className="os-title text-[1.35vmin]" style={{ color: PALETTE.green }}>MULTIPLAYER BAY</div>
              <div className="mt-[1.0vmin] grid grid-cols-1 gap-[1.0vmin]">
                <div className="mp-card">
                  <div className="os-title text-[1.2vmin]" style={{ color: PALETTE.blue }}>CONNECT-4 HEAD-TO-HEAD</div>
                  <div className="mt-[0.6vmin] text-[1.15vmin] opacity-80">Private room, 2 players, turn-based.</div>
                  <div className="mp-row mt-[0.8vmin]">
                    <button className="xg-btn" disabled={!mpStatus.configured || !mpUserId} onClick={() => createRoom("knct4")}>Create Room</button>
                    <button className="xg-btn" disabled={!mpStatus.configured || !mpUserId} onClick={() => openJoinModal("knct4")}>Join by Code</button>
                  </div>
                </div>
                <div className="mp-card">
                  <div className="os-title text-[1.2vmin]" style={{ color: PALETTE.green }}>SEQUENCER RACE</div>
                  <div className="mt-[0.6vmin] text-[1.15vmin] opacity-80">First to extract wins. Real-time status.</div>
                  <div className="mp-row mt-[0.8vmin]">
                    <button className="xg-btn" disabled={!mpStatus.configured || !mpUserId} onClick={() => createRoom("race")}>Create Room</button>
                    <button className="xg-btn" disabled={!mpStatus.configured || !mpUserId} onClick={() => openJoinModal("race")}>Join by Code</button>
                  </div>
                </div>
                {mpStatus.connected && (
                  <div className="panel p-[1.0vmin]">
                    <div className="text-[1.1vmin] opacity-85">
                      Room <span style={{ color: PALETTE.blue }}>{mpStatus.roomCode}</span> | Role <span style={{ color: PALETTE.green }}>{mpStatus.role}</span>
                    </div>
                    <div className="mp-row mt-[0.6vmin]">
                      <button className="xg-btn" onClick={() => copyRoomCode(mpStatus.roomCode)}>Copy Code</button>
                      <button className="xg-btn" onClick={() => leaveRoom("manual")}>Leave Room</button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="panel-2 p-[1.8vmin] lobby-accent">
              <div className="os-title text-[1.35vmin]" style={{ color: PALETTE.green }}>RUN CONFIG // SEQUENCER</div>
              <div className="mt-[1.0vmin] text-[1.35vmin] opacity-85">
                Difficulty: <span style={{ color: PALETTE.blue }}>{settings.difficulty}</span><br />
                Max Cycles: <span style={{ color: PALETTE.blue }}>{clamp(settings.maxCycles, 8, 18)}</span><br />
                Start Tokens: <span style={{ color: PALETTE.green }}>{upgrades.startTokens}</span><br />
                Start Stability: <span style={{ color: PALETTE.blue }}>{difficultyPreset(settings.difficulty).startStability + (upgrades.startStabilityUp || 0)}</span><br />
                Start Alarm: <span style={{ color: "rgba(255,140,0,0.88)" }}>{Math.max(0, difficultyPreset(settings.difficulty).startAlarm - (upgrades.startAlarmDown || 0))}</span>
              </div>

              <div className="mt-[1.4vmin] grid grid-cols-1 gap-[1.0vmin]">
                <button className="xg-btn" onClick={startNewRun}>
                  Start Extraction Run
                </button>
                <button className="xg-btn" onClick={() => setScreen("store")}>
                  Open Store
                </button>
                <button className="xg-btn" onClick={() => setScreen("settings")}>
                  Settings
                </button>
              </div>
            </div>

            <div className="panel-2 p-[1.8vmin] lobby-accent">
              <div className="os-title text-[1.35vmin]" style={{ color: PALETTE.blue }}>PRIMARY CONTRACT</div>
              <div className="mt-[1.0vmin] text-[1.35vmin] opacity-85">
                <span style={{ color: PALETTE.green }}>{PRIMARY_CONTRACT.title}</span><br />
                {PRIMARY_CONTRACT.desc}<br />
                Bonus: <span style={{ color: PALETTE.blue }}>+{PRIMARY_CONTRACT.bonus} GC</span>
              </div>
              <div className="mt-[1.2vmin] text-[1.2vmin] opacity-75">
                This defines the game’s identity loop: extraction discipline under stealth constraints.
              </div>
            </div>

            <div className="panel p-[1.8vmin] md:col-span-2 lobby-accent">
              <div className="os-title text-[1.35vmin]" style={{ color: PALETTE.blue }}>SYSTEM BRIEF</div>
              <div className="mt-[1.0vmin] text-[1.35vmin] opacity-85">
                Spin to execute procedures. Manage <span style={{ color: PALETTE.blue }}>Stability</span>, avoid
                <span style={{ color: PALETTE.green }}> Contamination</span> and
                <span style={{ color: "rgba(255,140,0,0.88)" }}> Alarm</span>.
                Extract with <span style={{ color: PALETTE.green }}>Stability ≥ 100</span> before either meter hits 100.
              </div>
            </div>
          </div>
        </div>

        <div className="panel-2 p-[2vmin] min-h-0 flex flex-col">
          <div className="os-title text-[1.8vmin]" style={{ color: PALETTE.green }}>LOBBY CONSOLE</div>
          <div className="hr-scan my-[1.2vmin]" />

          <div className="panel p-[1.6vmin] mb-[1.2vmin]">
            <div className="os-title text-[1.35vmin]" style={{ color: PALETTE.blue }}>UPGRADES INSTALLED</div>
            <div className="mt-[0.8vmin] text-[1.3vmin] opacity-85">
              Contam Shield: <span style={{ color: PALETTE.green }}>{upgrades.contamShield}</span><br />
              Ghost Boost: <span style={{ color: PALETTE.blue }}>{upgrades.ghostBoost}</span><br />
              Vent Boost: <span style={{ color: PALETTE.blue }}>{upgrades.ventBoost}</span><br />
              Sector Pack A: <span style={{ color: upgrades.unlockedSectorPackA ? PALETTE.green : "rgba(255,140,0,0.88)" }}>{upgrades.unlockedSectorPackA ? "UNLOCKED" : "LOCKED"}</span><br />
              Sector Pack B: <span style={{ color: upgrades.unlockedSectorPackB ? PALETTE.green : "rgba(255,140,0,0.88)" }}>{upgrades.unlockedSectorPackB ? "UNLOCKED" : "LOCKED"}</span>
            </div>
          </div>

          <div className="panel flex-1 min-h-0 p-[1.6vmin] overflow-hidden">
            <div className="os-title text-[1.35vmin]" style={{ color: PALETTE.blue }}>SYSTEM LOG</div>
            <div className="mt-[1.0vmin] log h-full overflow-auto pr-[0.8vmin]">
              {logLines.map((ln, i) => (
                <div key={i} className="line">
                  <span className={ln.t === "ERR" || ln.t === "FAIL" ? "tag2" : "tag"}>[{ln.t}]</span>{" "}
                  <span>{ln.m}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  function SettingsScreen() {
    return (
      <div className="panel p-[2vmin] min-h-0 flex flex-col">
        <div className="flex items-center justify-between">
          <div className="os-title text-[1.8vmin]" style={{ color: PALETTE.blue }}>SETTINGS</div>
          <button className="xg-btn" onClick={() => setScreen("lobby")}>Back to Lobby</button>
        </div>
        <div className="hr-scan my-[1.2vmin]" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-[1.2vmin]">
          <Switch
            label="Haptics (vibration)"
            value={!!settings.haptics}
            onChange={(v) => persistSettings({ haptics: v })}
          />
          <Switch
            label="Sound (UI tones)"
            value={!!settings.sound}
            onChange={(v) => persistSettings({ sound: v })}
          />
          <Switch
            label="Reduced Motion (cuts animations)"
            value={!!settings.reducedMotion}
            onChange={(v) => persistSettings({ reducedMotion: v })}
          />

          <div className="panel p-[1.4vmin]">
            <div className="os-title text-[1.35vmin]" style={{ color: PALETTE.green }}>Difficulty</div>
            <div className="mt-[1.0vmin] grid grid-cols-3 gap-[0.8vmin]">
              {["EASY","STANDARD","HARD"].map((d) => (
                <button
                  key={d}
                  className="xg-btn"
                  style={settings.difficulty === d ? { background: "rgba(57,255,20,0.16)" } : null}
                  onClick={() => {
                    const preset = difficultyPreset(d);
                    persistSettings({ difficulty: d, maxCycles: preset.maxCycles });
                  }}
                >
                  {d}
                </button>
              ))}
            </div>
            <div className="mt-[1.0vmin] text-[1.2vmin] opacity-75">
              Difficulty changes default run start values and cycle limits.
            </div>
          </div>

          <div className="panel p-[1.4vmin]">
            <div className="os-title text-[1.35vmin]" style={{ color: PALETTE.blue }}>Max Cycles</div>
            <div className="mt-[1.0vmin] field">
              <label>Clamp range: 8–18</label>
              <input
                className="xg-input"
                type="number"
                value={settings.maxCycles}
                min={8}
                max={18}
                onChange={(e) => persistSettings({ maxCycles: e.target.value })}
              />
            </div>
            <div className="mt-[1.0vmin] text-[1.2vmin] opacity-75">
              More cycles = more opportunities, but more time for alarm/contamination to spike.
            </div>
          </div>

          <div className="panel p-[1.4vmin] md:col-span-2">
            <div className="os-title text-[1.35vmin]" style={{ color: PALETTE.blue }}>UI Intensity</div>
            <div className="mt-[1.0vmin] field">
              <label>CRT scanlines / glow strength (0.6–1.2)</label>
              <input
                className="xg-input"
                type="number"
                step="0.05"
                min={0.6}
                max={1.2}
                value={settings.uiIntensity}
                onChange={(e) => persistSettings({ uiIntensity: e.target.value })}
              />
            </div>
          </div>

          <div className="panel p-[1.4vmin] md:col-span-2">
            <div className="os-title text-[1.35vmin]" style={{ color: "rgba(255,140,0,0.88)" }}>Danger Zone</div>
            <div className="mt-[1.0vmin] text-[1.3vmin] opacity-85">
              Resetting wipes Gene Credits, best run, and all upgrades.
            </div>
            <div className="mt-[1.2vmin] flex gap-[1.0vmin]">
              <button className="xg-btn" onClick={resetProgress} style={{ borderColor: "rgba(255,140,0,0.45)" }}>
                Reset Progress
              </button>
              <button className="xg-btn" onClick={() => persistSettings(DEFAULT_SETTINGS)}>
                Restore Default Settings
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function StoreScreen() {
    return (
      <div className="panel p-[2vmin] min-h-0 flex flex-col">
        <div className="flex items-center justify-between">
          <div className="os-title text-[1.8vmin]" style={{ color: PALETTE.blue }}>STORE // BLACK MARKET</div>
          <div className="flex items-center gap-[1.0vmin]">
            <div className="badge">
              Credits: <span style={{ color: PALETTE.green }}>{geneCredits}</span>
            </div>
            <button className="xg-btn" onClick={() => setScreen("lobby")}>Back to Lobby</button>
          </div>
        </div>
        <div className="hr-scan my-[1.2vmin]" />

        <div className="store-grid flex-1 min-h-0 overflow-auto pr-[0.6vmin]">
          {storeItems.map((it) => (
            <div key={it.id} className="item-card">
              <div className="flex items-center justify-between">
                <div className="item-title" style={{ color: PALETTE.green }}>{it.title}</div>
                <div className="badge">
                  Cost <span style={{ color: PALETTE.blue }}>{it.cost}</span>
                </div>
              </div>

              <div className="item-desc">{it.desc}</div>

              <div className="mt-[1.2vmin] flex items-center justify-between gap-[1.0vmin]">
                <div className="text-[1.2vmin] opacity-80">
                  Status:{" "}
                  <span style={{ color: it.owned ? PALETTE.green : "rgba(255,140,0,0.88)" }}>
                    {it.owned ? "OWNED" : "AVAILABLE"}
                  </span>
                </div>
                <button
                  className="xg-btn"
                  disabled={!it.canBuy || geneCredits < it.cost}
                  onClick={() => buyItem(it)}
                >
                  {it.owned ? "Purchased" : "Buy"}
                </button>
              </div>

              {!it.owned && geneCredits < it.cost && (
                <div className="mt-[0.8vmin] text-[1.2vmin] opacity-70">
                  Need <span style={{ color: "rgba(255,140,0,0.88)" }}>{it.cost - geneCredits}</span> more credits.
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-[1.0vmin] text-[1.2vmin] opacity-70">
          Purchases persist via localStorage and affect future runs started from the Lobby.
        </div>
      </div>
    );
  }

  function GameScreen() {
    const showAnomaly = phase === "anomaly_choice";

    return (
      <div className="grid grid-cols-1 md:grid-cols-[1.15fr_0.85fr] gap-[1.6vmin] min-h-0 lobby-screen">
        {showAnomaly && (
          <div className="modal" style={{ position: "absolute", inset: 0, zIndex: 60, display: "grid", placeItems: "center", background: "rgba(0,0,0,0.68)", backdropFilter: "blur(0.8vmin)" }}>
            <div className="modal-card">
              <div className="os-title text-[1.8vmin]" style={{ color: "rgba(255,140,0,0.9)" }}>
                ANOMALY: {anomalyMode === "ECHO" ? "ECHO STRAIN MIRROR-FLARE" : "GLITCHED GENOME ███-NULL"}
              </div>
              <div className="hr-scan my-[1.4vmin]" />
              <div className="text-[1.45vmin] opacity-90">
                {anomalyMode === "ECHO"
                  ? "Reality duplication event detected. Choose stability spike or stealth fork."
                  : "Null-strain encountered. Choose purge or embrace."
                }
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-[1.4vmin] mt-[1.6vmin]">
                {anomalyMode === "ECHO" ? (
                  <>
                    <div className="panel p-[1.6vmin]">
                      <div className="os-title text-[1.35vmin]" style={{ color: PALETTE.green }}>STABILITY FORK</div>
                      <div className="mt-[1.0vmin] text-[1.35vmin] opacity-85">
                        Stability +30<br />Contamination +12
                      </div>
                      <button className="xg-btn w-full mt-[1.4vmin]" onClick={() => chooseAnomaly("STABILITY")}>LOCK STABILITY</button>
                    </div>
                    <div className="panel p-[1.6vmin]">
                      <div className="os-title text-[1.35vmin]" style={{ color: PALETTE.blue }}>STEALTH FORK</div>
                      <div className="mt-[1.0vmin] text-[1.35vmin] opacity-85">
                        Alarm -22<br />Stability -8
                      </div>
                      <button className="xg-btn w-full mt-[1.4vmin]" onClick={() => chooseAnomaly("STEALTH")}>GO DARK</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="panel p-[1.6vmin]">
                      <div className="os-title text-[1.35vmin]" style={{ color: PALETTE.blue }}>PURGE & STABILIZE</div>
                      <div className="mt-[1.0vmin] text-[1.35vmin] opacity-85">
                        Stability -15<br />Contamination -25<br />Alarm +10
                      </div>
                      <button className="xg-btn w-full mt-[1.4vmin]" onClick={() => chooseAnomaly("PURGE")}>PURGE</button>
                    </div>
                    <div className="panel p-[1.6vmin]">
                      <div className="os-title text-[1.35vmin]" style={{ color: PALETTE.green }}>EMBRACE NULL</div>
                      <div className="mt-[1.0vmin] text-[1.35vmin] opacity-85">
                        Stability +35<br />Alarm +25<br />Tag: NULL
                      </div>
                      <button className="xg-btn w-full mt-[1.4vmin]" onClick={() => chooseAnomaly("EMBRACE")}>EMBRACE</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="panel p-[2vmin] min-h-0 flex flex-col">
          <div className="flex items-center justify-between">
            <div className="os-title text-[1.8vmin]" style={{ color: PALETTE.blue }}>SEQUENCER BAY</div>
            <div className="text-[1.25vmin] opacity-80">
              Cycle <span style={{ color: PALETTE.blue }}>{cycle}/{maxCycles}</span>{" "}
              | Tokens <span style={{ color: PALETTE.green }}>{controlTokens}</span>{" "}
              | Extract <span style={{ color: extractReady ? PALETTE.green : "rgba(255,140,0,0.88)" }}>{extractReady ? "READY" : "NO"}</span>
            </div>
          </div>
          <div className="hr-scan my-[1.2vmin]" />

          {mpStatus.connected && mpStatus.mode === "race" && (
            <div className="panel p-[1.2vmin] mb-[1.0vmin]">
              <div className="os-title text-[1.35vmin]" style={{ color: PALETTE.blue }}>RACE ROOM</div>
              <div className="mt-[0.6vmin] text-[1.2vmin] opacity-85">
                Code <span style={{ color: PALETTE.blue }}>{mpStatus.roomCode}</span> | Role <span style={{ color: PALETTE.green }}>{mpStatus.role}</span>
              </div>
              <div className="mt-[0.4vmin] text-[1.2vmin] opacity-80">
                Opponent: <span style={{ color: PALETTE.green }}>{raceOpponent.status}</span> ({raceOpponent.lastEvent})
              </div>
              <div className="mp-row mt-[0.8vmin]">
                <button className="xg-btn" onClick={() => copyRoomCode(mpStatus.roomCode)}>Copy Code</button>
                <button className="xg-btn" onClick={() => leaveRoom("manual")}>Leave Room</button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-[1.2vmin]">
            <Meter label="STABILITY" value={stability} max={150} color={PALETTE.blue} warnAt={80} dangerAt={120} />
            <Meter label="CONTAMINATION" value={contamination} max={100} color={PALETTE.green} warnAt={60} dangerAt={85} />
            <Meter label="ALARM" value={alarm} max={100} color={"rgba(255,140,0,0.88)"} warnAt={60} dangerAt={80} />
          </div>

          <div className="mt-[1.6vmin] flex-1 min-h-0 grid place-items-center">
            <SequencerWheel sectors={sectors} rotationRef={rotationRef} />
          </div>

          <div className="mt-[1.4vmin] grid grid-cols-1 md:grid-cols-3 gap-[1.0vmin]">
            <button className="xg-btn" disabled={phase !== "await_spin" || isSpinning || controlTokens <= 0 || tags.includes("FOG")} onClick={() => useBias(-1)}>Bias -1 (1T)</button>
            <button className="xg-btn" disabled={phase !== "await_spin" || isSpinning || controlTokens <= 0 || tags.includes("FOG")} onClick={() => useBias(+1)}>Bias +1 (1T)</button>
            <button className="xg-btn" disabled={phase !== "await_spin" || isSpinning || controlTokens <= 0} onClick={usePatch}>Patch (1T)</button>
          </div>

          <div className="mt-[1.2vmin] flex items-center justify-between gap-[1.2vmin]">
            <button className="xg-btn flex-1" onClick={spinSequencer} disabled={phase !== "await_spin" || isSpinning || phase === "ended"}>
              {isSpinning ? "Sequencing..." : "Sequence"}
            </button>
            <button className="xg-btn" onClick={abortToLobby}>Abort → Lobby</button>
          </div>
        </div>

        <div className="panel-2 p-[2vmin] min-h-0 flex flex-col">
          <div className="os-title text-[1.8vmin]" style={{ color: PALETTE.green }}>EXTRACTION CONSOLE</div>
          <div className="hr-scan my-[1.2vmin]" />

          {mpStatus.connected && mpStatus.mode === "race" && (
            <div className="panel p-[1.2vmin] mb-[1.2vmin]">
              <div className="os-title text-[1.25vmin]" style={{ color: PALETTE.blue }}>RACE HUD</div>
              <div className="mt-[0.6vmin] text-[1.2vmin] opacity-85">You: Player {mpStatus.playerId} | Opponent: {raceOpponent.status}</div>
              <div className="mt-[0.4vmin] text-[1.15vmin] opacity-80">Last: {raceOpponent.lastEvent}</div>
            </div>
          )}

          <div className="panel p-[1.6vmin] mb-[1.2vmin]">
            <div className="os-title text-[1.35vmin]" style={{ color: PALETTE.blue }}>LAST DROP</div>
            {!lastDrop ? (
              <div className="mt-[0.8vmin] text-[1.3vmin] opacity-85">No procedure executed yet.</div>
            ) : (
              <div className="mt-[0.8vmin]">
                <div className="os-title text-[1.3vmin]" style={{ color: rarityColor(lastDrop.rarity) }}>{lastDrop.rarity}</div>
                <div className="mt-[0.4vmin] text-[1.3vmin]">
                  <span style={{ color: PALETTE.blue }}>[{lastDrop.type}]</span>{" "}
                  <span style={{ color: PALETTE.green }}>{lastDrop.name}</span>
                </div>
              </div>
            )}
          </div>

          <div className="panel p-[1.6vmin] mb-[1.2vmin]">
            <div className="os-title text-[1.35vmin]" style={{ color: PALETTE.blue }}>
              SYNTH-ORGANS ({organs.length}/{organSlots})
            </div>
            {organs.length === 0 ? (
              <div className="mt-[0.8vmin] text-[1.3vmin] opacity-80">No organs installed.</div>
            ) : (
              <div className="mt-[0.8vmin] grid gap-[0.8vmin]">
                {organs.map((o) => (
                  <div key={o.id} className="panel p-[1.2vmin]">
                    <div className="os-title text-[1.2vmin]" style={{ color: PALETTE.green }}>{o.name}</div>
                    <div className="text-[1.15vmin] opacity-85 mt-[0.5vmin]">{o.desc}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="panel p-[1.6vmin] mb-[1.2vmin]">
            <div className="os-title text-[1.35vmin]" style={{ color: PALETTE.blue }}>ACTIONS</div>
            <div className="mt-[0.8vmin] grid grid-cols-1 md:grid-cols-2 gap-[1.0vmin]">
              <button className="xg-btn" onClick={actionExtract} disabled={phase !== "await_action" || phase === "ended"}>Extract</button>
              <button className="xg-btn" onClick={actionReroute} disabled={phase !== "await_action" || controlTokens <= 0 || phase === "ended"}>Re-route (1T)</button>
              <button className="xg-btn" onClick={actionVent} disabled={phase !== "await_action" || tags.includes("TRACE_LOCK") || phase === "ended"}>Vent</button>
              <button className="xg-btn" onClick={actionGhost} disabled={phase !== "await_action" || phase === "ended"}>Ghost</button>
              <button className="xg-btn md:col-span-2" onClick={actionBuffer} disabled={phase !== "await_action" || tags.includes("TRACE_LOCK") || phase === "ended"}>Synthesize Buffer</button>
            </div>
          </div>

          <div className="panel flex-1 min-h-0 p-[1.6vmin] overflow-hidden">
            <div className="os-title text-[1.35vmin]" style={{ color: PALETTE.blue }}>SYSTEM LOG</div>
            <div className="mt-[1.0vmin] log h-full overflow-auto pr-[0.8vmin]">
              {logLines.map((ln, i) => (
                <div key={i} className="line">
                  <span className={ln.t === "ERR" || ln.t === "FAIL" ? "tag2" : "tag"}>[{ln.t}]</span>{" "}
                  <span>{ln.m}</span>
                </div>
              ))}
            </div>
          </div>

          {runEnd && (
            <div className="panel p-[1.6vmin] mt-[1.2vmin]">
              <div className="os-title text-[1.35vmin]" style={{ color: runEnd.type === "WIN" ? PALETTE.green : "rgba(255,140,0,0.88)" }}>
                {runEnd.type === "WIN" ? "RUN SUCCESS" : "RUN FAILED"}
              </div>
              <div className="mt-[0.8vmin] text-[1.3vmin] opacity-85">{runEnd.reason}</div>

              <div className="mt-[0.8vmin] text-[1.25vmin] opacity-80">
                Base: <span style={{ color: PALETTE.blue }}>+{runEnd.baseEarned}</span> GC
                {" | "}
                Contract:{" "}
                <span style={{ color: runEnd.contractMet ? PALETTE.green : "rgba(255,140,0,0.88)" }}>
                  {runEnd.contractMet ? `+${runEnd.contractBonus}` : "+0"}
                </span>{" "}
                GC
                {" | "}
                Total: <span style={{ color: PALETTE.green }}>+{runEnd.creditsEarned}</span> GC
              </div>

              {runEnd.type === "WIN" && (
                <div className="mt-[0.8vmin] text-[1.2vmin] opacity-80">
                  {PRIMARY_CONTRACT.title} requirement: Alarm &lt; 50 at extraction.{" "}
                  <span style={{ color: PALETTE.blue }}>
                    (You extracted at Alarm {runEnd.extractedAlarm})
                  </span>
                </div>
              )}

              {runEnd.type === "WIN" && !runEnd.contractMet && runEnd.contractReason && (
                <div className="mt-[0.6vmin] text-[1.2vmin] opacity-80" style={{ color: "rgba(255,140,0,0.88)" }}>
                  {runEnd.contractReason}
                </div>
              )}

              <button className="xg-btn w-full mt-[1.0vmin]" onClick={abortToLobby}>
                Return to Lobby
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  function Knct4Screen() {
    return (
      <div className="grid grid-cols-1 md:grid-cols-[1.15fr_0.85fr] gap-[1.6vmin] min-h-0 lobby-screen">
        <div className="panel p-[2vmin] min-h-0 flex flex-col">
          <div className="flex items-center justify-between">
            <div className="os-title text-[1.8vmin]" style={{ color: PALETTE.blue }}>CONNECT-4 // DROP GRID</div>
            <div className="text-[1.25vmin] opacity-80">
              Status <span style={{ color: knctWinner ? PALETTE.green : PALETTE.blue }}>{knctStatusText}</span>{" "}
              | Moves Left <span style={{ color: PALETTE.green }}>{knctMovesLeft}</span>
            </div>
          </div>
          <div className="hr-scan my-[1.2vmin]" />

          {mpStatus.connected && mpStatus.mode === "knct4" && (
            <div className="panel p-[1.0vmin] mb-[1.0vmin]">
              <div className="text-[1.15vmin] opacity-85">
                Room <span style={{ color: PALETTE.blue }}>{mpStatus.roomCode}</span> | Role <span style={{ color: PALETTE.green }}>{mpStatus.role}</span> | You are Player {mpStatus.playerId}
              </div>
              <div className="mp-row mt-[0.6vmin]">
                <button className="xg-btn" onClick={() => copyRoomCode(mpStatus.roomCode)}>Copy Code</button>
                <button className="xg-btn" onClick={() => leaveRoom("manual")}>Leave Room</button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-[1.0vmin] text-[1.2vmin]">
            <div className="panel p-[1.0vmin] flex items-center gap-[0.8vmin]">
              <IconBadge icon={CircleDotIcon} label="TURN" color={PALETTE.blue} className="game-icon-svg" />
              <div>Active: <span style={{ color: PALETTE.blue }}>Player {knctPlayer}</span></div>
            </div>
            <div className="panel p-[1.0vmin] flex items-center gap-[0.8vmin]">
              <IconBadge icon={ActivityIcon} label="START" color={PALETTE.green} className="game-icon-svg" />
              <div>Starter: <span style={{ color: PALETTE.green }}>Player {knctStarter}</span></div>
            </div>
            <div className="panel p-[1.0vmin] flex items-center gap-[0.8vmin]">
              <IconBadge icon={SparklesIcon} label="CHAIN" color={PALETTE.green} className="game-icon-svg" />
              <div>Connect: <span style={{ color: PALETTE.green }}>4</span></div>
            </div>
            <div className="panel p-[1.0vmin] flex items-center gap-[0.8vmin]">
              <IconBadge icon={LayersIcon} label="GRID" color={PALETTE.blue} className="game-icon-svg" />
              <div>Grid: <span style={{ color: PALETTE.blue }}>7 × 6</span></div>
            </div>
          </div>

          <div className="mt-[1.6vmin] flex-1 min-h-0 grid place-items-center">
            <div
              className="knct-board"
              onPointerLeave={() => setKnctHoverCol(null)}
              style={{ width: "min(78vmin, 92vw)" }}
            >
              <div className="knct-grid">
                {knctBoard.map((row, rIdx) => (
                  row.map((cell, cIdx) => {
                    const cellKey = `${rIdx}-${cIdx}`;
                    const isWin = knctWinningSet.has(cellKey);
                    const isHover = knctHoverCol === cIdx && !knctWinner;
                    const discClass = cell === 1
                      ? "knct-disc knct-disc--p1"
                      : cell === 2
                        ? "knct-disc knct-disc--p2"
                        : "knct-disc knct-disc--empty";
                    const discStyle = cell === 1
                      ? {
                        backgroundColor: knctChipSet.p1.color,
                        backgroundImage: knctChipSet.p1.image ? `url(${knctChipSet.p1.image})` : "none",
                      }
                      : cell === 2
                        ? {
                          backgroundColor: knctChipSet.p2.color,
                          backgroundImage: knctChipSet.p2.image ? `url(${knctChipSet.p2.image})` : "none",
                        }
                        : null;

                    return (
                      <button
                        key={cellKey}
                        type="button"
                        className={`knct-cell ${isHover ? "knct-cell--hover" : ""}`}
                        onPointerEnter={() => setKnctHoverCol(cIdx)}
                        onClick={() => handleKnctDrop(cIdx)}
                        disabled={!!knctWinner}
                        aria-label={`Drop chip in column ${cIdx + 1}`}
                        style={knctMotionStyle}
                      >
                        <span
                          className={`${discClass} ${isWin ? "knct-disc--win" : ""}`}
                          style={{ ...knctMotionStyle, ...discStyle }}
                        />
                      </button>
                    );
                  })
                ))}
              </div>
            </div>
          </div>

          {knctWinner && (
            <div className="panel mt-[1.4vmin] p-[1.2vmin]">
              <div className="os-title text-[1.35vmin]" style={{ color: knctWinner.player === 0 ? "rgba(255,140,0,0.9)" : PALETTE.green }}>
                {knctWinner.player === 0 ? "DRAW" : `PLAYER ${knctWinner.player} WINS`}
              </div>
              <div className="mt-[0.6vmin] text-[1.2vmin] opacity-80">
                {knctWinner.player === 0 ? "Board full. No winner." : "4 in a row confirmed."}
              </div>
            </div>
          )}

          <div className="mt-[1.6vmin] grid grid-cols-2 md:grid-cols-4 gap-[1.0vmin]">
            <button className="xg-btn" onClick={() => resetKnctMatch()} disabled={knctMoves.length === 0 || (mpStatus.connected && mpStatus.mode === "knct4" && mpStatus.role !== "host")}>
              Reset Match
            </button>
            <button className="xg-btn" onClick={startNextKnctMatch} disabled={mpStatus.connected && mpStatus.mode === "knct4" && mpStatus.role !== "host"}>
              New Match
            </button>
            <button className="xg-btn" onClick={() => setScreen("lobby")}>
              Back to Lobby
            </button>
            <button className="xg-btn" onClick={() => setScreen("settings")}>
              Settings
            </button>
            {mpStatus.connected && mpStatus.mode === "knct4" && (
              <button className="xg-btn" onClick={() => leaveRoom("manual")}>
                Leave Room
              </button>
            )}
          </div>
          <div className="mt-[1.0vmin] text-[1.2vmin] opacity-70">
            Tap any column to drop a chip. First player to connect four wins.
          </div>
        </div>

        <div className="panel-2 p-[2vmin] min-h-0 flex flex-col">
          <div className="os-title text-[1.8vmin]" style={{ color: PALETTE.green }}>CONNECT-4 CONSOLE</div>
          <div className="hr-scan my-[1.2vmin]" />

          <div className="panel p-[1.6vmin] mb-[1.2vmin]">
            <div className="os-title text-[1.35vmin]" style={{ color: PALETTE.blue }}>SCORE CORE</div>
            <div className="mt-[0.8vmin] text-[1.3vmin] opacity-85">
              Player 1 Wins: <span style={{ color: PALETTE.blue }}>{knctScores.p1}</span><br />
              Player 2 Wins: <span style={{ color: PALETTE.green }}>{knctScores.p2}</span><br />
              Draws: <span style={{ color: "rgba(255,140,0,0.88)" }}>{knctScores.draws}</span>
            </div>
            <button className="xg-btn w-full mt-[1.0vmin]" onClick={resetKnctScores} disabled={mpStatus.connected && mpStatus.mode === "knct4" && mpStatus.role !== "host"}>
              Purge Score Cache
            </button>
          </div>

          <div className="panel p-[1.6vmin] mb-[1.2vmin]">
            <div className="os-title text-[1.35vmin]" style={{ color: PALETTE.blue }}>CHIP SET</div>
            <div className="knct-chipset-grid mt-[0.8vmin]">
              {KNCT4_CHIPSETS.map((set) => (
                <button
                  key={set.id}
                  type="button"
                  className={`knct-chipset ${knctChipSetId === set.id ? "knct-chipset--active" : ""}`}
                  onClick={() => updateKnctChipSet(set.id)}
                  disabled={mpStatus.connected && mpStatus.mode === "knct4" && mpStatus.role !== "host"}
                >
                  <span className="knct-chipset-label">{set.label}</span>
                  <span className="knct-chipset-swatches">
                    <span
                      className="knct-chipset-swatch"
                      style={{
                        backgroundColor: set.p1.color,
                        backgroundImage: set.p1.image ? `url(${set.p1.image})` : "none",
                      }}
                    />
                    <span
                      className="knct-chipset-swatch"
                      style={{
                        backgroundColor: set.p2.color,
                        backgroundImage: set.p2.image ? `url(${set.p2.image})` : "none",
                      }}
                    />
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-[0.8vmin] text-[1.15vmin] opacity-75">
              Exactly two players active per match. Chip set persists across restarts.
            </div>
          </div>

          {knctLastResult && (
            <div className="panel p-[1.6vmin] mb-[1.2vmin]">
              <div className="os-title text-[1.35vmin]" style={{ color: PALETTE.blue }}>LAST RESULT</div>
              <div className="mt-[0.8vmin] text-[1.25vmin] opacity-85">
                {knctLastResult.result === "DRAW"
                  ? "Draw logged."
                  : `Player ${knctLastResult.player} won the last match.`}
              </div>
            </div>
          )}

          <div className="panel p-[1.6vmin] mb-[1.2vmin]">
            <div className="os-title text-[1.35vmin]" style={{ color: PALETTE.blue }}>TACTICS</div>
            <div className="mt-[0.8vmin] text-[1.25vmin] opacity-85">
              Control the center columns, block 3-in-a-row threats, and pivot to diagonals.
            </div>
          </div>

          <div className="panel flex-1 min-h-0 p-[1.6vmin] overflow-hidden">
            <div className="os-title text-[1.35vmin]" style={{ color: PALETTE.blue }}>GRID LOG</div>
            <div className="mt-[1.0vmin] log h-full overflow-auto pr-[0.8vmin]">
              {knctLogLines.map((ln, i) => (
                <div key={i} className="line">
                  <span className={ln.t === "ERR" || ln.t === "FAIL" ? "tag2" : "tag"}>[{ln.t}]</span>{" "}
                  <span>{ln.m}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /** ---------------------------
   *  Top shell layout
   *  --------------------------- */
  return (
    <div className="crt">
      <div className="noise" />
      <div ref={glitchHostRef}><GlitchOverlay /></div>

      <div className="w-screen min-h-screen p-[2.2vmin] grid grid-rows-[auto_1fr_auto] gap-[1.6vmin] overflow-y-auto">
        {offlineBanner && (
          <div className="banner-offline">Supabase not configured — running offline/local mode</div>
        )}
        <div className="panel px-[2vmin] py-[1.6vmin] flex items-center justify-between">
          <div>
            <div className="os-title text-[2.2vmin] md:text-[1.6vmin]" style={{ color: PALETTE.green }}>
              XENO-GENICS // BIO-LAB SYSTEM OS
            </div>
            <div className="text-[1.45vmin] opacity-80 mt-[0.6vmin]">
              Screen <span style={{ color: PALETTE.blue }}>{screen.toUpperCase()}</span>{" "}
              | Credits <span style={{ color: PALETTE.green }}>{geneCredits}</span>{" "}
              | Haptics <span style={{ color: settings.haptics ? PALETTE.green : "rgba(255,140,0,0.88)" }}>{settings.haptics ? "ON" : "OFF"}</span>
            </div>
          </div>

          <div className="flex items-center gap-[1.0vmin] flex-wrap justify-end">
            {navButton("lobby", "Lobby")}
            {navButton("knct4", "Connect-4")}
            {navButton("store", "Store")}
            {navButton("settings", "Settings")}
            {screen === "game" ? navButton("game", "Run") : null}
          </div>
        </div>

        <div className="min-h-0">
          {screen === "lobby" && <LobbyScreen />}
          {screen === "knct4" && <Knct4Screen />}
          {screen === "store" && <StoreScreen />}
          {screen === "settings" && <SettingsScreen />}
          {screen === "game" && <GameScreen />}
        </div>

        <div className="panel px-[2vmin] py-[1.4vmin] flex items-center justify-between">
          <div className="text-[1.2vmin] opacity-80">
            BUILD: XG-OS / Lobby + Store + Settings + Run + Connect-4 / React18 + Tailwind + GSAP + Babel
          </div>
          <div className="text-[1.2vmin] opacity-80">
            WIN: Extract with Stability ≥ 100 | FAIL: Contam/Alarm reach 100 | CONTRACT: Quiet Extraction (Alarm &lt; 50)
          </div>
        </div>
      </div>
      {mpStatus.error === "Room full" && (
        <div className="modal" style={{ position: "fixed", inset: 0, zIndex: 85, display: "grid", placeItems: "center", background: "rgba(0,0,0,0.68)", backdropFilter: "blur(0.6vmin)" }}>
          <div className="modal-card">
            <div className="os-title text-[1.6vmin]" style={{ color: "rgba(255,140,0,0.9)" }}>ROOM FULL</div>
            <div className="hr-scan my-[1.2vmin]" />
            <div className="text-[1.25vmin] opacity-85">That room already has 2 players. Ask the host for a new code.</div>
            <div className="panel__actions">
              <button className="xg-btn" onClick={() => setMpStatus((s) => ({ ...s, error: null }))}>OK</button>
            </div>
          </div>
        </div>
      )}

      {mpJoinModal.open && (
        <div className="modal" style={{ position: "fixed", inset: 0, zIndex: 80, display: "grid", placeItems: "center", background: "rgba(0,0,0,0.68)", backdropFilter: "blur(0.6vmin)" }}>
          <div className="modal-card">
            <div className="os-title text-[1.6vmin]" style={{ color: PALETTE.blue }}>JOIN ROOM</div>
            <div className="hr-scan my-[1.2vmin]" />
            <div className="text-[1.25vmin] opacity-85">Enter invite code for {mpJoinModal.mode === "knct4" ? "Connect-4" : "Sequencer Race"}.</div>
            <div className="mt-[1.2vmin] field">
              <label>Invite Code</label>
              <input
                className="xg-input"
                value={mpJoinModal.code}
                onChange={(e) => setMpJoinModal((s) => ({ ...s, code: normalizeRoomCode(e.target.value) }))}
                placeholder="e.g. A9K2QZ"
              />
            </div>
            <div className="panel__actions">
              <button className="xg-btn" onClick={() => setMpJoinModal({ open: false, mode: null, code: "" })}>Cancel</button>
              <button className="xg-btn" onClick={submitJoin} disabled={!mpJoinModal.code}>Join</button>
            </div>
          </div>
        </div>
      )}

      <div className="debug-panel">
        <div className="label">Multiplayer Debug</div>
        <div>Configured: <span style={{ color: mpStatus.configured ? PALETTE.green : "rgba(255,140,0,0.88)" }}>{mpStatus.configured ? "YES" : "NO"}</span></div>
        <div>Connected: <span style={{ color: mpStatus.connected ? PALETTE.green : "rgba(255,140,0,0.88)" }}>{mpStatus.connected ? "YES" : "NO"}</span></div>
        <div>Mode: {mpStatus.mode || "-"}</div>
        <div>Room: {mpStatus.roomCode || "-"}</div>
        <div>Role: {mpStatus.role || "-"} (P{mpStatus.playerId || "-"})</div>
        <div>Presence: {mpStatus.presence}</div>
        <div>Last Event: {mpStatus.lastEvent}</div>
        {mpStatus.error && <div style={{ color: "rgba(255,140,0,0.88)" }}>Error: {mpStatus.error}</div>}
      </div>

    </div>
  );
}

/** REQUIRED: prevent blank pages in WebView */
(function mount() {
  const rootEl = document.getElementById("root");
  if (!rootEl) {
    document.body.innerHTML = "<pre style='color:#39FF14;background:#050505;padding:16px'>FATAL: #root not found.</pre>";
    return;
  }
  ReactDOM.render(<App />, rootEl);
})();
