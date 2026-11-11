'use strict';
/* =====================================================================
   LITTLE GARDEN – Aventura no Jardim
   JavaScript puro (Vanilla JS) + Canvas 2D
   Organização do arquivo:
   1. Configurações   2. Elementos e estado   3. Som   4. Armazenamento
   5. Entrada (teclado/toque)   6. Criação de objetos   7. Atualização
   8. Desenho   9. Telas e estados   10. Inicialização
   ===================================================================== */

/* ---------- 1. CONFIGURAÇÕES ---------- */
const W = 800, H = 500;                       // tamanho lógico da área de jogo
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const KEYS = { high: 'littleGarden.highScore', sound: 'littleGarden.sound' };

const CFG = {
  startLives: 3,
  playerSpeed: 250,        // pixels por segundo
  playerRadius: 16,
  invulnTime: 1.6,         // segundos de invulnerabilidade após uma colisão
  shieldTime: 6,           // duração do power-up de proteção
  shieldFirstAt: 12,       // primeiro surgimento da flor especial (s)
  shieldEvery: 20,         // intervalo entre flores especiais (s)
  shieldLifetime: 10,      // tempo que a flor especial fica no jardim (s)
  levelEvery: 15,          // sobe 1 nível de dificuldade a cada 15 s
  phaseEvery: 30,          // muda de fase a cada 30 s
  spawnGrace: 0.7,         // inimigo recém-criado ainda não machuca (s)
  itemTarget: 4            // itens comuns presentes no jardim
};

// Itens coletáveis e pontuação de cada um
const ITEMS = {
  flower: { emoji: '🌸', points: 10, weight: 50 },
  berry:  { emoji: '🍓', points: 15, weight: 30 },
  star:   { emoji: '⭐', points: 25, weight: 20 },
  shield: { emoji: '🌺', points: 0,  weight: 0 }   // flor especial (power-up)
};

// Fases: cada uma muda as cores e os enfeites do cenário
const PHASES = [
  { name: 'Manhã de primavera', top: '#eafbf1', bot: '#c9f0dc', hill: '#b3e6ca', decor: ['🌷', '🌼', '🌳', '🌸'] },
  { name: 'Tarde dourada',      top: '#fff8dc', bot: '#ffe3d0', hill: '#f8e6a8', decor: ['🌻', '🦋', '🌼', '🌳'] },
  { name: 'Entardecer lilás',   top: '#fbe3f0', bot: '#e3d4fb', hill: '#d6c4f4', decor: ['🌷', '🍄', '🌿', '🪻'] },
  { name: 'Noite estrelada',    top: '#cfc6f0', bot: '#a9a3df', hill: '#8f95cf', decor: ['🍄', '🌙', '✨', '🌿'] }
];

// Conquistas simples (verificadas a cada quadro)
const ACHIEVEMENTS = [
  { id: 'flores', icon: '🌸', title: 'Florista',     text: 'Coletou 10 flores',     done: g => g.flowers >= 10 },
  { id: 'pontos', icon: '⭐', title: 'Estrelinha',   text: 'Alcançou 100 pontos',   done: g => g.score >= 100 },
  { id: 'tempo',  icon: '⏱️', title: 'Sobrevivente', text: 'Sobreviveu 60 segundos', done: g => g.time >= 60 },
  { id: 'escudo', icon: '🌺', title: 'Protegido',    text: 'Usou a flor de proteção', done: g => g.shieldsUsed >= 1 }
];

/* ---------- 2. ELEMENTOS E ESTADO ---------- */
const $ = id => document.getElementById(id);
const canvas = $('game');
const ctx = canvas.getContext('2d');

const screens = {
  menu: $('screen-menu'), how: $('screen-how'),
  pause: $('screen-pause'), over: $('screen-over')
};

let state = 'menu';        // 'menu' | 'playing' | 'paused' | 'gameover'
let game = null;           // dados temporários da partida atual
let rafId = 0;             // id do requestAnimationFrame (um único loop por vez)
let lastTime = 0;
let highScore = 0;
let soundOn = true;

/* ---------- utilidades ---------- */
const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hex2rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const rgb = a => `rgb(${a.map(Math.round).join(',')})`;
const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/* ---------- 3. SOM (Web Audio, sem arquivos externos) ---------- */
let audioCtx = null;

