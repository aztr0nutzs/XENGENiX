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
  slotCredits: "xg_slot_credits_v1",
  slotBetPerLine: "xg_slot_bet_per_line_v1",
  slotMeters: "xg_slot_jackpot_meters_v1",
  slotLastOutcome: "xg_slot_last_outcome_v1",
  slotLastSeen: "xg_slot_last_seen_v1",
  slotLiteMode: "xg_slot_lite_mode_v1",
  slotLog: "xg_slot_log_v1",
  slotSeed: "xg_slot_seed_v1",
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
 *  SLOT MACHINE ENGINE
 *  --------------------------- */
function makeSeededRng(seed) {
  let t = seed >>> 0;
  return {
    nextFloat() {
      t += 0x6D2B79F5;
      let x = Math.imul(t ^ (t >>> 15), 1 | t);
      x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    },
    nextInt(bound) {
      if (bound <= 0) return 0;
      return Math.floor(this.nextFloat() * bound);
    },
  };
}

function makeRng() {
  return {
    nextFloat() { return Math.random(); },
    nextInt(bound) { return Math.floor(Math.random() * bound); },
  };
}

const SLOT_SYMBOLS = {
  A: { label: "A", kind: "LOW", color: "#7df7ff" },
  K: { label: "K", kind: "LOW", color: "#9dffb8" },
  Q: { label: "Q", kind: "LOW", color: "#b6c7ff" },
  J: { label: "J", kind: "LOW", color: "#ffd28f" },
  10: { label: "10", kind: "LOW", color: "#f4ff9d" },
  9: { label: "9", kind: "LOW", color: "#c5f1ff" },
  CRYO: { label: "CRYO", kind: "HIGH", color: "#57e3ff" },
  HELIX: { label: "HELIX", kind: "HIGH", color: "#39ff14" },
  VIRUS: { label: "VIRUS", kind: "HIGH", color: "#ff6f6f" },
  CORE: { label: "CORE", kind: "HIGH", color: "#ffbd4a" },
  WILD: { label: "WILD", kind: "WILD", color: "#ffffff" },
  SCATTER: { label: "SCAT", kind: "SCATTER", color: "#ff4dff" },
  ORB: { label: "ORB", kind: "ORB", color: "#00ffff" },
};

const SLOT_PAYLINES = [
  [1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0],
  [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2],
  [1, 0, 0, 0, 1],
  [1, 2, 2, 2, 1],
  [0, 0, 1, 0, 0],
  [2, 2, 1, 2, 2],
  [0, 1, 1, 1, 0],
  [2, 1, 1, 1, 2],
  [1, 0, 1, 2, 1],
  [1, 2, 1, 0, 1],
  [0, 1, 0, 1, 0],
  [2, 1, 2, 1, 2],
  [0, 1, 2, 2, 2],
  [2, 1, 0, 0, 0],
  [0, 0, 0, 1, 2],
  [2, 2, 2, 1, 0],
  [1, 1, 0, 1, 1],
  [1, 1, 2, 1, 1],
  [0, 2, 0, 2, 0],
  [2, 0, 2, 0, 2],
  [0, 2, 2, 2, 0],
  [2, 0, 0, 0, 2],
  [0, 1, 1, 2, 2],
  [2, 1, 1, 0, 0],
  [1, 2, 2, 1, 0],
  [1, 0, 0, 1, 2],
  [0, 2, 1, 2, 0],
  [2, 0, 1, 0, 2],
  [1, 0, 1, 1, 2],
  [1, 2, 1, 1, 0],
  [0, 1, 2, 1, 2],
  [2, 1, 0, 1, 0],
  [0, 0, 1, 1, 2],
  [2, 2, 1, 1, 0],
  [1, 0, 2, 0, 1],
  [1, 2, 0, 2, 1],
  [0, 2, 1, 0, 0],
  [2, 0, 1, 2, 2],
  [0, 1, 0, 2, 2],
  [2, 1, 2, 0, 0],
  [1, 2, 0, 1, 2],
  [1, 0, 2, 1, 0],
  [0, 2, 0, 1, 2],
  [2, 0, 2, 1, 0],
  [0, 1, 2, 0, 1],
  [2, 1, 0, 2, 1],
  [1, 0, 2, 2, 1],
];

const SLOT_CONFIG = {
  reels: [
    ["A","K","Q","J","10","9","A","K","Q","J","10","9","A","K","Q","J","10","9","CRYO","HELIX","VIRUS","CORE","A","K","Q","J","10","9","A","K","Q","J","10","9","WILD","SCATTER","A","K","Q","J"],
    ["A","K","Q","J","10","9","A","K","Q","J","10","9","A","K","Q","J","10","9","CRYO","HELIX","VIRUS","CORE","A","K","Q","J","10","9","A","K","Q","J","10","9","WILD","SCATTER","A","K","Q","J"],
    ["A","K","Q","J","10","9","A","K","Q","J","10","9","A","K","Q","J","10","9","CRYO","HELIX","VIRUS","CORE","A","K","Q","J","10","9","A","K","Q","J","10","9","WILD","SCATTER","A","K","Q","J"],
    ["A","K","Q","J","10","9","A","K","Q","J","10","9","A","K","Q","J","10","9","CRYO","HELIX","VIRUS","CORE","A","K","Q","J","10","9","A","K","Q","J","10","9","WILD","SCATTER","A","K","Q","J"],
    ["A","K","Q","J","10","9","A","K","Q","J","10","9","A","K","Q","J","10","9","CRYO","HELIX","VIRUS","CORE","A","K","Q","J","10","9","A","K","Q","J","10","9","WILD","SCATTER","A","K","Q","J"],
  ],
  paylines: SLOT_PAYLINES,
  paytable: {
    A: { 3: 4, 4: 8, 5: 16 },
    K: { 3: 4, 4: 9, 5: 18 },
    Q: { 3: 4, 4: 10, 5: 20 },
    J: { 3: 4, 4: 10, 5: 22 },
    10: { 3: 3, 4: 8, 5: 18 },
    9: { 3: 3, 4: 7, 5: 16 },
    CRYO: { 3: 6, 4: 18, 5: 45 },
    HELIX: { 3: 8, 4: 24, 5: 60 },
    VIRUS: { 3: 10, 4: 30, 5: 80 },
    CORE: { 3: 12, 4: 40, 5: 110 },
    WILD: { 3: 15, 4: 60, 5: 200 },
  },
  scatterPay: { 3: 4, 4: 20, 5: 100 },
  orbTriggerCount: 6,
  bonusRespins: 3,
  jackpotSeed: { mini: 40, minor: 120, major: 450, grand: 2400 },
  jackpotRates: { mini: 0.02, minor: 0.012, major: 0.006, grand: 0.002 },
  orbValues: [
    { value: 6, weight: 18 },
    { value: 8, weight: 16 },
    { value: 10, weight: 14 },
    { value: 12, weight: 12 },
    { value: 15, weight: 10 },
    { value: 20, weight: 8 },
    { value: 25, weight: 6 },
    { value: 40, weight: 4 },
    { value: 60, weight: 2 },
    { value: 90, weight: 1 },
  ],
  contributionRates: { mini: 0.02, minor: 0.01, major: 0.005, grand: 0.001 },
};

function makeDefaultMeters() {
  return {
    mini: SLOT_CONFIG.jackpotSeed.mini,
    minor: SLOT_CONFIG.jackpotSeed.minor,
    major: SLOT_CONFIG.jackpotSeed.major,
    grand: SLOT_CONFIG.jackpotSeed.grand,
  };
}

function weightedPick(rng, items) {
  const total = items.reduce((acc, it) => acc + it.weight, 0);
  let rollVal = rng.nextFloat() * total;
  for (const item of items) {
    rollVal -= item.weight;
    if (rollVal <= 0) return item;
  }
  return items[items.length - 1];
}

function buildGridFromStops(stops, reels) {
  const rows = 3;
  const grid = Array.from({ length: rows }, () => Array.from({ length: reels.length }, () => "A"));
  reels.forEach((strip, reelIndex) => {
    const stop = stops[reelIndex];
    const len = strip.length;
    const mid = ((stop % len) + len) % len;
    const top = (mid - 1 + len) % len;
    const bot = (mid + 1) % len;
    grid[0][reelIndex] = strip[top];
    grid[1][reelIndex] = strip[mid];
    grid[2][reelIndex] = strip[bot];
  });
  return grid;
}

function evaluateLine(symbols, paytable) {
  let match = null;
  let count = 0;
  for (const sym of symbols) {
    if (sym === "SCATTER" || sym === "ORB") break;
    if (sym === "WILD") {
      count += 1;
      continue;
    }
    if (!match) {
      match = sym;
      count += 1;
      continue;
    }
    if (sym === match || sym === "WILD") {
      count += 1;
      continue;
    }
    break;
  }
  const finalSymbol = match || (count > 0 ? "WILD" : null);
  if (!finalSymbol || count < 3) return null;
  const payout = paytable[finalSymbol]?.[count] || 0;
  if (!payout) return null;
  return { symbol: finalSymbol, count, payout };
}

