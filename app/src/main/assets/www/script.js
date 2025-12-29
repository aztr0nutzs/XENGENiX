'use strict';

/*
  PEGZ // OozeLab Connect-4
  - 7 columns × 6 rows
  - Local 2P or CPU (easy)
  - Classic or Timed (per-turn countdown)
  - Undo, stats persistence

  Assets:
    ./assets/pieces/blob_<color>_<expression>.png
*/

const ROWS = 6;
const COLS = 7;

const SETTINGS_KEY = 'pegz_oozelab_connect4_settings_v1';
const STATS_KEY = 'pegz_oozelab_connect4_stats_v1';

const DEFAULT_SETTINGS = {
  opponent: 'local',          // 'local' | 'cpu'
  mode: 'classic',            // 'classic' | 'timed'
  turnSeconds: 10,            // used in timed mode
  haptics: true,
  sound: true,
  oozeIntensity: 85,
  // Character selection (only TWO characters active per match)
  // Each is a single sprite filename from ./assets/pieces/
  p1Piece: 'blob_green_happy.png',
  p2Piece: 'blob_magenta_happy.png',
  // If enabled, pieces can swap expression based on events (still same character color)
  moodFaces: false,

  // Legacy (kept for backward-compat migration)
  p1Set: 'green',
  p2Set: 'magenta'
};

const DEFAULT_STATS = {
  p1Wins: 0,
  p2Wins: 0,
  draws: 0,
  streak: 0,
  lastWinner: 0 // 0 none, 1 p1, 2 p2
};

const PIECE_SETS = {
  green: ['blob_green_happy.png','blob_green_angry.png','blob_green_surprised.png','blob_green_sad.png','blob_green_grin.png','blob_green_wink.png','blob_green_derp.png','blob_green_evil.png','blob_green_shock.png'],
  magenta: ['blob_magenta_happy.png','blob_magenta_angry.png','blob_magenta_surprised.png','blob_magenta_sad.png','blob_magenta_grin.png','blob_magenta_wink.png','blob_magenta_derp.png','blob_magenta_evil.png','blob_magenta_shock.png'],
  teal: ['blob_teal_happy.png','blob_teal_angry.png','blob_teal_surprised.png','blob_teal_sad.png','blob_teal_grin.png','blob_teal_wink.png','blob_teal_derp.png','blob_teal_evil.png','blob_teal_shock.png'],
  blue: ['blob_blue_happy.png','blob_blue_angry.png','blob_blue_surprised.png','blob_blue_sad.png','blob_blue_grin.png','blob_blue_wink.png','blob_blue_derp.png','blob_blue_evil.png','blob_blue_shock.png'],
  purple: ['blob_purple_happy.png','blob_purple_angry.png','blob_purple_surprised.png','blob_purple_sad.png','blob_purple_grin.png','blob_purple_wink.png','blob_purple_derp.png','blob_purple_evil.png','blob_purple_shock.png'],
  amber: ['blob_amber_happy.png','blob_amber_angry.png','blob_amber_surprised.png','blob_amber_sad.png','blob_amber_grin.png','blob_amber_wink.png','blob_amber_derp.png','blob_amber_evil.png','blob_amber_shock.png'],
  // additional vivid specimens
  red: ['blob_red_happy.png','blob_red_angry.png','blob_red_surprised.png','blob_red_sad.png','blob_red_grin.png','blob_red_wink.png','blob_red_derp.png','blob_red_evil.png','blob_red_shock.png'],
  orange: ['blob_orange_happy.png','blob_orange_angry.png','blob_orange_surprised.png','blob_orange_sad.png','blob_orange_grin.png','blob_orange_wink.png','blob_orange_derp.png','blob_orange_evil.png','blob_orange_shock.png'],
  lime: ['blob_lime_happy.png','blob_lime_angry.png','blob_lime_surprised.png','blob_lime_sad.png','blob_lime_grin.png','blob_lime_wink.png','blob_lime_derp.png','blob_lime_evil.png','blob_lime_shock.png'],
  cyan: ['blob_cyan_happy.png','blob_cyan_angry.png','blob_cyan_surprised.png','blob_cyan_sad.png','blob_cyan_grin.png','blob_cyan_wink.png','blob_cyan_derp.png','blob_cyan_evil.png','blob_cyan_shock.png'],
};

const SET_KEYS = Object.keys(PIECE_SETS);
const ALL_PIECES = SET_KEYS.flatMap(k => PIECE_SETS[k]);
const EXPRESSIONS = ['happy', 'angry', 'surprised', 'sad', 'grin', 'wink', 'derp', 'evil', 'shock'];