function tone(freq, dur, type = 'sine', vol = 0.07, delay = 0, slideTo = null) {
  if (!soundOn) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t0 = audioCtx.currentTime + delay;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  } catch (e) { /* áudio indisponível: o jogo segue normalmente */ }
}

const SOUNDS = {
  collect:  () => { tone(660, 0.1, 'sine'); tone(990, 0.14, 'sine', 0.07, 0.08); },
  star:     () => { tone(784, 0.1, 'triangle'); tone(1175, 0.2, 'triangle', 0.07, 0.09); },
  power:    () => { tone(440, 0.4, 'sine', 0.08, 0, 1100); },
  hit:      () => { tone(260, 0.3, 'sawtooth', 0.06, 0, 90); },
  achieve:  () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'triangle', 0.07, i * 0.09)); },
  gameover: () => { [440, 349, 294, 220].forEach((f, i) => tone(f, 0.3, 'sine', 0.08, i * 0.18)); },
  phase:    () => { tone(587, 0.15, 'sine'); tone(880, 0.3, 'sine', 0.07, 0.12); }
};

function updateSoundButtons() {
  $('btn-sound').textContent = soundOn ? '🔊' : '🔇';
  $('btn-sound-menu').textContent = soundOn ? '🔊 Som ligado' : '🔇 Som desligado';
}

function toggleSound() {
  soundOn = !soundOn;
  try { localStorage.setItem(KEYS.sound, soundOn ? '1' : '0'); } catch (e) {}
  updateSoundButtons();
  if (soundOn) SOUNDS.collect();
}

/* ---------- 4. ARMAZENAMENTO (LocalStorage) ---------- */
function loadHighScore() {
  try { return parseInt(localStorage.getItem(KEYS.high), 10) || 0; } catch (e) { return 0; }
}
function saveHighScore(value) {
  try { localStorage.setItem(KEYS.high, String(value)); } catch (e) {}
}

/* ---------- 5. ENTRADA (teclado e toque) ---------- */
const keyboard = { up: false, down: false, left: false, right: false };
const touch = { up: false, down: false, left: false, right: false };
const KEYMAP = {
  ArrowUp: 'up', w: 'up', W: 'up',
  ArrowDown: 'down', s: 'down', S: 'down',
  ArrowLeft: 'left', a: 'left', A: 'left',
  ArrowRight: 'right', d: 'right', D: 'right'
};

function clearInput() {
  for (const k in keyboard) { keyboard[k] = false; touch[k] = false; }
  document.querySelectorAll('.pad.on').forEach(b => b.classList.remove('on'));
}

function onKeyDown(e) {
  const dir = KEYMAP[e.key];
  if (dir) {
    keyboard[dir] = true;
    if (state === 'playing') e.preventDefault();   // evita rolar a página com as setas
    return;
  }
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
    if (!screens.how.classList.contains('hidden')) showScreen('menu');
    else togglePause();
  }
}
function onKeyUp(e) {
  const dir = KEYMAP[e.key];
  if (dir) keyboard[dir] = false;
}

function bindTouchControls() {
  document.querySelectorAll('.pad').forEach(btn => {
    const dir = btn.dataset.dir;
    const press = e => { e.preventDefault(); touch[dir] = true; btn.classList.add('on'); };
    const release = () => { touch[dir] = false; btn.classList.remove('on'); };
    btn.addEventListener('pointerdown', press);
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => btn.addEventListener(ev, release));
    btn.addEventListener('contextmenu', e => e.preventDefault());
  });
}

/* ---------- 6. CRIAÇÃO DE OBJETOS ---------- */
// Cria os dados novos de uma partida (reinício completo: nada da anterior sobra)
function createGame() {
  const first = PHASES[0];
  return {
    time: 0, score: 0, lives: CFG.startLives,
    level: 1, phase: 0,
    flowers: 0, shieldsUsed: 0,
    invuln: 0, shield: 0, shake: 0,
    player: { x: W / 2, y: H / 2, r: CFG.playerRadius },
    enemies: [], items: [], texts: [], unlocked: [],
    spawnTimer: 1.5,
    shieldTimer: CFG.shieldFirstAt,
    theme: { top: hex2rgb(first.top), bot: hex2rgb(first.bot), hill: hex2rgb(first.hill) },
    // posições fixas dos enfeites do jardim
    decor: Array.from({ length: 14 }, () => ({ x: rand(30, W - 30), y: rand(40, H - 30), s: rand(26, 42) })),
    stars: Array.from({ length: 30 }, () => ({ x: rand(0, W), y: rand(0, H * 0.7), p: rand(0, 6) }))
  };
}