function evaluatePaylines(grid, paylines, paytable, betPerLine) {
  const wins = [];
  paylines.forEach((line, lineIndex) => {
    const symbols = line.map((row, reel) => grid[row][reel]);
    const result = evaluateLine(symbols, paytable);
    if (result) {
      wins.push({
        lineIndex,
        symbol: result.symbol,
        count: result.count,
        payout: Math.round(result.payout * betPerLine),
      });
    }
  });
  return wins;
}

function countSymbol(grid, symbol) {
  let count = 0;
  grid.forEach((row) => row.forEach((cell) => { if (cell === symbol) count += 1; }));
  return count;
}

function injectOrbs(grid, rng, betPerLine) {
  const tier = clamp(betPerLine, 1, 10);
  const baseProb = 0.045 + tier * 0.005;
  const maxOrbs = 6 + tier;
  let orbCount = 0;
  const nextGrid = grid.map((row) => row.slice());
  for (let r = 0; r < nextGrid.length; r += 1) {
    for (let c = 0; c < nextGrid[r].length; c += 1) {
      const sym = nextGrid[r][c];
      if (sym === "WILD" || sym === "SCATTER") continue;
      if (orbCount >= maxOrbs) continue;
      if (rng.nextFloat() < baseProb) {
        nextGrid[r][c] = "ORB";
        orbCount += 1;
      }
    }
  }
  return { grid: nextGrid, orbCount };
}

function calcScatterWin(grid, scatterPay, totalBet) {
  const count = countSymbol(grid, "SCATTER");
  if (count < 3) return { count, win: 0 };
  const payout = scatterPay[count] || 0;
  return { count, win: Math.round(payout * totalBet) };
}

function spinBaseGame({ rng, betPerLine, meters }) {
  const reels = SLOT_CONFIG.reels;
  const stops = reels.map((strip) => rng.nextInt(strip.length));
  let grid = buildGridFromStops(stops, reels);
  const orbInjected = injectOrbs(grid, rng, betPerLine);
  grid = orbInjected.grid;
  const lineWins = evaluatePaylines(grid, SLOT_CONFIG.paylines, SLOT_CONFIG.paytable, betPerLine);
  const totalBet = betPerLine * SLOT_CONFIG.paylines.length;
  const scatter = calcScatterWin(grid, SLOT_CONFIG.scatterPay, totalBet);
  const lineTotal = lineWins.reduce((sum, w) => sum + w.payout, 0);
  const totalWin = lineTotal + scatter.win;
  return {
    reelStops: stops,
    grid,
    lineWins,
    scatterWin: scatter.win,
    scatterCount: scatter.count,
    totalWin,
    orbCount: orbInjected.orbCount,
    triggerBonus: orbInjected.orbCount >= SLOT_CONFIG.orbTriggerCount,
  };
}

function rollOrbAward(rng) {
  const jackpotRoll = rng.nextFloat();
  const rates = SLOT_CONFIG.jackpotRates;
  if (jackpotRoll < rates.grand) return { jackpot: "grand" };
  if (jackpotRoll < rates.grand + rates.major) return { jackpot: "major" };
  if (jackpotRoll < rates.grand + rates.major + rates.minor) return { jackpot: "minor" };
  if (jackpotRoll < rates.grand + rates.major + rates.minor + rates.mini) return { jackpot: "mini" };
  const picked = weightedPick(rng, SLOT_CONFIG.orbValues);
  return { value: picked.value };
}

function applyJackpot(meters, tier) {
  const award = meters[tier] || 0;
  const next = { ...meters };
  next[tier] = SLOT_CONFIG.jackpotSeed[tier];
  return { award, meters: next };
}

function runHoldAndSpin({ rng, baseGrid, meters, betPerLine }) {
  const rows = 3;
  const cols = 5;
  let respins = SLOT_CONFIG.bonusRespins;
  let bonusGrid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => null));
  let orbCount = 0;
  let activeMeters = { ...meters };
  let jackpotWins = [];

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (baseGrid[r][c] === "ORB") {
        const award = rollOrbAward(rng);
        bonusGrid[r][c] = award;
        orbCount += 1;
      }
    }
  }

  while (respins > 0) {
    let newOrbs = 0;
    const fillProb = 0.16 + betPerLine * 0.005;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        if (bonusGrid[r][c]) continue;
        if (rng.nextFloat() < fillProb) {
          const award = rollOrbAward(rng);
          bonusGrid[r][c] = award;
          newOrbs += 1;
          orbCount += 1;
        }
      }
    }
    if (newOrbs > 0) {
      respins = SLOT_CONFIG.bonusRespins;
    } else {
      respins -= 1;
    }
    if (orbCount >= rows * cols) break;
  }

  let total = 0;
  bonusGrid.forEach((row) => {
    row.forEach((cell) => {
      if (!cell) return;
      if (cell.jackpot) {
        const result = applyJackpot(activeMeters, cell.jackpot);
        activeMeters = result.meters;
        jackpotWins = jackpotWins.concat([{ tier: cell.jackpot, amount: result.award }]);
        total += result.award;
      } else {
        total += cell.value || 0;
      }
    });
  });

  return {
    totalWin: total,
    grid: bonusGrid,
    jackpotWins,
    meters: activeMeters,
  };
}

function contributeMeters(meters, totalBet) {
  const next = { ...meters };
  next.mini += totalBet * SLOT_CONFIG.contributionRates.mini;
  next.minor += totalBet * SLOT_CONFIG.contributionRates.minor;
  next.major += totalBet * SLOT_CONFIG.contributionRates.major;
  next.grand += totalBet * SLOT_CONFIG.contributionRates.grand;
  return next;
}

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