function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }
function randInt(max){ return Math.floor(Math.random() * max); }

function loadJSON(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    if(!raw) return structuredClone(fallback);
    const parsed = JSON.parse(raw);
    return { ...structuredClone(fallback), ...parsed };
  }catch{
    return structuredClone(fallback);
  }
}
function saveJSON(key, value){
  try{ localStorage.setItem(key, JSON.stringify(value)); }catch{}
}

function vibrate(pattern){
  if(!settings.haptics) return;
  if(!('vibrate' in navigator)) return;
  try{ navigator.vibrate(pattern); }catch{}
}

let audioCtx = null;
function beep(freq = 220, dur = 0.05, gain = 0.03){
  if(!settings.sound) return;
  try{
    audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
    const t0 = audioCtx.currentTime;

    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(g);
    g.connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }catch{
    // ignore
  }
}

const els = {
    lobbyScreen: document.getElementById('lobby-screen'),
    gameScreen: document.getElementById('game-screen'),
    settingsScreen: document.getElementById('settings-screen'),
    startGameBtn: document.getElementById('startGameBtn'),
    settingsBtn: document.getElementById('settingsBtn'),
    backToLobbyBtnFromGame: document.getElementById('backToLobbyBtnFromGame'),
    backToLobbyBtnFromSettings: document.getElementById('backToLobbyBtnFromSettings'),

  board: document.getElementById('board'),
  cells: document.getElementById('cells'),
  dropzones: document.getElementById('dropzones'),
  toast: document.getElementById('toast'),
  boardShell: document.querySelector('.board-shell'),
  oozePuddle: document.getElementById('oozePuddle'),
  oozeBubbles: document.getElementById('oozeBubbles'),

  turnPill: document.getElementById('turnPill'),
  opponentPill: document.getElementById('opponentPill'),
  modePill: document.getElementById('modePill'),
  timerPill: document.getElementById('timerPill'),
  timer: document.getElementById('timer'),

  p1Wins: document.getElementById('p1Wins'),
  p2Wins: document.getElementById('p2Wins'),
  draws: document.getElementById('draws'),
  streak: document.getElementById('streak'),

  lastMove: document.getElementById('lastMove'),
  moveCount: document.getElementById('moveCount'),

  // controls
  oppLocal: document.getElementById('oppLocal'),
  oppCpu: document.getElementById('oppCpu'),
  modeClassic: document.getElementById('modeClassic'),
  modeTimed: document.getElementById('modeTimed'),
  turnSeconds: document.getElementById('turnSeconds'),
  oozeIntensity: document.getElementById('oozeIntensity'),
  oozeVal: document.getElementById('oozeVal'),
  hapticsBtn: document.getElementById('hapticsBtn'),
  soundBtn: document.getElementById('soundBtn'),

  newGameBtn: document.getElementById('newGameBtn'),
  undoBtn: document.getElementById('undoBtn'),
  wipeBtn: document.getElementById('wipeBtn'),
  resetStatsBtn: document.getElementById('resetStatsBtn'),

  p1Palette: document.getElementById('p1Palette'),
  p2Palette: document.getElementById('p2Palette'),

  overlay: document.getElementById('overlay'),
  overlayTitle: document.getElementById('overlayTitle'),
  overlayBody: document.getElementById('overlayBody'),
  replayBtn: document.getElementById('replayBtn'),
  closeBtn: document.getElementById('closeBtn'),

  // character picker
  picker: document.getElementById('picker'),
  pickerTitle: document.getElementById('pickerTitle'),
  pickerSub: document.getElementById('pickerSub'),
  pickerGrid: document.getElementById('pickerGrid'),
  pickerCloseBtn: document.getElementById('pickerCloseBtn')
};

let settings = loadJSON(SETTINGS_KEY, DEFAULT_SETTINGS);
let stats = loadJSON(STATS_KEY, DEFAULT_STATS);

let grid = makeEmptyGrid();
let turn = 1;             // 1 or 2
let locked = false;       // prevents clicks during animation/CPU
let history = [];         // stack of moves {r,c,turn, cellIndex, pieceName}
let gameOver = false;

let timedRemaining = settings.turnSeconds;
let timerId = null;

// --- Character selection (only two active per match) ---
let pickerForPlayer = 1;