// Posição aleatória válida (sempre dentro da área e longe de um ponto)
function randomPos(margin, avoid, minDist) {
  let p;
  for (let i = 0; i < 25; i++) {
    p = { x: rand(margin, W - margin), y: rand(margin, H - margin) };
    if (!avoid || dist(p, avoid) >= minDist) break;
  }
  return p;
}

function difficulty(g) {
  return {
    speed: Math.min(1 + 0.1 * (g.level - 1), 2.5),              // inimigos ficam mais rápidos
    interval: Math.max(0.8, 2.8 - 0.25 * (g.level - 1)),        // surgem com mais frequência
    max: Math.min(4 + g.level * 2, 16)                          // limite de inimigos na tela
  };
}

function spawnEnemy() {
  const g = game, d = difficulty(g);
  if (g.enemies.length >= d.max) return;
  const types = ['bee'];
  if (g.level >= 2) types.push('ladybug');
  if (g.level >= 3) types.push('caterpillar');
  const type = pick(types);
  const e = { type, r: 15, age: 0, life: 16, vx: 0, vy: 0, turn: 0 };

  if (type === 'bee') {                       // comportamento 1: movimento aleatório
    Object.assign(e, randomPos(40, g.player, 170), { emoji: '🐝', speed: 95 * d.speed });
  } else if (type === 'ladybug') {            // comportamento 2: perseguição ao jogador
    const side = pick([[0, rand(0, H)], [W, rand(0, H)], [rand(0, W), 0], [rand(0, W), H]]);
    Object.assign(e, { x: side[0], y: side[1], emoji: '🐞', speed: 72 * d.speed });
  } else {                                    // comportamento 3: linha reta de um lado ao outro
    const fromLeft = Math.random() < 0.5;
    Object.assign(e, {
      x: fromLeft ? -30 : W + 30, y: rand(40, H - 40), emoji: '🐛', life: Infinity,
      vx: (fromLeft ? 1 : -1) * 120 * d.speed, vy: 0
    });
  }
  g.enemies.push(e);
}

function pickItemType() {
  const pool = Object.entries(ITEMS).filter(([, v]) => v.weight > 0);
  let roll = rand(0, pool.reduce((s, [, v]) => s + v.weight, 0));
  for (const [key, v] of pool) { roll -= v.weight; if (roll <= 0) return key; }
  return 'flower';
}

function spawnItem(type) {
  const g = game;
  const pos = randomPos(34, g.player, 90);
  g.items.push({ type, x: pos.x, y: pos.y, r: 18, age: 0, life: type === 'shield' ? CFG.shieldLifetime : Infinity });
}

function addText(x, y, text) { game.texts.push({ x, y, text, t: 0 }); }

