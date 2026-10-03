export const GRID_SIZE = 13;
export const BOMB_FUSE_TICKS = 90;
export const EXPLOSION_TICKS = 18;

const STARTS = [
  { x: 1, y: 1 },
  { x: GRID_SIZE - 2, y: GRID_SIZE - 2 },
  { x: GRID_SIZE - 2, y: 1 },
  { x: 1, y: GRID_SIZE - 2 },
];

export function createGame({ players = 2, random = Math.random } = {}) {
  const count = clamp(Math.trunc(players), 2, 4);
  const blocks = [];

  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      if (x === 0 || y === 0 || x === GRID_SIZE - 1 || y === GRID_SIZE - 1 || (x % 2 === 0 && y % 2 === 0)) {
        blocks.push({ x, y, type: 'solid' });
      } else if (!isSpawnSafe(x, y) && random() < 0.62) {
        blocks.push({ x, y, type: 'breakable' });
      }
    }
  }

  const game = {
    width: GRID_SIZE,
    height: GRID_SIZE,
    tick: 0,
    players: STARTS.slice(0, count).map((start, id) => ({
      id,
      x: start.x,
      y: start.y,
      alive: true,
      bombLimit: 1,
      blastRange: 2,
      score: 0,
    })),
    blocks,
    bombs: [],
    explosions: [],
    upgrades: [],
    winnerId: null,
  };

  return game;
}

export function movePlayer(game, playerId, { dx = 0, dy = 0 }) {
  const next = cloneGame(game);
  const player = next.players[playerId];
  if (!player || !player.alive) return next;

  const target = { x: player.x + Math.sign(dx), y: player.y + Math.sign(dy) };
  if (isBlocked(next, target.x, target.y)) return next;

  player.x = target.x;
  player.y = target.y;
  collectUpgrade(next, player);
  return next;
}

export function dropBomb(game, playerId) {
  const next = cloneGame(game);
  const player = next.players[playerId];
  if (!player || !player.alive) return next;

  const activeOwnedBombs = next.bombs.filter((bomb) => bomb.ownerId === player.id).length;
  if (activeOwnedBombs >= player.bombLimit) return next;
  if (next.bombs.some((bomb) => bomb.x === player.x && bomb.y === player.y)) return next;

  next.bombs.push({
    x: player.x,
    y: player.y,
    ownerId: player.id,
    fuse: BOMB_FUSE_TICKS,
    range: player.blastRange,
  });
  return next;
}

export function tickGame(game, { random = Math.random } = {}) {
  const next = cloneGame(game);
  next.tick += 1;
  next.explosions = next.explosions
    .map((explosion) => ({ ...explosion, ttl: (explosion.ttl ?? EXPLOSION_TICKS) - 1 }))
    .filter((explosion) => explosion.ttl > 0);

  const remainingBombs = [];
  const explodingBombs = [];
  for (const bomb of next.bombs) {
    const timed = { ...bomb, fuse: bomb.fuse - 1 };
    if (timed.fuse <= 0) explodingBombs.push(timed);
    else remainingBombs.push(timed);
  }
  next.bombs = remainingBombs;

  for (const bomb of explodingBombs) {
    explodeBomb(next, bomb, random);
  }

  applyExplosionDamage(next);
  next.winnerId = getWinnerId(next.players);
  return next;
}

export function isBlocked(game, x, y) {
  return Boolean(
    game.blocks.some((block) => block.x === x && block.y === y) ||
    game.bombs.some((bomb) => bomb.x === x && bomb.y === y)
  );
}

export function explodeBomb(game, bomb, random = Math.random) {
  const cells = buildExplosionCells(game, bomb);
  game.explosions.push(...cells.map((cell) => ({ ...cell, ttl: EXPLOSION_TICKS })));

  const destroyed = new Set();
  for (const cell of cells) {
    const blockIndex = game.blocks.findIndex((block) => block.type === 'breakable' && block.x === cell.x && block.y === cell.y);
    if (blockIndex >= 0) {
      const [block] = game.blocks.splice(blockIndex, 1);
      destroyed.add(`${block.x},${block.y}`);
      maybeDropUpgrade(game, block.x, block.y, random);
    }
  }

  const owner = game.players[bomb.ownerId];
  if (owner) owner.score += destroyed.size * 10;

  const chained = game.bombs.filter((other) => cells.some((cell) => cell.x === other.x && cell.y === other.y));
  game.bombs = game.bombs.filter((other) => !chained.includes(other));
  for (const other of chained) explodeBomb(game, other, random);
}

export function buildExplosionCells(game, bomb) {
  const cells = [{ x: bomb.x, y: bomb.y }];
  const directions = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];

  for (const { dx, dy } of directions) {
    for (let step = 1; step <= bomb.range; step += 1) {
      const x = bomb.x + dx * step;
      const y = bomb.y + dy * step;
      const block = game.blocks.find((candidate) => candidate.x === x && candidate.y === y);
      if (block?.type === 'solid') break;
      cells.push({ x, y });
      if (block?.type === 'breakable') break;
    }
  }

  return cells;
}

function collectUpgrade(game, player) {
  const index = game.upgrades.findIndex((upgrade) => upgrade.x === player.x && upgrade.y === player.y);
  if (index < 0) return;
  const [upgrade] = game.upgrades.splice(index, 1);
  if (upgrade.type === 'bomb-limit') player.bombLimit = Math.min(8, player.bombLimit + 1);
  if (upgrade.type === 'blast-range') player.blastRange = Math.min(8, player.blastRange + 1);
}

function maybeDropUpgrade(game, x, y, random) {
  if (random() > 0.35) return;
  game.upgrades.push({
    x,
    y,
    type: random() < 0.5 ? 'bomb-limit' : 'blast-range',
  });
}

function applyExplosionDamage(game) {
  const liveCells = game.explosions.filter((cell) => (cell.ttl ?? EXPLOSION_TICKS) > 0);
  for (const player of game.players) {
    if (!player.alive) continue;
    if (liveCells.some((cell) => cell.x === player.x && cell.y === player.y)) {
      player.alive = false;
    }
  }
}

function getWinnerId(players) {
  const alive = players.filter((player) => player.alive);
  return alive.length === 1 ? alive[0].id : null;
}

function isSpawnSafe(x, y) {
  return STARTS.some((start) => Math.abs(start.x - x) + Math.abs(start.y - y) <= 2);
}

function cloneGame(game) {
  return {
    ...game,
    players: game.players.map((player) => ({ ...player })),
    blocks: game.blocks.map((block) => ({ ...block })),
    bombs: game.bombs.map((bomb) => ({ ...bomb })),
    explosions: game.explosions.map((explosion) => ({ ...explosion })),
    upgrades: game.upgrades.map((upgrade) => ({ ...upgrade })),
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