function buildCharacterChoices(){
  const colors = Object.keys(PIECE_SETS);
  const picks = [];
  for(const color of colors){
    // Two easy-to-recognize "characters" per color. More can be added later.
    for(const expr of ['happy','evil']){
      const file = `blob_${color}_${expr}.png`;
      const exists = (PIECE_SETS[color] ?? []).includes(file);
      if(exists){
        picks.push({
          color,
          expr,
          file,
          label: `${colorLabel(color)} ${expr.toUpperCase()}`
        });
      }
    }
  }
  return picks;
}

const CHARACTER_CHOICES = buildCharacterChoices();

function makeEmptyGrid(){
  return Array.from({length: ROWS}, () => Array.from({length: COLS}, () => 0));
}

function cellIndex(r, c){ return r * COLS + c; }

function pieceColor(pieceName){
  const m = /^blob_([^_]+)_/i.exec(String(pieceName ?? ''));
  return m ? m[1].toLowerCase() : 'green';
}

function colorLabel(color){
  return String(color ?? 'green').replace(/_/g, ' ').toUpperCase();
}

function pickFromSet(setKey, preferredExpr){
  const arr = PIECE_SETS[setKey] ?? PIECE_SETS.green;
  if(preferredExpr){
    const hit = arr.find(n => n.includes(`_${preferredExpr}.png`));
    if(hit) return hit;
  }
  return arr[0] ?? 'blob_green_happy.png';
}

// IMPORTANT: only TWO characters are active per match (P1 + P2)
// By default, each player uses a single base sprite (p1Piece / p2Piece).
// Optional: moodFaces swaps expression while keeping the same color.
function getPieceFor(player, preferredExpr){
  const base = player === 1 ? settings.p1Piece : settings.p2Piece;
  if(!settings.moodFaces) return base;
  const color = pieceColor(base);
  return pickFromSet(color, preferredExpr || 'happy');
}

function pieceUrl(pieceName){
  return `./assets/pieces/${pieceName}`;
}

function setToast(msg){
  els.toast.textContent = msg ?? '';
}

function setPressed(btn, pressed){
  btn.setAttribute('aria-pressed', pressed ? 'true' : 'false');
}

function updateTopPills(){
  const p1Name = colorLabel(pieceColor(settings.p1Piece));
  const p2Name = colorLabel(pieceColor(settings.p2Piece));
  els.turnPill.textContent = (turn === 1 ? `P1: ${p1Name}` : `P2: ${p2Name}`);
  els.opponentPill.textContent = (settings.opponent === 'cpu' ? 'CPU (EASY)' : 'LOCAL');
  els.modePill.textContent = (settings.mode === 'timed' ? 'TIMED' : 'CLASSIC');

  if(settings.mode === 'timed'){
    els.timerPill.hidden = false;
  }else{
    els.timerPill.hidden = true;
  }
}

function updateStatsUI(){
  els.p1Wins.textContent = String(stats.p1Wins);
  els.p2Wins.textContent = String(stats.p2Wins);
  els.draws.textContent = String(stats.draws);
  els.streak.textContent = String(stats.streak);
}

function syncControlsUI(){
  setPressed(els.oppLocal, settings.opponent === 'local');
  setPressed(els.oppCpu, settings.opponent === 'cpu');
  setPressed(els.modeClassic, settings.mode === 'classic');
  setPressed(els.modeTimed, settings.mode === 'timed');

  els.turnSeconds.value = String(settings.turnSeconds);
  if(els.oozeIntensity){
    els.oozeIntensity.value = String(settings.oozeIntensity);
  }
  if(els.oozeVal){
    els.oozeVal.textContent = `${settings.oozeIntensity}%`;
  }
  document.documentElement.style.setProperty('--ooze-intensity', String(settings.oozeIntensity/100));
  setPressed(els.hapticsBtn, !!settings.haptics);
  els.hapticsBtn.textContent = settings.haptics ? 'On' : 'Off';

  setPressed(els.soundBtn, !!settings.sound);
  els.soundBtn.textContent = settings.sound ? 'On' : 'Off';

  // palettes show each player's selected character (ONLY TWO at a time)
  const p1 = getPieceFor(1);
  const p2 = getPieceFor(2);
  els.p1Palette.style.backgroundImage = `url("${pieceUrl(p1)}")`;
  els.p2Palette.style.backgroundImage = `url("${pieceUrl(p2)}")`;
}