function showToast(html, extraClass = '') {
  const el = document.createElement('div');
  el.className = `toast ${extraClass}`;
  el.innerHTML = html;
  $('toasts').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

/* ---------- 7. ATUALIZAÇÃO ---------- */
function update(dt) {
  const g = game, p = g.player;
  g.time += dt;

  // Nível (dificuldade) e fase (cenário) a partir do tempo
  g.level = 1 + Math.floor(g.time / CFG.levelEvery);
  const newPhase = Math.min(Math.floor(g.time / CFG.phaseEvery), PHASES.length - 1);
  if (newPhase !== g.phase) {
    g.phase = newPhase;
    showToast(`🌈 Fase ${g.phase + 1}: ${PHASES[g.phase].name}`, 'phase');
    SOUNDS.phase();
  }
  // Transição gradual das cores do cenário
  const target = PHASES[g.phase], k = Math.min(1, dt * 1.5);
  ['top', 'bot', 'hill'].forEach(key => {
    const goal = hex2rgb(target[key]);
    g.theme[key] = g.theme[key].map((v, i) => v + (goal[i] - v) * k);
  });

  // Temporizadores de efeitos
  g.invuln = Math.max(0, g.invuln - dt);
  g.shield = Math.max(0, g.shield - dt);
  g.shake = Math.max(0, g.shake - dt);

  // Movimentação do coelhinho (WASD, setas e botões de toque)
  const dx = (keyboard.right || touch.right ? 1 : 0) - (keyboard.left || touch.left ? 1 : 0);
  const dy = (keyboard.down || touch.down ? 1 : 0) - (keyboard.up || touch.up ? 1 : 0);
  if (dx || dy) {
    const len = Math.hypot(dx, dy);                       // normaliza a diagonal
    p.x += (dx / len) * CFG.playerSpeed * dt;
    p.y += (dy / len) * CFG.playerSpeed * dt;
  }
  p.x = clamp(p.x, p.r, W - p.r);                         // limites da área
  p.y = clamp(p.y, p.r, H - p.r);

  // Surgimento de inimigos (intervalo diminui com o nível)
  g.spawnTimer -= dt;
  if (g.spawnTimer <= 0) { spawnEnemy(); g.spawnTimer = difficulty(g).interval; }
  updateEnemies(dt);

  // Flor especial (power-up de proteção)
  g.shieldTimer -= dt;
  if (g.shieldTimer <= 0) {
    if (!g.items.some(i => i.type === 'shield')) spawnItem('shield');
    g.shieldTimer = CFG.shieldEvery;
  }

  updateItems(dt);
  checkCollisions();
  checkAchievements();

  g.texts.forEach(t => { t.t += dt; t.y -= 30 * dt; });
  g.texts = g.texts.filter(t => t.t < 0.9);
}

function updateEnemies(dt) {
  const g = game, p = g.player;
  for (const e of g.enemies) {
    e.age += dt;
    if (e.type === 'bee') {
      e.turn -= dt;
      if (e.turn <= 0) {                                   // muda de direção de vez em quando
        const a = rand(0, Math.PI * 2);
        e.vx = Math.cos(a) * e.speed; e.vy = Math.sin(a) * e.speed;
        e.turn = rand(0.6, 1.4);
      }
    } else if (e.type === 'ladybug') {
      const d = Math.max(1, dist(e, p));
      e.vx = ((p.x - e.x) / d) * e.speed;                  // persegue o jogador
      e.vy = ((p.y - e.y) / d) * e.speed;
    }
    e.x += e.vx * dt; e.y += e.vy * dt;

    if (e.type !== 'caterpillar') {                        // abelhas/joaninhas ficam na área
      if (e.x < e.r || e.x > W - e.r) { e.vx *= -1; e.x = clamp(e.x, e.r, W - e.r); }
      if (e.y < e.r || e.y > H - e.r) { e.vy *= -1; e.y = clamp(e.y, e.r, H - e.r); }
    }
    e.life -= dt;
  }
  // Remove inimigos que expiraram ou que a lagarta já atravessou
  g.enemies = g.enemies.filter(e => e.life > 0 && e.x > -70 && e.x < W + 70);
}

function updateItems(dt) {
  const g = game, p = g.player;
  for (const it of g.items) it.age += dt;
  g.items = g.items.filter(it => it.age < it.life);        // flor especial some se ninguém pegar

  for (const it of [...g.items]) {
    if (dist(p, it) > p.r + it.r) continue;
    g.items.splice(g.items.indexOf(it), 1);

    if (it.type === 'shield') {
      g.shield = CFG.shieldTime; g.shieldsUsed++;
      addText(it.x, it.y, '🛡️ Proteção!');
      SOUNDS.power();
    } else {
      const pts = ITEMS[it.type].points;
      g.score += pts;                                      // pontuação atualizada na hora
      if (it.type === 'flower') g.flowers++;
      addText(it.x, it.y, `+${pts}`);
      (it.type === 'star' ? SOUNDS.star : SOUNDS.collect)();
      spawnItem(pickItemType());                           // novo item em posição válida
    }
  }
}

function checkCollisions() {
  const g = game, p = g.player;
  if (g.invuln > 0 || g.shield > 0) return;                // protegido: ignora colisões
  for (const e of g.enemies) {
    if (e.age < CFG.spawnGrace) continue;
    if (dist(p, e) < (p.r + e.r) * 0.8) {                  // hitbox um pouco menor = mais justo
      g.lives--;
      g.invuln = CFG.invulnTime;
      g.shake = 0.3;
      addText(p.x, p.y - 20, '-1 ❤️');
      SOUNDS.hit();
      if (g.lives <= 0) gameOver();
      return;                                              // no máximo uma vida por quadro
    }
  }
}

function checkAchievements() {
  const g = game;
  for (const a of ACHIEVEMENTS) {
    if (g.unlocked.includes(a.id) || !a.done(g)) continue;
    g.unlocked.push(a.id);
    showToast(`${a.icon} Conquista: ${a.title}! <small>${a.text}</small>`);
    SOUNDS.achieve();
  }
}

/* ---------- 8. DESENHO ---------- */
function drawEmoji(emoji, x, y, size, alpha = 1, flip = false) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  ctx.font = `${size}px ${EMOJI_FONT}`;
  ctx.fillText(emoji, 0, 0);
  ctx.restore();
}