function Switch({ label, value, actionId, onToggle }) {
  return (
    <div className="panel p-[1.4vmin] flex items-center justify-between">
      <div className="text-[1.35vmin] opacity-90">{label}</div>
      <div className="switch">
        <div
          className={`switch-btn ${value ? "on" : ""}`}
          role="switch"
          aria-checked={value}
          tabIndex={0}
          data-action={actionId}
          onClick={onToggle}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onToggle(); }}
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
  const slotSpinRef = useRef({ timeouts: [] });

  // Screens: lobby | game | knct4 | slot | store | settings
  const [screen, setScreen] = useState("lobby");
  const screenRef = useRef("lobby");
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
  const [slotCredits, setSlotCredits] = useState(
    () => safeParseInt(localStorage.getItem(LS_KEYS.slotCredits), 1000)
  );
  const [slotBetPerLine, setSlotBetPerLine] = useState(
    () => clamp(safeParseInt(localStorage.getItem(LS_KEYS.slotBetPerLine), 1), 1, 10)
  );
  const [slotMeters, setSlotMeters] = useState(
    () => loadJSON(LS_KEYS.slotMeters, makeDefaultMeters())
  );
  const [slotLiteMode, setSlotLiteMode] = useState(
    () => loadJSON(LS_KEYS.slotLiteMode, false)
  );
  const [slotLog, setSlotLog] = useState(
    () => loadJSON(LS_KEYS.slotLog, [])
  );
  const [slotLastOutcome, setSlotLastOutcome] = useState(
    () => loadJSON(LS_KEYS.slotLastOutcome, null)
  );
  const [slotLastSeen, setSlotLastSeen] = useState(
    () => localStorage.getItem(LS_KEYS.slotLastSeen) !== "false"
  );
  const [slotSeed, setSlotSeed] = useState(
    () => safeParseInt(localStorage.getItem(LS_KEYS.slotSeed), 1337)
  );
  const [slotGrid, setSlotGrid] = useState(
    () => slotLastOutcome?.grid || buildGridFromStops([0, 1, 2, 3, 4], SLOT_CONFIG.reels)
  );
  const [slotPrevGrid, setSlotPrevGrid] = useState(
    () => slotLastOutcome?.grid || buildGridFromStops([0, 1, 2, 3, 4], SLOT_CONFIG.reels)
  );
  const [slotLineWins, setSlotLineWins] = useState(() => slotLastOutcome?.lineWins || []);
  const [slotTotalWin, setSlotTotalWin] = useState(() => slotLastOutcome?.totalWin || 0);
  const [slotScatterWin, setSlotScatterWin] = useState(() => slotLastOutcome?.scatterWin || 0);
  const [slotIsSpinning, setSlotIsSpinning] = useState(false);
  const [slotRevealReels, setSlotRevealReels] = useState(5);
  const [slotWinLevel, setSlotWinLevel] = useState("none");
  const [slotBonusState, setSlotBonusState] = useState(null);
  const [slotRulesOpen, setSlotRulesOpen] = useState(false);
  const [slotSimStats, setSlotSimStats] = useState(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugReport, setDebugReport] = useState({ missingAction: [], missingHandler: [] });
  const [selfTestResults, setSelfTestResults] = useState([]);
  const [smokeResults, setSmokeResults] = useState([]);
  const [userInteracted, setUserInteracted] = useState(false);
  const snapshotRef = useRef({});

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

  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  useEffect(() => {
    snapshotRef.current = {
      screen,
      slotCredits,
      slotBetPerLine,
      slotIsSpinning,
      slotLastOutcome,
      slotLastSeen,
      slotLog,
      debugOpen,
      debugReport,
      selfTestResults,
      smokeResults,
      settings,
    };
  }, [
    screen,
    slotCredits,
    slotBetPerLine,
    slotIsSpinning,
    slotLastOutcome,
    slotLastSeen,
    slotLog,
    debugOpen,
    debugReport,
    selfTestResults,
    smokeResults,
    settings,
  ]);

  useEffect(() => {
    try { localStorage.setItem(LS_KEYS.slotCredits, String(slotCredits)); } catch (_) {}
  }, [slotCredits]);
  useEffect(() => {
    try { localStorage.setItem(LS_KEYS.slotBetPerLine, String(slotBetPerLine)); } catch (_) {}
  }, [slotBetPerLine]);
  useEffect(() => {
    saveJSON(LS_KEYS.slotMeters, slotMeters);
  }, [slotMeters]);
  useEffect(() => {
    saveJSON(LS_KEYS.slotLiteMode, slotLiteMode);
  }, [slotLiteMode]);
  useEffect(() => {
    saveJSON(LS_KEYS.slotLog, slotLog);
  }, [slotLog]);
  useEffect(() => {
    saveJSON(LS_KEYS.slotLastOutcome, slotLastOutcome);
  }, [slotLastOutcome]);
  useEffect(() => {
    try { localStorage.setItem(LS_KEYS.slotLastSeen, String(slotLastSeen)); } catch (_) {}
  }, [slotLastSeen]);
  useEffect(() => {
    try { localStorage.setItem(LS_KEYS.slotSeed, String(slotSeed)); } catch (_) {}
  }, [slotSeed]);

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
  const SlotIcon = iconSet.Dice5 || iconSet.Dices || iconSet.Coins;

  function navButton(id, label) {
    const active = screen === id;
    const actionId = `nav-${id}`;
    return (
      <button
        className="xg-btn"
        style={active ? { background: "rgba(0,255,255,0.18)", borderColor: "rgba(0,255,255,0.35)" } : null}
        data-action={actionId}
        onClick={() => runAction(actionId)}
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
   *  SLOT HELPERS
   *  --------------------------- */
  const slotTotalBet = slotBetPerLine * SLOT_CONFIG.paylines.length;

  function pushSlotLog(entry) {
    setSlotLog((prev) => {
      const next = [entry, ...prev];
      return next.slice(0, 20);
    });
  }

  function updateSlotCredits(next) {
    setSlotCredits(Math.max(0, Math.round(next)));
  }

  function adjustSlotCredits(delta) {
    setSlotCredits((prev) => Math.max(0, Math.round(prev + delta)));
  }

  function applySpinCredits(credits, totalBet, totalWin) {
    return Math.max(0, Math.round(credits - totalBet + totalWin));
  }

  function canAffordSpin(credits, totalBet) {
    return credits >= totalBet;
  }

  function updateSlotBet(next) {
    setSlotBetPerLine(clamp(next, 1, 10));
  }

  function reloadSlotState() {
    const credits = safeParseInt(localStorage.getItem(LS_KEYS.slotCredits), 1000);
    const bet = clamp(safeParseInt(localStorage.getItem(LS_KEYS.slotBetPerLine), 1), 1, 10);
    const meters = loadJSON(LS_KEYS.slotMeters, makeDefaultMeters());
    const lastOutcome = loadJSON(LS_KEYS.slotLastOutcome, null);
    const lastSeen = localStorage.getItem(LS_KEYS.slotLastSeen) !== "false";
    setSlotCredits(credits);
    setSlotBetPerLine(bet);
    setSlotMeters(meters);
    setSlotLastOutcome(lastOutcome);
    setSlotLastSeen(lastSeen);
    if (lastOutcome?.grid) {
      setSlotGrid(lastOutcome.grid);
      setSlotPrevGrid(lastOutcome.grid);
      setSlotLineWins(lastOutcome.lineWins || []);
      setSlotTotalWin(lastOutcome.totalWin || 0);
      setSlotScatterWin(lastOutcome.scatterWin || 0);
    }
  }

  function classifyWin(totalWin, totalBet) {
    if (totalWin >= totalBet * 20) return "mega";
    if (totalWin >= totalBet * 10) return "big";
    if (totalWin > 0) return "small";
    return "none";
  }

  function clearSlotTimeouts() {
    slotSpinRef.current.timeouts.forEach((t) => clearTimeout(t));
    slotSpinRef.current.timeouts = [];
  }

  function markSlotSeen() {
    setSlotLastSeen(true);
  }

  function performSlotSpin(rng, meters) {
    const baseOutcome = spinBaseGame({
      rng,
      betPerLine: slotBetPerLine,
      meters,
    });
    let totalWin = baseOutcome.totalWin;
    let bonus = null;
    let metersNext = meters;

    if (baseOutcome.triggerBonus) {
      const bonusResult = runHoldAndSpin({
        rng,
        baseGrid: baseOutcome.grid,
        meters,
        betPerLine: slotBetPerLine,
      });
      bonus = bonusResult;
      totalWin += bonusResult.totalWin;
      metersNext = bonusResult.meters;
    }

    return {
      ...baseOutcome,
      totalWin,
      bonus,
      metersNext,
      totalBet: slotTotalBet,
      betPerLine: slotBetPerLine,
    };
  }

  function startSlotSpin() {
    if (slotIsSpinning || slotBonusState) return;
    if (!canAffordSpin(slotCredits, slotTotalBet)) {
      pushSlotLog({ t: "ERR", m: "Insufficient credits for spin." });
      playTone(220, 120, settings.sound && userInteracted);
      vibrate([0, 40], settings.haptics);
      return;
    }

    setSlotIsSpinning(true);
    setSlotRevealReels(0);
    setSlotWinLevel("none");
    setSlotScatterWin(0);
    setSlotLineWins([]);
    setSlotTotalWin(0);
    setSlotBonusState(null);
    setSlotPrevGrid(slotGrid);

    const metersAfter = contributeMeters(slotMeters, slotTotalBet);
    setSlotMeters(metersAfter);

    adjustSlotCredits(-slotTotalBet);
    const rng = makeRng();
    const outcome = performSlotSpin(rng, metersAfter);
    const finalMeters = outcome.metersNext;

    setSlotMeters(finalMeters);
    setSlotLastOutcome(outcome);
    setSlotLastSeen(false);
    pushSlotLog({
      t: outcome.totalWin > 0 ? "WIN" : "MISS",
      m: `Bet ${slotTotalBet} | Win ${outcome.totalWin}${outcome.triggerBonus ? " + BONUS" : ""}`,
    });

    setSlotGrid(outcome.grid);
    setSlotLineWins(outcome.lineWins);
    setSlotScatterWin(outcome.scatterWin);
    setSlotTotalWin(outcome.totalWin);
    setSlotBonusState(outcome.bonus);
    setSlotWinLevel(classifyWin(outcome.totalWin, slotTotalBet));

    clearSlotTimeouts();
    const revealDelays = [260, 420, 560, 720, 880];
    revealDelays.forEach((delay, idx) => {
      const t = setTimeout(() => setSlotRevealReels(idx + 1), delay);
      slotSpinRef.current.timeouts.push(t);
    });
    const endTimer = setTimeout(() => {
      setSlotIsSpinning(false);
      setSlotLastSeen(true);
      adjustSlotCredits(outcome.totalWin);
      playTone(outcome.totalWin > 0 ? 520 : 260, 120, settings.sound && userInteracted);
      if (outcome.totalWin > 0) vibrate([0, 40, 30, 40], settings.haptics);
    }, 1050);
    slotSpinRef.current.timeouts.push(endTimer);
  }

  function setSlotCreditsTo(value) {
    updateSlotCredits(value);
    pushSlotLog({ t: "SYS", m: `Credits set to ${value}.` });
  }

  function resetSlotMeters() {
    setSlotMeters(makeDefaultMeters());
    pushSlotLog({ t: "SYS", m: "Jackpot meters reset." });
  }

  function runSlotSimulation(spins) {
    const rng = makeSeededRng(slotSeed);
    let wagered = 0;
    let returned = 0;
    let bonusHits = 0;
    let lineHits = 0;
    let scatterHits = 0;
    for (let i = 0; i < spins; i += 1) {
      const outcome = spinBaseGame({ rng, betPerLine: slotBetPerLine, meters: slotMeters });
      wagered += slotTotalBet;
      returned += outcome.totalWin;
      if (outcome.lineWins.length) lineHits += 1;
      if (outcome.scatterWin > 0) scatterHits += 1;
      if (outcome.triggerBonus) bonusHits += 1;
    }
    const stats = {
      spins,
      wagered,
      returned,
      rtp: wagered > 0 ? (returned / wagered) : 0,
      lineHits,
      scatterHits,
      bonusHits,
      seed: slotSeed,
    };
    setSlotSimStats(stats);
  }

  function describeElement(el) {
    const tag = el.tagName.toLowerCase();
    const action = el.getAttribute("data-action") || "none";
    const id = el.id ? `#${el.id}` : "";
    const cls = el.className ? `.${String(el.className).split(" ").filter(Boolean).join(".")}` : "";
    return `${tag}${id}${cls} [${action}]`;
  }

  function clearActionHighlights() {
    document.querySelectorAll(".missing-action").forEach((el) => el.classList.remove("missing-action"));
    document.querySelectorAll(".missing-handler").forEach((el) => el.classList.remove("missing-handler"));
  }

  function scanActionAudit(actionHandlers) {
    clearActionHighlights();
    const missingAction = [];
    const missingHandler = [];
    const handlerSet = new Set(Object.keys(actionHandlers));
    const elements = Array.from(document.querySelectorAll("button, [role='button'], [role='switch'], input, select, textarea"));
    elements.forEach((el) => {
      const action = el.getAttribute("data-action");
      if (!action) {
        missingAction.push(describeElement(el));
        el.classList.add("missing-action");
        return;
      }
      if (!handlerSet.has(action)) {
        missingHandler.push(action);
        el.classList.add("missing-handler");
      }
    });
    setDebugReport({
      missingAction,
      missingHandler: Array.from(new Set(missingHandler)),
    });
  }

  async function runSelfTests(actionHandlers) {
    const results = [];
    const add = (name, pass, detail) => results.push({ name, pass, detail });
    const countBonusOrbs = (grid) => grid.reduce((sum, row) => sum + row.filter(Boolean).length, 0);

    const rngA = makeSeededRng(12345);
    const rngB = makeSeededRng(12345);
    const outA = spinBaseGame({ rng: rngA, betPerLine: 2, meters: makeDefaultMeters() });
    const outB = spinBaseGame({ rng: rngB, betPerLine: 2, meters: makeDefaultMeters() });
    add("RNG determinism", JSON.stringify(outA.reelStops) === JSON.stringify(outB.reelStops), "Stops match on same seed.");

    const testGrid = [
      ["A","A","A","A","A"],
      ["A","A","A","A","A"],
      ["A","A","A","A","A"],
    ];
    const lineWins = evaluatePaylines(testGrid, SLOT_CONFIG.paylines, SLOT_CONFIG.paytable, 2);
    add("Payline evaluation", lineWins.length > 0, `Lines paid: ${lineWins.length}.`);
    const topLineWin = lineWins.find((w) => w.lineIndex === 0);
    add(
      "Payout correctness",
      !!topLineWin && topLineWin.payout === SLOT_CONFIG.paytable.A[5] * 2,
      `Line 0 payout ${topLineWin ? topLineWin.payout : 0}.`
    );

    const scatterGrid = [
      ["SCATTER","A","A","A","A"],
      ["A","SCATTER","A","A","A"],
      ["A","A","SCATTER","A","A"],
    ];
    const scatter = calcScatterWin(scatterGrid, SLOT_CONFIG.scatterPay, 100);
    add("Scatter payout", scatter.win > 0, `Scatter win ${scatter.win}.`);

    const wildGrid = [
      ["WILD","WILD","WILD","A","A"],
      ["A","A","A","A","A"],
      ["A","A","A","A","A"],
    ];
    const wildWins = evaluatePaylines(wildGrid, SLOT_CONFIG.paylines, SLOT_CONFIG.paytable, 1);
    add("Wild substitution", wildWins.length > 0, "Wilds form a win.");

    const orbGrid = [
      ["WILD","SCATTER","A","A","A"],
      ["A","A","A","A","A"],
      ["A","A","A","A","A"],
    ];
    const injected = injectOrbs(orbGrid, makeSeededRng(7), 1);
    add("Orb injection safety", injected.grid[0][0] === "WILD" && injected.grid[0][1] === "SCATTER", "Wild/Scatter preserved.");

    const meters = makeDefaultMeters();
    const jackpot = applyJackpot(meters, "mini");
    add("Jackpot award", jackpot.award === meters.mini && jackpot.meters.mini === SLOT_CONFIG.jackpotSeed.mini, "Jackpot resets after award.");

    const bonus = runHoldAndSpin({
      rng: makeSeededRng(11),
      baseGrid: [
        ["ORB","ORB","ORB","A","A"],
        ["A","A","A","A","A"],
        ["A","A","A","A","A"],
      ],
      meters: makeDefaultMeters(),
      betPerLine: 2,
    });
    add("Bonus resolves", bonus.totalWin >= 0, `Bonus total ${bonus.totalWin}.`);

    const rngAlways = { nextFloat: () => 0, nextInt: () => 0 };
    const bonusFill = runHoldAndSpin({
      rng: rngAlways,
      baseGrid: [
        ["A","A","A","A","A"],
        ["A","A","A","A","A"],
        ["A","A","A","A","A"],
      ],
      meters: makeDefaultMeters(),
      betPerLine: 10,
    });
    add("Bonus respin reset", countBonusOrbs(bonusFill.grid) === 15, "Respin fills all cells with guaranteed hits.");

    add("Bet math", slotTotalBet === slotBetPerLine * SLOT_CONFIG.paylines.length, `Total bet ${slotTotalBet}.`);

    const creditCalc = applySpinCredits(500, 50, 120);
    add("Bet deduction + payout", creditCalc === 570, `Credits after spin ${creditCalc}.`);
    add("Win classification", classifyWin(500, 20) === "mega" && classifyWin(120, 20) === "big", "Win tiers resolve.");

    add("Credits gate", !canAffordSpin(10, 50) && canAffordSpin(100, 50), "Spin blocks when credits low.");

    if (actionHandlers["nav-slot"] && actionHandlers["nav-lobby"]) {
      actionHandlers["nav-slot"]();
      await new Promise((r) => setTimeout(r, 0));
      const afterSlot = screenRef.current === "slot";
      actionHandlers["nav-lobby"]();
      await new Promise((r) => setTimeout(r, 0));
      add("Navigation: lobby → slot → lobby", afterSlot && screenRef.current === "lobby", `Screen now ${screenRef.current}.`);
    } else {
      add("Navigation: lobby → slot → lobby", false, "Missing nav handlers.");
    }

    setSelfTestResults(results);
  }

  function openScreen(id, label) {
    setScreen(id);
    pushLog("SYS", `Opened ${label}.`);
    glitchPulse(0.18);
  }

  const actionHandlers = {
    "nav-lobby": () => openScreen("lobby", "Lobby"),
    "nav-knct4": () => openScreen("knct4", "Connect-4"),
    "nav-slot": () => openScreen("slot", "Slot Machine"),
    "nav-store": () => openScreen("store", "Store"),
    "nav-settings": () => openScreen("settings", "Settings"),
    "nav-game": () => openScreen("game", "Run"),
    "lobby-start-sequencer": () => startNewRun(),
    "lobby-open-slot": () => openScreen("slot", "Slot Machine"),
    "lobby-open-knct4": () => openScreen("knct4", "Connect-4"),
    "lobby-open-store": () => openScreen("store", "Store"),
    "lobby-open-settings": () => openScreen("settings", "Settings"),
    "lobby-start-run": () => startNewRun(),
    "mp-create-knct4": () => createRoom("knct4"),
    "mp-join-knct4": () => openJoinModal("knct4"),
    "mp-create-race": () => createRoom("race"),
    "mp-join-race": () => openJoinModal("race"),
    "mp-copy-code": () => copyRoomCode(mpStatus.roomCode),
    "mp-leave-room": () => leaveRoom("manual"),
    "settings-toggle-haptics": () => persistSettings({ haptics: !settings.haptics }),
    "settings-toggle-sound": () => persistSettings({ sound: !settings.sound }),
    "settings-toggle-reduced-motion": () => persistSettings({ reducedMotion: !settings.reducedMotion }),
    "settings-slot-lite": () => setSlotLiteMode((v) => !v),
    "settings-difficulty": (payload) => {
      const preset = difficultyPreset(payload.value);
      persistSettings({ difficulty: payload.value, maxCycles: preset.maxCycles });
    },
    "settings-max-cycles": (payload) => persistSettings({ maxCycles: payload.value }),
    "settings-ui-intensity": (payload) => persistSettings({ uiIntensity: payload.value }),
    "settings-reset-progress": () => resetProgress(),
    "settings-reset-defaults": () => persistSettings(DEFAULT_SETTINGS),
    "settings-back-lobby": () => openScreen("lobby", "Lobby"),
    "store-buy": (payload) => {
      const item = storeItems.find((it) => it.id === payload.id);
      if (item) buyItem(item);
    },
    "store-back-lobby": () => openScreen("lobby", "Lobby"),
    "game-anomaly-stability": () => chooseAnomaly("STABILITY"),
    "game-anomaly-stealth": () => chooseAnomaly("STEALTH"),
    "game-anomaly-purge": () => chooseAnomaly("PURGE"),
    "game-anomaly-embrace": () => chooseAnomaly("EMBRACE"),
    "game-copy-code": () => copyRoomCode(mpStatus.roomCode),
    "game-leave-room": () => leaveRoom("manual"),
    "game-bias-minus": () => useBias(-1),
    "game-bias-plus": () => useBias(1),
    "game-patch": () => usePatch(),
    "game-spin": () => spinSequencer(),
    "game-abort": () => abortToLobby(),
    "game-abort-return": () => abortToLobby(),
    "game-action-extract": () => actionExtract(),
    "game-action-reroute": () => actionReroute(),
    "game-action-vent": () => actionVent(),
    "game-action-ghost": () => actionGhost(),
    "game-action-buffer": () => actionBuffer(),
    "knct-drop": (payload) => handleKnctDrop(payload.col),
    "knct-reset-match": () => resetKnctMatch(),
    "knct-next-match": () => startNextKnctMatch(),
    "knct-back-lobby": () => openScreen("lobby", "Lobby"),
    "knct-open-settings": () => openScreen("settings", "Settings"),
    "knct-copy-code": () => copyRoomCode(mpStatus.roomCode),
    "knct-leave-room": () => leaveRoom("manual"),
    "knct-leave-room-footer": () => leaveRoom("manual"),
    "knct-reset-scores": () => resetKnctScores(),
    "knct-chipset": (payload) => updateKnctChipSet(payload.id),
    "knct-hover-set": (payload) => setKnctHoverCol(payload.col),
    "knct-hover-clear": () => setKnctHoverCol(null),
    "modal-room-full-ok": () => setMpStatus((s) => ({ ...s, error: null })),
    "modal-join-cancel": () => setMpJoinModal({ open: false, mode: null, code: "" }),
    "modal-join-submit": () => submitJoin(),
    "modal-join-input": (payload) => setMpJoinModal((s) => ({ ...s, code: normalizeRoomCode(payload.value) })),
    "slot-spin": () => startSlotSpin(),
    "slot-bet-up": () => updateSlotBet(slotBetPerLine + 1),
    "slot-bet-down": () => updateSlotBet(slotBetPerLine - 1),
    "slot-bet-max": () => updateSlotBet(10),
    "slot-back-lobby": () => openScreen("lobby", "Lobby"),
    "slot-toggle-rules": () => setSlotRulesOpen((v) => !v),
    "slot-toggle-lite": () => setSlotLiteMode((v) => !v),
    "slot-ack-last": () => markSlotSeen(),
    "debug-toggle": () => setDebugOpen((v) => !v),
    "debug-scan": () => scanActionAudit(actionHandlers),
    "debug-run-tests": () => runSelfTests(actionHandlers),
    "debug-run-sim": () => runSlotSimulation(10000),
    "debug-set-seed": (payload) => setSlotSeed(safeParseInt(payload.value, slotSeed)),
    "debug-set-credits": (payload) => setSlotCreditsTo(safeParseInt(payload.value, slotCredits)),
    "debug-reset-meters": () => resetSlotMeters(),
    "debug-run-smoke": () => {
      if (window.__XG_SMOKE__?.runSmokeTests) {
        window.__XG_SMOKE__.runSmokeTests(window.__XG__);
      } else {
        setSmokeResults([{ name: "Smoke runner missing", pass: false, detail: "smoke.test.js not loaded." }]);
      }
    },
    "slot-reload-state": () => reloadSlotState(),
  };

  function runAction(actionId, payload) {
    setUserInteracted(true);
    const handler = actionHandlers[actionId];
    if (handler) {
      handler(payload || {});
    } else {
      pushLog("ERR", `No handler for ${actionId}.`);
    }
  }

  useEffect(() => {
    if (!debugOpen) {
      clearActionHighlights();
      return;
    }
    const t = setTimeout(() => scanActionAudit(actionHandlers), 60);
    return () => clearTimeout(t);
  }, [debugOpen, screen, slotRulesOpen, mpJoinModal.open]);

  useEffect(() => {
    return () => clearSlotTimeouts();
  }, []);

  useEffect(() => {
    window.__XG__ = {
      runAction,
      getSnapshot: () => snapshotRef.current,
      setSmokeResults,
      setDebugOpen,
    };
    return () => {
      if (window.__XG__) delete window.__XG__;
    };
  }, [runAction]);

  /** ---------------------------
   *  RENDER SCREENS
   *  --------------------------- */
  function LobbyScreen() {
    return (
      <div className="grid grid-cols-1 md:grid-cols-[1.15fr_0.85fr] gap-[1.6vmin] min-h-0 lobby-screen">
        <div className="panel p-[2vmin] min-h-0 flex flex-col lobby-hero">
          <div className="flex items-center justify-between gap-[1.2vmin] flex-wrap">
            <div className="os-title text-[1.8vmin]" style={{ color: PALETTE.blue }}>MAIN LOBBY</div>
            <div className="flex items-center gap-[0.8vmin] flex-wrap">
              <div className="status-chip">
                Credits <span style={{ color: PALETTE.green }}>{geneCredits}</span>
              </div>
              <div className="status-chip">
                Sound <span style={{ color: settings.sound ? PALETTE.blue : "rgba(255,140,0,0.88)" }}>{settings.sound ? "ON" : "OFF"}</span>
              </div>
              <div className="status-chip">
                Vibe <span style={{ color: PALETTE.green }}>{settings.reducedMotion ? "LITE" : "FULL"}</span>
              </div>
            </div>
          </div>
          <div className="hud-sweep my-[0.8vmin]" />
          <div className="hr-scan my-[1.2vmin]" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-[1.2vmin]">
            <div className="panel-2 p-[1.8vmin] md:col-span-2 lobby-accent lobby-banner">
              <div className="os-title text-[1.35vmin]" style={{ color: PALETTE.green }}>GAME BAY</div>
              <div className="mt-[1.2vmin] grid grid-cols-1 md:grid-cols-3 gap-[1.2vmin]">
                <div className="game-card">
                  <div className="flex items-center gap-[1.0vmin]">
                    <div className="game-icon">
                      <IconBadge icon={DnaIcon} label="DNA" color={PALETTE.green} className="game-icon-svg" />
                    </div>
                    <div>
                      <div className="os-title text-[1.3vmin]" style={{ color: PALETTE.green }}>SEQUENCER RUN</div>
                      <div className="text-[1.2vmin] opacity-80">Strategic extraction loop</div>
                    </div>
                  </div>
                  <div className="mt-[1.0vmin] text-[1.25vmin] opacity-85">
                    Spin the wheel, manage stability, and extract under pressure.
                  </div>
                  <button
                    className="xg-btn w-full mt-[1.2vmin]"
                    data-action="lobby-start-sequencer"
                    onClick={() => runAction("lobby-start-sequencer")}
                  >
                    Enter Sequencer
                  </button>
                </div>

                <div className="game-card featured-card">
                  <div className="flex items-center gap-[1.0vmin]">
                    <div className="game-icon">
                      <IconBadge icon={SlotIcon} label="SLOT" color={PALETTE.blue} className="game-icon-svg" />
                    </div>
                    <div>
                      <div className="os-title text-[1.3vmin]" style={{ color: PALETTE.blue }}>SLOT MACHINE</div>
                      <div className="text-[1.2vmin] opacity-80">Fast spins, bonus orbs</div>
                    </div>
                  </div>
                  <div className="mt-[1.0vmin] text-[1.25vmin] opacity-85">
                    Spin the reels, trigger hold-and-spin, and chase jackpots.
                  </div>
                  <button
                    className="xg-btn w-full mt-[1.2vmin]"
                    data-action="lobby-open-slot"
                    onClick={() => runAction("lobby-open-slot")}
                  >
                    Play Slot Machine
                  </button>
                </div>

                <div className="game-card">
                  <div className="flex items-center gap-[1.0vmin]">
                    <div className="game-icon">
                      <IconBadge icon={GamepadIcon} label="GRID" color={PALETTE.blue} className="game-icon-svg" />
                    </div>
                    <div>
                      <div className="os-title text-[1.3vmin]" style={{ color: PALETTE.blue }}>CONNECT-4</div>
                      <div className="text-[1.2vmin] opacity-80">Drop chips, block rivals</div>
                    </div>
                  </div>
                  <div className="mt-[1.0vmin] text-[1.25vmin] opacity-85">
                    Place chips to connect four and deny the next move.
                  </div>
                  <button
                    className="xg-btn w-full mt-[1.2vmin]"
                    data-action="lobby-open-knct4"
                    onClick={() => runAction("lobby-open-knct4")}
                  >
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
                    <button
                      className="xg-btn"
                      disabled={!mpStatus.configured || !mpUserId}
                      data-action="mp-create-knct4"
                      onClick={() => runAction("mp-create-knct4")}
                    >
                      Create Room
                    </button>
                    <button
                      className="xg-btn"
                      disabled={!mpStatus.configured || !mpUserId}
                      data-action="mp-join-knct4"
                      onClick={() => runAction("mp-join-knct4")}
                    >
                      Join by Code
                    </button>
                  </div>
                </div>
                <div className="mp-card">
                  <div className="os-title text-[1.2vmin]" style={{ color: PALETTE.green }}>SEQUENCER RACE</div>
                  <div className="mt-[0.6vmin] text-[1.15vmin] opacity-80">First to extract wins. Real-time status.</div>
                  <div className="mp-row mt-[0.8vmin]">
                    <button
                      className="xg-btn"
                      disabled={!mpStatus.configured || !mpUserId}
                      data-action="mp-create-race"
                      onClick={() => runAction("mp-create-race")}
                    >
                      Create Room
                    </button>
                    <button
                      className="xg-btn"
                      disabled={!mpStatus.configured || !mpUserId}
                      data-action="mp-join-race"
                      onClick={() => runAction("mp-join-race")}
                    >
                      Join by Code
                    </button>
                  </div>
                </div>
                {mpStatus.connected && (
                  <div className="panel p-[1.0vmin]">
                    <div className="text-[1.1vmin] opacity-85">
                      Room <span style={{ color: PALETTE.blue }}>{mpStatus.roomCode}</span> | Role <span style={{ color: PALETTE.green }}>{mpStatus.role}</span>
                    </div>
                    <div className="mp-row mt-[0.6vmin]">
                      <button className="xg-btn" data-action="mp-copy-code" onClick={() => runAction("mp-copy-code")}>Copy Code</button>
                      <button className="xg-btn" data-action="mp-leave-room" onClick={() => runAction("mp-leave-room")}>Leave Room</button>
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
                <button className="xg-btn" data-action="lobby-start-run" onClick={() => runAction("lobby-start-run")}>
                  Start Extraction Run
                </button>
                <button className="xg-btn" data-action="lobby-open-store" onClick={() => runAction("lobby-open-store")}>
                  Open Store
                </button>
                <button className="xg-btn" data-action="lobby-open-settings" onClick={() => runAction("lobby-open-settings")}>
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

  function SlotScreen() {
    const effectsLite = slotLiteMode || settings.reducedMotion;
    const winCells = useMemo(() => {
      const cells = new Set();
      slotLineWins.forEach((win) => {
        const line = SLOT_CONFIG.paylines[win.lineIndex];
        for (let i = 0; i < win.count; i += 1) {
          const row = line[i];
          cells.add(`${row}-${i}`);
        }
      });
      return cells;
    }, [slotLineWins]);

    const scatterCount = countSymbol(slotGrid, "SCATTER");
    const particles = useMemo(() => {
      if (slotWinLevel === "none" || effectsLite) return [];
      return Array.from({ length: 18 }, (_, i) => ({
        id: i,
        left: `${(i * 13) % 100}%`,
        delay: `${(i % 6) * 0.08}s`,
      }));
    }, [slotWinLevel, effectsLite]);

    return (
      <div className={`slot-screen ${slotWinLevel !== "none" ? "slot-win" : ""}`}>
        <div className="panel p-[1.6vmin] flex items-center justify-between flex-wrap gap-[1.0vmin]">
          <div>
            <div className="os-title text-[1.8vmin]" style={{ color: PALETTE.blue }}>SLOT MACHINE</div>
            <div className="text-[1.25vmin] opacity-80">
              5x3 reels | 50 lines | Hold-and-Spin bonus
            </div>
          </div>
          <div className="slot-status">
            <div className="status-chip">Credits <span style={{ color: PALETTE.green }}>{slotCredits}</span></div>
            <div className="status-chip">Bet <span style={{ color: PALETTE.blue }}>{slotTotalBet}</span></div>
            <div className="status-chip">Best Run <span style={{ color: PALETTE.blue }}>{bestRun}</span></div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-[1.6vmin] mt-[1.6vmin]">
          <div className="panel-2 p-[1.8vmin] slot-reel-panel">
            <div className={`slot-banner ${slotWinLevel}`}>
              {slotWinLevel === "none" ? "Awaiting spin" : `WIN ${slotTotalWin}`}
            </div>
            <div className="slot-reels">
              {slotGrid.map((row, rIdx) => (
                <div key={`row-${rIdx}`} className="slot-row">
                  {row.map((_, cIdx) => {
                    const symbol = slotIsSpinning && cIdx >= slotRevealReels ? slotPrevGrid[rIdx][cIdx] : slotGrid[rIdx][cIdx];
                    const meta = SLOT_SYMBOLS[symbol] || SLOT_SYMBOLS.A;
                    const isWin = winCells.has(`${rIdx}-${cIdx}`);
                    return (
                      <div
                        key={`cell-${rIdx}-${cIdx}`}
                        className={`slot-cell ${slotIsSpinning && !effectsLite ? "spinning" : ""} ${isWin ? "win" : ""}`}
                      >
                        <div className={`slot-symbol ${meta.kind}`} style={{ color: meta.color }}>{meta.label}</div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="slot-footer">
              <div className="text-[1.2vmin] opacity-80">
                Lines hit: {slotLineWins.length} | Scatter: {scatterCount} | Orbs: {countSymbol(slotGrid, "ORB")}
              </div>
            </div>
            {!effectsLite && particles.length > 0 && (
              <div className="slot-confetti">
                {particles.map((p) => (
                  <div key={p.id} className="confetti" style={{ left: p.left, animationDelay: p.delay }} />
                ))}
              </div>
            )}
          </div>

          <div className="panel-2 p-[1.8vmin] flex flex-col gap-[1.2vmin]">
            <div className="panel p-[1.4vmin]">
              <div className="os-title text-[1.35vmin]" style={{ color: PALETTE.blue }}>SPIN CONTROLS</div>
              <div className="mt-[1.0vmin] grid grid-cols-[auto_1fr_auto] gap-[1.0vmin] items-center">
                <button className="xg-btn" data-action="slot-bet-down" onClick={() => runAction("slot-bet-down")} disabled={slotBetPerLine <= 1 || slotIsSpinning}>-</button>
                <div className="text-center text-[1.35vmin]">
                  Bet/Line <span style={{ color: PALETTE.blue }}>{slotBetPerLine}</span> | Total <span style={{ color: PALETTE.green }}>{slotTotalBet}</span>
                </div>
                <button className="xg-btn" data-action="slot-bet-up" onClick={() => runAction("slot-bet-up")} disabled={slotBetPerLine >= 10 || slotIsSpinning}>+</button>
              </div>
              <div className="mt-[1.0vmin] grid grid-cols-2 gap-[1.0vmin]">
                <button className="xg-btn" data-action="slot-bet-max" onClick={() => runAction("slot-bet-max")} disabled={slotIsSpinning}>Max Bet</button>
                <button className="xg-btn" data-action="slot-spin" onClick={() => runAction("slot-spin")} disabled={slotIsSpinning || slotCredits < slotTotalBet}>
                  {slotIsSpinning ? "Spinning..." : "SPIN"}
                </button>
              </div>
            </div>

            <div className="panel p-[1.4vmin]">
              <div className="os-title text-[1.35vmin]" style={{ color: PALETTE.green }}>JACKPOT METERS</div>
              <div className="mt-[0.8vmin] grid grid-cols-2 gap-[0.8vmin] text-[1.2vmin]">
                <div className="status-chip">Mini <span style={{ color: PALETTE.green }}>{Math.round(slotMeters.mini)}</span></div>
                <div className="status-chip">Minor <span style={{ color: PALETTE.blue }}>{Math.round(slotMeters.minor)}</span></div>
                <div className="status-chip">Major <span style={{ color: "rgba(255,140,0,0.9)" }}>{Math.round(slotMeters.major)}</span></div>
                <div className="status-chip">Grand <span style={{ color: "rgba(255,80,180,0.9)" }}>{Math.round(slotMeters.grand)}</span></div>
              </div>
              <div className="mt-[0.8vmin] text-[1.2vmin] opacity-80">
                Each spin nudges meters. Jackpot orbs can cash them out in bonus.
              </div>
            </div>

            <div className="panel p-[1.4vmin]">
              <div className="os-title text-[1.35vmin]" style={{ color: PALETTE.blue }}>OPTIONS</div>
              <div className="mt-[0.8vmin] grid grid-cols-2 gap-[0.8vmin]">
                <button className="xg-btn" data-action="slot-toggle-rules" onClick={() => runAction("slot-toggle-rules")}>
                  {slotRulesOpen ? "Hide Rules" : "Rules / Payouts"}
                </button>
                <button className="xg-btn" data-action="slot-toggle-lite" onClick={() => runAction("slot-toggle-lite")}>
                  {slotLiteMode ? "Lite Mode: ON" : "Lite Mode: OFF"}
                </button>
              </div>
              <button className="xg-btn w-full mt-[0.8vmin]" data-action="slot-back-lobby" onClick={() => runAction("slot-back-lobby")}>
                Back to Lobby
              </button>
            </div>

            {slotRulesOpen && (
              <div className="panel p-[1.4vmin]">
                <div className="os-title text-[1.35vmin]" style={{ color: PALETTE.green }}>RULES & PAYOUTS</div>
                <div className="mt-[0.8vmin] text-[1.2vmin] opacity-85">
                  50 paylines, left-to-right. Wild substitutes. Scatter pays anywhere (3+). Orbs trigger Hold-and-Spin at {SLOT_CONFIG.orbTriggerCount}+ orbs.
                </div>
                <div className="mt-[0.8vmin] grid grid-cols-2 gap-[0.6vmin] text-[1.1vmin]">
                  {Object.keys(SLOT_CONFIG.paytable).map((sym) => (
                    <div key={sym} className="status-chip">
                      {sym} <span>{SLOT_CONFIG.paytable[sym][3]}/{SLOT_CONFIG.paytable[sym][4]}/{SLOT_CONFIG.paytable[sym][5]}</span>
                    </div>
                  ))}
                  <div className="status-chip">SCAT <span>{SLOT_CONFIG.scatterPay[3]}/{SLOT_CONFIG.scatterPay[4]}/{SLOT_CONFIG.scatterPay[5]}</span></div>
                </div>
              </div>
            )}
          </div>
        </div>

        {slotBonusState && (
          <div className="panel-2 p-[1.6vmin] mt-[1.6vmin]">
            <div className="os-title text-[1.5vmin]" style={{ color: PALETTE.blue }}>HOLD-AND-SPIN RESULT</div>
            <div className="mt-[0.8vmin] grid grid-cols-5 gap-[0.6vmin] bonus-grid">
              {slotBonusState.grid.map((row, rIdx) => (
                row.map((cell, cIdx) => (
                  <div key={`b-${rIdx}-${cIdx}`} className="bonus-cell">
                    {cell ? (cell.jackpot ? cell.jackpot.toUpperCase() : cell.value) : "-"}
                  </div>
                ))
              ))}
            </div>
            <div className="mt-[0.8vmin] text-[1.2vmin] opacity-85">
              Bonus Win: <span style={{ color: PALETTE.green }}>{slotBonusState.totalWin}</span>
              {slotBonusState.jackpotWins.length > 0 && (
                <span> | Jackpots: {slotBonusState.jackpotWins.map((j) => `${j.tier.toUpperCase()} ${Math.round(j.amount)}`).join(", ")}</span>
              )}
            </div>
          </div>
        )}

        {!slotLastSeen && slotLastOutcome && !slotIsSpinning && (
          <div className="modal" style={{ position: "fixed", inset: 0, zIndex: 90, display: "grid", placeItems: "center", background: "rgba(0,0,0,0.68)", backdropFilter: "blur(0.6vmin)" }}>
            <div className="modal-card">
              <div className="os-title text-[1.6vmin]" style={{ color: PALETTE.green }}>LAST SPIN RECOVERY</div>
              <div className="hr-scan my-[1.2vmin]" />
              <div className="text-[1.25vmin] opacity-85">Total win: {slotLastOutcome.totalWin}. Bonus: {slotLastOutcome.triggerBonus ? "YES" : "NO"}.</div>
              <div className="panel__actions">
                <button className="xg-btn" data-action="slot-ack-last" onClick={() => runAction("slot-ack-last")}>Mark as Seen</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  function SettingsScreen() {
    return (
      <div className="panel p-[2vmin] min-h-0 flex flex-col">
        <div className="flex items-center justify-between">
          <div className="os-title text-[1.8vmin]" style={{ color: PALETTE.blue }}>SETTINGS</div>
          <button className="xg-btn" data-action="settings-back-lobby" onClick={() => runAction("settings-back-lobby")}>Back to Lobby</button>
        </div>
        <div className="hr-scan my-[1.2vmin]" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-[1.2vmin]">
          <Switch
            label="Haptics (vibration)"
            value={!!settings.haptics}
            actionId="settings-toggle-haptics"
            onToggle={() => runAction("settings-toggle-haptics")}
          />
          <Switch
            label="Sound (UI tones)"
            value={!!settings.sound}
            actionId="settings-toggle-sound"
            onToggle={() => runAction("settings-toggle-sound")}
          />
          <Switch
            label="Reduced Motion (cuts animations)"
            value={!!settings.reducedMotion}
            actionId="settings-toggle-reduced-motion"
            onToggle={() => runAction("settings-toggle-reduced-motion")}
          />
          <Switch
            label="Slot Lite Mode (reduced effects)"
            value={!!slotLiteMode}
            actionId="settings-slot-lite"
            onToggle={() => runAction("settings-slot-lite")}
          />

          <div className="panel p-[1.4vmin]">
            <div className="os-title text-[1.35vmin]" style={{ color: PALETTE.green }}>Difficulty</div>
            <div className="mt-[1.0vmin] grid grid-cols-3 gap-[0.8vmin]">
              {["EASY","STANDARD","HARD"].map((d) => (
                <button
                  key={d}
                  className="xg-btn"
                  style={settings.difficulty === d ? { background: "rgba(57,255,20,0.16)" } : null}
                  data-action="settings-difficulty"
                  data-value={d}
                  onClick={() => runAction("settings-difficulty", { value: d })}
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
                data-action="settings-max-cycles"
                onChange={(e) => runAction("settings-max-cycles", { value: e.target.value })}
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
                data-action="settings-ui-intensity"
                onChange={(e) => runAction("settings-ui-intensity", { value: e.target.value })}
              />
            </div>
          </div>

          <div className="panel p-[1.4vmin] md:col-span-2">
            <div className="os-title text-[1.35vmin]" style={{ color: "rgba(255,140,0,0.88)" }}>Danger Zone</div>
            <div className="mt-[1.0vmin] text-[1.3vmin] opacity-85">
              Resetting wipes Gene Credits, best run, and all upgrades.
            </div>
            <div className="mt-[1.2vmin] flex gap-[1.0vmin]">
              <button className="xg-btn" data-action="settings-reset-progress" onClick={() => runAction("settings-reset-progress")} style={{ borderColor: "rgba(255,140,0,0.45)" }}>
                Reset Progress
              </button>
              <button className="xg-btn" data-action="settings-reset-defaults" onClick={() => runAction("settings-reset-defaults")}>
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
            <button className="xg-btn" data-action="store-back-lobby" onClick={() => runAction("store-back-lobby")}>Back to Lobby</button>
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
                  data-action="store-buy"
                  data-item={it.id}
                  onClick={() => runAction("store-buy", { id: it.id })}
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
                      <button
                        className="xg-btn w-full mt-[1.4vmin]"
                        data-action="game-anomaly-stability"
                        onClick={() => runAction("game-anomaly-stability")}
                      >
                        LOCK STABILITY
                      </button>
                    </div>
                    <div className="panel p-[1.6vmin]">
                      <div className="os-title text-[1.35vmin]" style={{ color: PALETTE.blue }}>STEALTH FORK</div>
                      <div className="mt-[1.0vmin] text-[1.35vmin] opacity-85">
                        Alarm -22<br />Stability -8
                      </div>
                      <button
                        className="xg-btn w-full mt-[1.4vmin]"
                        data-action="game-anomaly-stealth"
                        onClick={() => runAction("game-anomaly-stealth")}
                      >
                        GO DARK
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="panel p-[1.6vmin]">
                      <div className="os-title text-[1.35vmin]" style={{ color: PALETTE.blue }}>PURGE & STABILIZE</div>
                      <div className="mt-[1.0vmin] text-[1.35vmin] opacity-85">
                        Stability -15<br />Contamination -25<br />Alarm +10
                      </div>
                      <button
                        className="xg-btn w-full mt-[1.4vmin]"
                        data-action="game-anomaly-purge"
                        onClick={() => runAction("game-anomaly-purge")}
                      >
                        PURGE
                      </button>
                    </div>
                    <div className="panel p-[1.6vmin]">
                      <div className="os-title text-[1.35vmin]" style={{ color: PALETTE.green }}>EMBRACE NULL</div>
                      <div className="mt-[1.0vmin] text-[1.35vmin] opacity-85">
                        Stability +35<br />Alarm +25<br />Tag: NULL
                      </div>
                      <button
                        className="xg-btn w-full mt-[1.4vmin]"
                        data-action="game-anomaly-embrace"
                        onClick={() => runAction("game-anomaly-embrace")}
                      >
                        EMBRACE
                      </button>
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
                <button className="xg-btn" data-action="game-copy-code" onClick={() => runAction("game-copy-code")}>Copy Code</button>
                <button className="xg-btn" data-action="game-leave-room" onClick={() => runAction("game-leave-room")}>Leave Room</button>
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
            <button className="xg-btn" data-action="game-bias-minus" disabled={phase !== "await_spin" || isSpinning || controlTokens <= 0 || tags.includes("FOG")} onClick={() => runAction("game-bias-minus")}>Bias -1 (1T)</button>
            <button className="xg-btn" data-action="game-bias-plus" disabled={phase !== "await_spin" || isSpinning || controlTokens <= 0 || tags.includes("FOG")} onClick={() => runAction("game-bias-plus")}>Bias +1 (1T)</button>
            <button className="xg-btn" data-action="game-patch" disabled={phase !== "await_spin" || isSpinning || controlTokens <= 0} onClick={() => runAction("game-patch")}>Patch (1T)</button>
          </div>

          <div className="mt-[1.2vmin] flex items-center justify-between gap-[1.2vmin]">
            <button className="xg-btn flex-1" data-action="game-spin" onClick={() => runAction("game-spin")} disabled={phase !== "await_spin" || isSpinning || phase === "ended"}>
              {isSpinning ? "Sequencing..." : "Sequence"}
            </button>
            <button className="xg-btn" data-action="game-abort" onClick={() => runAction("game-abort")}>Abort → Lobby</button>
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
              <button className="xg-btn" data-action="game-action-extract" onClick={() => runAction("game-action-extract")} disabled={phase !== "await_action" || phase === "ended"}>Extract</button>
              <button className="xg-btn" data-action="game-action-reroute" onClick={() => runAction("game-action-reroute")} disabled={phase !== "await_action" || controlTokens <= 0 || phase === "ended"}>Re-route (1T)</button>
              <button className="xg-btn" data-action="game-action-vent" onClick={() => runAction("game-action-vent")} disabled={phase !== "await_action" || tags.includes("TRACE_LOCK") || phase === "ended"}>Vent</button>
              <button className="xg-btn" data-action="game-action-ghost" onClick={() => runAction("game-action-ghost")} disabled={phase !== "await_action" || phase === "ended"}>Ghost</button>
              <button className="xg-btn md:col-span-2" data-action="game-action-buffer" onClick={() => runAction("game-action-buffer")} disabled={phase !== "await_action" || tags.includes("TRACE_LOCK") || phase === "ended"}>Synthesize Buffer</button>
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

              <button className="xg-btn w-full mt-[1.0vmin]" data-action="game-abort-return" onClick={() => runAction("game-abort-return")}>
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
                <button className="xg-btn" data-action="knct-copy-code" onClick={() => runAction("knct-copy-code")}>Copy Code</button>
                <button className="xg-btn" data-action="knct-leave-room" onClick={() => runAction("knct-leave-room")}>Leave Room</button>
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
              data-action="knct-hover-clear"
              onPointerLeave={() => runAction("knct-hover-clear")}
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
                        onPointerEnter={() => runAction("knct-hover-set", { col: cIdx })}
                        data-action="knct-drop"
                        data-col={cIdx}
                        onClick={() => runAction("knct-drop", { col: cIdx })}
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
            <button className="xg-btn" data-action="knct-reset-match" onClick={() => runAction("knct-reset-match")} disabled={knctMoves.length === 0 || (mpStatus.connected && mpStatus.mode === "knct4" && mpStatus.role !== "host")}>
              Reset Match
            </button>
            <button className="xg-btn" data-action="knct-next-match" onClick={() => runAction("knct-next-match")} disabled={mpStatus.connected && mpStatus.mode === "knct4" && mpStatus.role !== "host"}>
              New Match
            </button>
            <button className="xg-btn" data-action="knct-back-lobby" onClick={() => runAction("knct-back-lobby")}>
              Back to Lobby
            </button>
            <button className="xg-btn" data-action="knct-open-settings" onClick={() => runAction("knct-open-settings")}>
              Settings
            </button>
            {mpStatus.connected && mpStatus.mode === "knct4" && (
              <button className="xg-btn" data-action="knct-leave-room-footer" onClick={() => runAction("knct-leave-room-footer")}>
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
            <button className="xg-btn w-full mt-[1.0vmin]" data-action="knct-reset-scores" onClick={() => runAction("knct-reset-scores")} disabled={mpStatus.connected && mpStatus.mode === "knct4" && mpStatus.role !== "host"}>
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
                  data-action="knct-chipset"
                  data-chipset={set.id}
                  onClick={() => runAction("knct-chipset", { id: set.id })}
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
            {navButton("slot", "Slot Machine")}
            {navButton("store", "Store")}
            {navButton("settings", "Settings")}
            {screen === "game" ? navButton("game", "Run") : null}
          </div>
        </div>

        <div className="min-h-0">
          {screen === "lobby" && <LobbyScreen />}
          {screen === "knct4" && <Knct4Screen />}
          {screen === "slot" && <SlotScreen />}
          {screen === "store" && <StoreScreen />}
          {screen === "settings" && <SettingsScreen />}
          {screen === "game" && <GameScreen />}
        </div>

        <div className="panel px-[2vmin] py-[1.4vmin] flex items-center justify-between">
          <div className="text-[1.2vmin] opacity-80">
            BUILD: XG-OS / Lobby + Slot + Store + Settings + Run + Connect-4 / React18 + Tailwind + GSAP + Babel
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
              <button className="xg-btn" data-action="modal-room-full-ok" onClick={() => runAction("modal-room-full-ok")}>OK</button>
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
                data-action="modal-join-input"
                onChange={(e) => runAction("modal-join-input", { value: e.target.value })}
                placeholder="e.g. A9K2QZ"
              />
            </div>
            <div className="panel__actions">
              <button className="xg-btn" data-action="modal-join-cancel" onClick={() => runAction("modal-join-cancel")}>Cancel</button>
              <button className="xg-btn" data-action="modal-join-submit" onClick={() => runAction("modal-join-submit")} disabled={!mpJoinModal.code}>Join</button>
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

      <div className="debug-overlay">
        <button className="xg-btn debug-toggle" data-action="debug-toggle" onClick={() => runAction("debug-toggle")}>
          {debugOpen ? "Close Debug" : "Open Debug"}
        </button>
        {debugOpen && (
          <div className="debug-card">
            <div className="os-title text-[1.35vmin]" style={{ color: PALETTE.green }}>IN-APP DEBUG</div>
            <div className="mt-[0.8vmin] text-[1.2vmin] opacity-80">
              Missing data-action: {debugReport.missingAction.length} | Missing handler: {debugReport.missingHandler.length}
            </div>
            <div className="mt-[0.8vmin] grid grid-cols-2 gap-[0.8vmin]">
              <button className="xg-btn" data-action="debug-scan" onClick={() => runAction("debug-scan")}>Scan Actions</button>
              <button className="xg-btn" data-action="debug-run-tests" onClick={() => runAction("debug-run-tests")}>Run Self Tests</button>
              <button className="xg-btn" data-action="debug-run-sim" onClick={() => runAction("debug-run-sim")}>Run 10k Sim</button>
              <button className="xg-btn" data-action="debug-reset-meters" onClick={() => runAction("debug-reset-meters")}>Reset Meters</button>
              <button className="xg-btn" data-action="debug-run-smoke" onClick={() => runAction("debug-run-smoke")}>Run Smoke Tests</button>
            </div>

            <div className="mt-[0.8vmin] grid grid-cols-2 gap-[0.8vmin]">
              <div className="field">
                <label>Slot Seed</label>
                <input
                  className="xg-input"
                  type="number"
                  value={slotSeed}
                  data-action="debug-set-seed"
                  onChange={(e) => runAction("debug-set-seed", { value: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Slot Credits</label>
                <input
                  className="xg-input"
                  type="number"
                  value={slotCredits}
                  data-action="debug-set-credits"
                  onChange={(e) => runAction("debug-set-credits", { value: e.target.value })}
                />
              </div>
            </div>

            {slotSimStats && (
              <div className="mt-[0.8vmin] text-[1.15vmin] opacity-85">
                Sim {slotSimStats.spins} spins | RTP {slotSimStats.rtp.toFixed(3)} | Bonus {slotSimStats.bonusHits} | Seed {slotSimStats.seed}
              </div>
            )}

            {slotLog.length > 0 && (
              <div className="mt-[0.8vmin] text-[1.1vmin]">
                Last Spins:
                {slotLog.slice(0, 20).map((ln, idx) => (
                  <div key={`${ln.t}-${idx}`} className="opacity-75">[{ln.t}] {ln.m}</div>
                ))}
              </div>
            )}

            {debugReport.missingAction.length > 0 && (
              <div className="mt-[0.8vmin] text-[1.1vmin]">
                Missing data-action:
                {debugReport.missingAction.slice(0, 6).map((item) => (
                  <div key={item} className="opacity-75">{item}</div>
                ))}
              </div>
            )}

            {debugReport.missingHandler.length > 0 && (
              <div className="mt-[0.8vmin] text-[1.1vmin]">
                Missing handlers:
                {debugReport.missingHandler.slice(0, 6).map((item) => (
                  <div key={item} className="opacity-75">{item}</div>
                ))}
              </div>
            )}

            {selfTestResults.length > 0 && (
              <div className="mt-[0.8vmin] text-[1.1vmin]">
                Self Tests:
                {selfTestResults.map((t) => (
                  <div key={t.name} className={t.pass ? "test-pass" : "test-fail"}>
                    {t.pass ? "PASS" : "FAIL"} — {t.name} ({t.detail})
                  </div>
                ))}
              </div>
            )}

            {smokeResults.length > 0 && (
              <div className="mt-[0.8vmin] text-[1.1vmin]">
                Smoke Tests:
                {smokeResults.map((t) => (
                  <div key={t.name} className={t.pass ? "test-pass" : "test-fail"}>
                    {t.pass ? "PASS" : "FAIL"} — {t.name} ({t.detail})
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
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