function setPlayerPiece(player, pieceFile){
  const prev1 = settings.p1Piece;
  const prev2 = settings.p2Piece;

  if(player === 1){
    settings.p1Piece = pieceFile;
    if(settings.p1Piece === settings.p2Piece){
      // keep two distinct characters: swap the other player to your previous
      settings.p2Piece = prev1;
    }
  }else{
    settings.p2Piece = pieceFile;
    if(settings.p2Piece === settings.p1Piece){
      settings.p1Piece = prev2;
    }
  }

  // Update legacy fields for older saves/tools that still read sets
  settings.p1Set = pieceColor(settings.p1Piece);
  settings.p2Set = pieceColor(settings.p2Piece);

  saveJSON(SETTINGS_KEY, settings);
  syncControlsUI();
  updateTopPills();

  // Character changes mid-match are confusing; reset the board.
  wipeBoardState({keepTurn:false});
  setToast(`Specimens locked: P1 ${colorLabel(pieceColor(settings.p1Piece))} • P2 ${colorLabel(pieceColor(settings.p2Piece))}`);

  if(settings.haptics) vibrate([20]);
}

function openPicker(player){
  pickerForPlayer = player;
  els.pickerSub.textContent = player === 1 ? 'PLAYER 1' : 'PLAYER 2';
  els.pickerGrid.innerHTML = '';

  for(const choice of CHARACTER_CHOICES){
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'picker-item';
    b.setAttribute('role', 'listitem');

    const img = document.createElement('div');
    img.className = 'picker-item__img';
    img.style.backgroundImage = `url("${pieceUrl(choice.file)}")`;

    const lab = document.createElement('div');
    lab.className = 'picker-item__label';
    lab.textContent = choice.label;

    b.appendChild(img);
    b.appendChild(lab);

    b.addEventListener('click', () => {
      setPlayerPiece(pickerForPlayer, choice.file);
      closePicker();
    });

    els.pickerGrid.appendChild(b);
  }

  els.picker.classList.remove('hidden');
}

function closePicker(){
  els.picker.classList.add('hidden');
}

function buildBoardDOM(){
  // cells grid
  els.cells.innerHTML = '';
  for(let r=0; r<ROWS; r++){
    for(let c=0; c<COLS; c++){
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.r = String(r);
      cell.dataset.c = String(c);
      cell.dataset.idx = String(cellIndex(r,c));
      els.cells.appendChild(cell);
    }
  }

  // drop zones (one per column)
  els.dropzones.innerHTML = '';
  for(let c=0; c<COLS; c++){
    const dz = document.createElement('button');
    dz.type = 'button';
    dz.className = 'dropzone';
    dz.dataset.c = String(c);
    dz.ariaLabel = `Drop in column ${c+1}`;
    dz.addEventListener('mouseenter', () => onColumnHover(c, true));
    dz.addEventListener('mouseleave', () => onColumnHover(c, false));
    dz.addEventListener('focus', () => onColumnHover(c, true));
    dz.addEventListener('blur', () => onColumnHover(c, false));
    dz.addEventListener('click', () => handleColumnClick(c));
    els.dropzones.appendChild(dz);
  }
}


function onColumnHover(col, on){
  const can = on && !locked && !gameOver;
  const cells = els.cells.querySelectorAll(`.cell[data-c="${col}"]`);
  for(const el of cells){
    el.classList.toggle('hover', can);
  }

  const dz = els.dropzones.querySelector(`.dropzone[data-c="${col}"]`);
  if(dz){
    dz.classList.toggle('is-active', can);
  }
  if(can){
    const preview = getPieceFor(turn);
    els.dropzones.style.setProperty('--preview-img', `url("${pieceUrl(preview)}")`);
  }else{
    els.dropzones.style.setProperty('--preview-img', 'none');
  }
}


function findDropRow(col){
  for(let r=ROWS-1; r>=0; r--){
    if(grid[r][col] === 0) return r;
  }
  return -1;
}

function clearWinHighlights(){
  for(const el of els.cells.querySelectorAll('.cell.win')){
    el.classList.remove('win');
  }
}

function highlightCells(indices){
  for(const idx of indices){
    const el = els.cells.querySelector(`.cell[data-idx="${idx}"]`);
    if(el) el.classList.add('win');
  }
}

function setOverlay(open, title='', body=''){
  if(open){
    els.overlayTitle.textContent = title;
    els.overlayBody.textContent = body;
    els.overlay.classList.remove('hidden');
  }else{
    els.overlay.classList.add('hidden');
  }
}