function draw() {
  const g = game, p = g.player;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (g.shake > 0) ctx.translate(rand(-4, 4), rand(-4, 4));   // tremidinha ao tomar dano

  // céu
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, rgb(g.theme.top));
  sky.addColorStop(1, rgb(g.theme.bot));
  ctx.fillStyle = sky;
  ctx.fillRect(-10, -10, W + 20, H + 20);

  // estrelinhas piscando na fase da noite
  if (g.phase === 3) {
    ctx.fillStyle = '#fffbe0';
    g.stars.forEach(s => {
      ctx.globalAlpha = 0.4 + 0.5 * Math.abs(Math.sin(g.time * 2 + s.p));
      ctx.beginPath(); ctx.arc(s.x, s.y, 2, 0, 7); ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  // colinas macias
  ctx.fillStyle = rgb(g.theme.hill);
  ctx.beginPath(); ctx.ellipse(160, H + 50, 360, 120, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(640, H + 60, 420, 130, 0, 0, 7); ctx.fill();

  // enfeites (mudam a cada fase)
  const glyphs = PHASES[g.phase].decor;
  g.decor.forEach((d, i) => drawEmoji(glyphs[i % glyphs.length], d.x, d.y, d.s, 0.5));

  // itens
  g.items.forEach(it => {
    const bob = Math.sin(g.time * 4 + it.x) * 3;
    if (it.type === 'shield') {                            // brilho dourado na flor especial
      ctx.fillStyle = `rgba(255,236,150,${0.5 + 0.3 * Math.sin(g.time * 6)})`;
      ctx.beginPath(); ctx.arc(it.x, it.y + bob, 26, 0, 7); ctx.fill();
    }
    const fade = it.life === Infinity || it.life - it.age > 2 ? 1 : (Math.floor(g.time * 8) % 2 ? 1 : 0.35);
    drawEmoji(ITEMS[it.type].emoji, it.x, it.y + bob, 32, fade);
  });

  // inimigos
  g.enemies.forEach(e => {
    const grow = Math.min(1, e.age / CFG.spawnGrace);      // aparece "crescendo"
    const leave = e.life < 1 ? Math.max(0, e.life) : 1;    // some suavemente no fim da vida
    drawEmoji(e.emoji, e.x, e.y, 34 * grow * (0.4 + 0.6 * leave), grow * leave, e.vx > 0);
  });

  // coelhinho
  if (g.shield > 0) {
    ctx.strokeStyle = `rgba(255,214,90,${0.6 + 0.3 * Math.sin(g.time * 8)})`;
    ctx.fillStyle = 'rgba(255,242,179,0.45)';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(p.x, p.y, 30, 0, 7); ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(107,79,110,0.15)';                 // sombrinha
  ctx.beginPath(); ctx.ellipse(p.x, p.y + 22, 16, 5, 0, 0, 7); ctx.fill();
  drawEmoji('🐻', p.x, p.y, 52, 1);

  // textos flutuantes (+10, -1 vida...)
  g.texts.forEach(t => {
    ctx.save();
    ctx.globalAlpha = 1 - t.t / 0.9;
    ctx.font = `600 20px ${EMOJI_FONT}`;
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,248,236,0.95)';
    ctx.strokeText(t.text, t.x, t.y - 22);
    ctx.fillStyle = '#6b4f6e';
    ctx.fillText(t.text, t.x, t.y - 22);
    ctx.restore();
  });
  ctx.restore();
}

/* ---------- HUD ---------- */
function setText(id, value) {
  const el = $(id);
  if (el._v !== value) { el._v = value; el.textContent = value; }   // só mexe no DOM se mudou
}

function updateHud() {
  const g = game;
  setText('hud-score', String(g.score));
  setText('hud-lives', '❤️'.repeat(Math.max(0, g.lives)) + '🤍'.repeat(CFG.startLives - Math.max(0, g.lives)));
  setText('hud-time', fmtTime(g.time));
  setText('hud-level', String(g.level));
  setText('hud-phase', String(g.phase + 1));
  $('hud-shield').classList.toggle('hidden', g.shield <= 0);
  setText('hud-shield-time', `${Math.ceil(g.shield)}s`);
}

/* ---------- 9. TELAS E ESTADOS ---------- */
function showScreen(name) {
  Object.entries(screens).forEach(([key, el]) => el.classList.toggle('hidden', key !== name));
}

function setState(next) {
  state = next;
  if (next !== 'playing') cancelAnimationFrame(rafId);     // nada roda em pausa/menu/game over
  $('btn-pause').disabled = next !== 'playing';
}

function loop(now) {
  if (state !== 'playing') return;
  rafId = requestAnimationFrame(loop);
  const dt = Math.min((now - lastTime) / 1000, 0.05);      // limita saltos grandes de tempo
  lastTime = now;
  update(dt);
  if (state === 'playing' || state === 'gameover') { draw(); updateHud(); }
}

function startLoop() {
  cancelAnimationFrame(rafId);                             // garante um único loop ativo
  lastTime = performance.now();
  rafId = requestAnimationFrame(loop);
}

// Começa uma partida do zero (usado por Jogar, Reiniciar e Jogar novamente)
function startGame() {
  cancelAnimationFrame(rafId);
  clearInput();
  $('toasts').innerHTML = '';
  game = createGame();
  for (let i = 0; i < CFG.itemTarget; i++) spawnItem(pickItemType());
  spawnEnemy(); spawnEnemy();
  showScreen(null);
  setState('playing');
  draw(); updateHud();
  startLoop();
}

function togglePause() {
  if (state === 'playing') {
    setState('paused');
    clearInput();
    showScreen('pause');
  } else if (state === 'paused') {
    showScreen(null);
    setState('playing');
    startLoop();
  }
}

function goToMenu() {
  setState('menu');
  clearInput();
  $('toasts').innerHTML = '';
  game = createGame();                                     // cenário calmo ao fundo do menu
  draw(); updateHud();
  $('menu-record').textContent = highScore;
  showScreen('menu');
}

function gameOver() {
  setState('gameover');
  clearInput();
  const g = game;
  const isNew = g.score > highScore;                       // só salva se superar o recorde
  if (isNew) { highScore = g.score; saveHighScore(highScore); }
  SOUNDS.gameover();

  $('over-score').textContent = g.score;
  $('over-record').textContent = highScore;
  $('over-new').classList.toggle('hidden', !isNew);
  $('over-stats').textContent = `Você sobreviveu ${fmtTime(g.time)} e chegou ao nível ${g.level}.`;
  const ach = ACHIEVEMENTS.filter(a => g.unlocked.includes(a.id));
  $('over-ach').classList.toggle('hidden', ach.length === 0);
  $('over-ach').textContent = ach.length ? 'Conquistas: ' + ach.map(a => `${a.icon} ${a.title}`).join(' · ') : '';
  showScreen('over');
}

/* ---------- 10. INICIALIZAÇÃO (eventos registrados uma única vez) ---------- */
function init() {
  highScore = loadHighScore();
  try { soundOn = localStorage.getItem(KEYS.sound) !== '0'; } catch (e) {}
  updateSoundButtons();
  bindTouchControls();

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', clearInput);
  document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'playing') togglePause(); });

  $('btn-play').addEventListener('click', startGame);
  $('btn-how').addEventListener('click', () => showScreen('how'));
  $('btn-how-back').addEventListener('click', () => showScreen('menu'));
  $('btn-pause').addEventListener('click', togglePause);
  $('btn-resume').addEventListener('click', togglePause);
  $('btn-restart').addEventListener('click', startGame);
  $('btn-pause-menu').addEventListener('click', goToMenu);
  $('btn-again').addEventListener('click', startGame);
  $('btn-over-menu').addEventListener('click', goToMenu);
  $('btn-sound').addEventListener('click', toggleSound);
  $('btn-sound-menu').addEventListener('click', toggleSound);

  goToMenu();
}

init();