function updateReadout(){
  els.moveCount.textContent = String(history.length);
  if(history.length === 0){
    els.lastMove.textContent = '—';
  }else{
    const m = history[history.length-1];
    els.lastMove.textContent = `C${m.c+1} → R${m.r+1}`;
  }
}

function stopTimer(){
  if(timerId){
    clearInterval(timerId);
    timerId = null;
  }
}

function startTimer(){
  stopTimer();
  if(settings.mode !== 'timed' || gameOver) return;

  timedRemaining = clamp(parseInt(settings.turnSeconds, 10) || 10, 3, 30);
  els.timer.textContent = String(timedRemaining);

  timerId = setInterval(async () => {
    if(gameOver || locked) return;
    timedRemaining -= 1;
    els.timer.textContent = String(Math.max(0, timedRemaining));

    if(timedRemaining <= 0){
      // time expired: auto-play for this turn (best available)
      stopTimer();
      setToast('⏱️ Timer expired — auto-injecting specimen...');
      vibrate([20, 30, 20]);
      await sleep(120);
      await autoMoveForCurrentTurn();
    }
  }, 1000);
}

async function autoMoveForCurrentTurn(){
  if(gameOver) return;
  // choose best column for current player (win > block > center > random)
  const col = pickCpuColumn(turn);
  await handleColumnClick(col);
}

function isBoardFull(){
  for(let c=0; c<COLS; c++){
    if(grid[0][c] === 0) return false;
  }
  return true;
}

function checkWinFrom(r, c, player){
  const dirs = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1]
  ];

  for(const [dr, dc] of dirs){
    let line = [[r,c]];
    // forward
    let rr = r + dr, cc = c + dc;
    while(rr>=0 && rr<ROWS && cc>=0 && cc<COLS && grid[rr][cc] === player){
      line.push([rr,cc]);
      rr += dr; cc += dc;
    }
    // backward
    rr = r - dr; cc = c - dc;
    while(rr>=0 && rr<ROWS && cc>=0 && cc<COLS && grid[rr][cc] === player){
      line.unshift([rr,cc]);
      rr -= dr; cc -= dc;
    }
    if(line.length >= 4){
      // choose the exact 4-in-a-row segment that includes the last move, but prefer the longest highlight
      const indices = line.map(([ar,ac]) => cellIndex(ar,ac));
      return indices;
    }
  }
  return null;
}

function scoreStatsForWinner(winner){
  if(winner === 1){
    stats.p1Wins += 1;
  }else if(winner === 2){
    stats.p2Wins += 1;
  }else{
    stats.draws += 1;
  }

  // streak tracking (consecutive same winner, resets on draw or change)
  if(winner === 0){
    stats.streak = 0;
    stats.lastWinner = 0;
  }else{
    if(stats.lastWinner === winner){
      stats.streak += 1;
    }else{
      stats.streak = 1;
      stats.lastWinner = winner;
    }
  }

  saveJSON(STATS_KEY, stats);
  updateStatsUI();
}

function wipeBoardState({keepTurn=false} = {}){
  stopTimer();
  grid = makeEmptyGrid();
  history = [];
  locked = false;
  gameOver = false;
  clearWinHighlights();
  setOverlay(false);
  setToast('');
  updateReadout();

  // clear pieces DOM
  for(const cell of els.cells.querySelectorAll('.cell')){
    cell.innerHTML = '';
  }

  if(!keepTurn) turn = 1;
  updateTopPills();
  startTimer();
}

async function animateDrop(cellEl, pieceName, row){
  const piece = document.createElement('div');
  piece.className = 'piece';
  piece.style.backgroundImage = `url("${pieceUrl(pieceName)}")`;
  cellEl.appendChild(piece);

  // compute a reasonable start offset in pixels based on cell size
  const rect = cellEl.getBoundingClientRect();
  const startY = -((row + 2) * rect.height) - 40;

  // WAAPI animation
  try{
    piece.animate(
      [
        { transform: `translate3d(0, ${startY}px, 0)` },
        { transform: 'translate3d(0, 0px, 0)' }
      ],
      {
        duration: 180 + row * 70,
        easing: 'cubic-bezier(.14,.72,.16,1.02)',
        fill: 'both'
      }
    );
  }catch{
    // fallback: no-op
  }

  // sound + haptics
  beep(180 + row * 18, 0.05, 0.028);
  vibrate(10);
  await sleep(210 + row * 60);
}


function spawnSplashFromCell(cellEl){
  const rect = cellEl.getBoundingClientRect();
  const boardRect = els.board.getBoundingClientRect();
  const x = (rect.left + rect.width/2) - boardRect.left;
  const y = (rect.top + rect.height*0.60) - boardRect.top;

  const splash = document.createElement('div');
  splash.className = 'goo-splash';
  splash.style.left = `${x}px`;
  splash.style.top = `${y}px`;
  els.board.appendChild(splash);
  splash.addEventListener('animationend', () => splash.remove(), { once:true });
}

function spawnBubbles(col){
  if(!els.oozeBubbles) return;
  const n = 2 + randInt(3);
  for(let i=0;i<n;i++){
    const b = document.createElement('div');
    b.className = 'ooze-bubble';
    const x = 10 + (col / (COLS-1)) * 80 + (Math.random()*10 - 5);
    b.style.left = `${x}%`;
    b.style.setProperty('--dur', `${2.2 + Math.random()*1.2}s`);
    b.style.setProperty('--rise', `${70 + Math.random()*70}px`);
    els.oozeBubbles.appendChild(b);
    b.addEventListener('animationend', () => b.remove(), { once:true });
  }

  // subtle ripple on the ooze puddle for extra "wet" feedback
  if(els.oozePuddle){
    const r = document.createElement('div');
    r.className = 'ooze-ripple';
    const x = 10 + (col / (COLS-1)) * 80 + (Math.random()*8 - 4);
    r.style.left = `${x}%`;
    els.oozePuddle.appendChild(r);
    r.addEventListener('animationend', () => r.remove(), { once:true });
  }
}

function shakeBoard(){
  if(!els.boardShell) return;
  els.boardShell.classList.remove('shake');
  // force reflow
  void els.boardShell.offsetWidth;
  els.boardShell.classList.add('shake');
  setTimeout(() => els.boardShell && els.boardShell.classList.remove('shake'), 520);
}


async function placePiece(col){
  const r = findDropRow(col);
  if(r < 0) return null;

  const idx = cellIndex(r, col);
  const cellEl = els.cells.querySelector(`.cell[data-idx="${idx}"]`);
  if(!cellEl) return null;

  grid[r][col] = turn;
  const pieceName = getPieceFor(turn);

  await animateDrop(cellEl, pieceName, r);
  spawnSplashFromCell(cellEl);
  spawnBubbles(col);

  history.push({ r, c: col, turn, idx, pieceName });
  updateReadout();

  // check win/draw
  const winIndices = checkWinFrom(r, col, turn);
  if(winIndices){
    gameOver = true;
    shakeBoard();
    clearWinHighlights();
    highlightCells(winIndices);

    const winner = turn;
    const title = winner === 1 ? 'CONTAINMENT BREACH — P1 WINS' : 'CONTAINMENT BREACH — P2 WINS';
    const p1Name = colorLabel(pieceColor(settings.p1Piece));
    const p2Name = colorLabel(pieceColor(settings.p2Piece));
    const body = winner === 1
      ? `${p1Name} specimens established a stable chain reaction.`
      : `${p2Name} specimens established a stable chain reaction.`;

    setToast(winner === 1 ? '✅ P1 wins.' : '✅ P2 wins.');
    vibrate([30, 30, 60]);
    beep(520, 0.08, 0.04);
    beep(780, 0.08, 0.03);
    scoreStatsForWinner(winner);
    setOverlay(true, title, body);

    stopTimer();
    return { win: true, winner };
  }

  if(isBoardFull()){
    gameOver = true;
    setToast('🟨 Draw. Board fully saturated.');
    vibrate([20,20,20]);
    beep(240, 0.08, 0.03);
    scoreStatsForWinner(0);
    setOverlay(true, 'GAME OVER — DRAW', 'No stable 4-chain detected before saturation.');
    stopTimer();
    return { win: false, draw: true };
  }

  return { win: false, draw: false };
}

function switchTurn(){
  turn = turn === 1 ? 2 : 1;
  updateTopPills();
  startTimer();
}

async function handleColumnClick(col){
  if(locked || gameOver) return;
  if(col < 0 || col >= COLS) return;

  const r = findDropRow(col);
  if(r < 0){
    setToast('⛔ Column full. Choose another injection port.');
    vibrate(20);
    beep(120, 0.06, 0.02);
    return;
  }

  locked = true;
  clearWinHighlights();
  stopTimer();

  const result = await placePiece(col);

  locked = false;

  if(!result) return;
  if(gameOver) return;

  switchTurn();

  // CPU response
  if(settings.opponent === 'cpu' && turn === 2 && !gameOver){
    locked = true;
    setToast('CPU analyzing containment vectors...');
    await sleep(260);
    const cpuCol = pickCpuColumn(2);
    setToast('');
    await handleColumnClick(cpuCol);
    locked = false;
  }
}

function undo(){
  if(locked || history.length === 0) return;
  if(gameOver){
    setOverlay(false);
    gameOver = false;
    clearWinHighlights();
  }

  stopTimer();

  // If CPU mode and it's human turn, undo two moves when possible (CPU+human)
  const undoCount = (settings.opponent === 'cpu' && turn === 1 && history.length >= 2) ? 2 : 1;

  for(let i=0; i<undoCount; i++){
    const m = history.pop();
    if(!m) break;
    grid[m.r][m.c] = 0;

    const cellEl = els.cells.querySelector(`.cell[data-idx="${m.idx}"]`);
    if(cellEl) cellEl.innerHTML = '';

    // restore turn to the undone move's player
    turn = m.turn;
  }

  updateTopPills();
  updateReadout();
  setToast('↩️ Undo.');
  vibrate(12);
  beep(160, 0.05, 0.02);

  startTimer();
}

function wouldWinIfDrop(player, col){
  const r = findDropRow(col);
  if(r < 0) return false;
  grid[r][col] = player;
  const win = !!checkWinFrom(r, col, player);
  grid[r][col] = 0;
  return win;
}

function pickCpuColumn(player){
  // 1) win now
  for(let c=0; c<COLS; c++){
    if(wouldWinIfDrop(player, c)) return c;
  }
  // 2) block opponent
  const opp = player === 1 ? 2 : 1;
  for(let c=0; c<COLS; c++){
    if(wouldWinIfDrop(opp, c)) return c;
  }
  // 3) center preference
  const centerOrder = [3,2,4,1,5,0,6];
  for(const c of centerOrder){
    if(findDropRow(c) >= 0) return c;
  }
  // 4) fallback
  const valid = [];
  for(let c=0; c<COLS; c++){
    if(findDropRow(c) >= 0) valid.push(c);
  }
  return valid.length ? valid[randInt(valid.length)] : 0;
}

function bindUI(){
    els.startGameBtn.addEventListener('click', () => {
        els.lobbyScreen.classList.add('hidden');
        els.gameScreen.classList.remove('hidden');
    });

    els.settingsBtn.addEventListener('click', () => {
        els.lobbyScreen.classList.add('hidden');
        els.settingsScreen.classList.remove('hidden');
    });

    els.backToLobbyBtnFromGame.addEventListener('click', () => {
        els.gameScreen.classList.add('hidden');
        els.lobbyScreen.classList.remove('hidden');
    });

    els.backToLobbyBtnFromSettings.addEventListener('click', () => {
        els.settingsScreen.classList.add('hidden');
        els.lobbyScreen.classList.remove('hidden');
    });

  els.oppLocal.addEventListener('click', () => {
    settings.opponent = 'local';
    saveJSON(SETTINGS_KEY, settings);
    syncControlsUI();
    updateTopPills();
    wipeBoardState();
    setToast('Opponent: Local 2P.');
  });
  els.oppCpu.addEventListener('click', () => {
    settings.opponent = 'cpu';
    saveJSON(SETTINGS_KEY, settings);
    syncControlsUI();
    updateTopPills();
    wipeBoardState();
    setToast('Opponent: CPU (easy). You are P1.');
  });

  els.modeClassic.addEventListener('click', () => {
    settings.mode = 'classic';
    saveJSON(SETTINGS_KEY, settings);
    syncControlsUI();
    updateTopPills();
    wipeBoardState({keepTurn:false});
    setToast('Mode: Classic.');
  });
  els.modeTimed.addEventListener('click', () => {
    settings.mode = 'timed';
    saveJSON(SETTINGS_KEY, settings);
    syncControlsUI();
    updateTopPills();
    wipeBoardState({keepTurn:false});
    setToast('Mode: Timed (per-turn).');
  });

  els.turnSeconds.addEventListener('change', () => {
    const v = clamp(parseInt(els.turnSeconds.value, 10) || 10, 3, 30);
    settings.turnSeconds = v;
    els.turnSeconds.value = String(v);
    saveJSON(SETTINGS_KEY, settings);
    if(settings.mode === 'timed'){
      startTimer();
      setToast(`Timer set to ${v}s per turn.`);
    }
  });

if(els.oozeIntensity){
  const onOoze = () => {
    const v = clamp(parseInt(els.oozeIntensity.value, 10) || 85, 30, 130);
    settings.oozeIntensity = v;
    if(els.oozeVal) els.oozeVal.textContent = `${v}%`;
    document.documentElement.style.setProperty('--ooze-intensity', String(v/100));
    saveJSON(SETTINGS_KEY, settings);
  };
  els.oozeIntensity.addEventListener('input', onOoze);
  els.oozeIntensity.addEventListener('change', onOoze);
}


  els.hapticsBtn.addEventListener('click', () => {
    settings.haptics = !settings.haptics;
    saveJSON(SETTINGS_KEY, settings);
    syncControlsUI();
    vibrate(12);
    setToast(settings.haptics ? 'Haptics enabled.' : 'Haptics disabled.');
  });

  els.soundBtn.addEventListener('click', () => {
    settings.sound = !settings.sound;
    saveJSON(SETTINGS_KEY, settings);
    syncControlsUI();
    if(settings.sound) beep(520, 0.05, 0.03);
    setToast(settings.sound ? 'Sound enabled.' : 'Sound disabled.');
  });

  els.newGameBtn.addEventListener('click', () => {
    wipeBoardState();
    setToast('New game. Fresh containment cycle.');
    vibrate(14);
    beep(320, 0.05, 0.03);
  });

  els.wipeBtn.addEventListener('click', () => {
    wipeBoardState({keepTurn:true});
    setToast('Board wiped. Turn preserved.');
    vibrate([12,12]);
    beep(220, 0.05, 0.03);
  });

  els.undoBtn.addEventListener('click', undo);

  els.resetStatsBtn.addEventListener('click', () => {
    stats = structuredClone(DEFAULT_STATS);
    saveJSON(STATS_KEY, stats);
    updateStatsUI();
    setToast('Stats reset.');
    vibrate(14);
    beep(300, 0.05, 0.03);
  });

  els.p1Palette.addEventListener('click', () => openPicker(1));
  els.p2Palette.addEventListener('click', () => openPicker(2));

  els.pickerCloseBtn.addEventListener('click', closePicker);
  els.picker.addEventListener('click', (e) => {
    if(e.target === els.picker) closePicker();
  });

  els.replayBtn.addEventListener('click', () => {
    setOverlay(false);
    wipeBoardState();
  });
  els.closeBtn.addEventListener('click', () => setOverlay(false));

  window.addEventListener('keydown', (e) => {
    if(e.key >= '1' && e.key <= '7'){
      e.preventDefault();
      handleColumnClick(parseInt(e.key,10) - 1);
      return;
    }
    if(e.key.toLowerCase() === 'u'){
      e.preventDefault();
      undo();
      return;
    }
    if(e.key.toLowerCase() === 'r'){
      e.preventDefault();
      wipeBoardState();
      return;
    }
    if(e.key === 'Escape'){
      closePicker();
      setOverlay(false);
      return;
    }
  });
}

function init(){
  // sanity check settings
  settings.turnSeconds = clamp(parseInt(settings.turnSeconds, 10) || 10, 3, 30);
  const allPieces = new Set(ALL_PIECES);

  // migrate legacy settings (p1Set/p2Set) to new per-player character sprites
  if(!settings.p1Piece){
    const legacy = PIECE_SETS[settings.p1Set] ? settings.p1Set : 'green';
    settings.p1Piece = pickFromSet(legacy, 'happy');
  }
  if(!settings.p2Piece){
    const legacy = PIECE_SETS[settings.p2Set] ? settings.p2Set : 'magenta';
    settings.p2Piece = pickFromSet(legacy, 'happy');
  }

  if(!allPieces.has(settings.p1Piece)) settings.p1Piece = 'blob_green_happy.png';
  if(!allPieces.has(settings.p2Piece)) settings.p2Piece = 'blob_magenta_happy.png';

  // keep them distinct
  if(settings.p1Piece === settings.p2Piece){
    settings.p2Piece = settings.p1Piece === 'blob_magenta_happy.png' ? 'blob_green_happy.png' : 'blob_magenta_happy.png';
  }

  settings.p1Set = pieceColor(settings.p1Piece);
  settings.p2Set = pieceColor(settings.p2Piece);

  saveJSON(SETTINGS_KEY, settings);

  buildBoardDOM();
  bindUI();
  syncControlsUI();
  updateStatsUI();
  updateReadout();
  updateTopPills();

  wipeBoardState();
  setToast('Containment online. Inject specimens to start.');
}

init();
