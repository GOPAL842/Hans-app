// Game core: classes for Tile, Unit, Army, and Game engine
// Simple turn-based capture mechanics, level scaling up to 100

const DEFAULT_COLS = 10;
const DEFAULT_ROWS = 8;
const CAPTURE_THRESHOLD = 100;
const BASE_DEFENSE = 20;

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

class Tile {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.owner = 0; // 0 neutral, 1 armyA, 2 armyB
    this.defense = BASE_DEFENSE;
    this.captureProgress = 0;
  }
}

class Unit {
  constructor(id, owner, x, y, level = 1, type = 'infantry') {
    this.id = id;
    this.owner = owner;
    this.x = x; this.y = y;
    this.level = level;
    this.type = type;
    this.maxHp = 20 + level * 5;
    this.hp = this.maxHp;
    this.baseAtk = 6 + Math.floor(level * 1.5);
    this.baseDef = 3 + Math.floor(level * 1.2);
    // capture rate depends on unit type and level
    this.captureRate = type === 'scout' ? 8 + level : 4 + Math.floor(level * 0.8);
    this.moveRange = type === 'tank' ? 1 : 1;
  }
  isAlive() { return this.hp > 0; }
}

class Army {
  constructor(id, name, isAI = true) {
    this.id = id; this.name = name; this.isAI = isAI;
    this.units = [];
    this.basePos = null; // {x,y}
  }
  aliveUnits() { return this.units.filter(u => u.isAlive()); }
}

class Game {
  constructor(level = 1, cols = DEFAULT_COLS, rows = DEFAULT_ROWS) {
    this.level = Math.max(1, Math.min(level, 100));
    this.cols = cols; this.rows = rows;
    this.map = [];
    this.armies = [ new Army(1, 'Red', true), new Army(2, 'Blue', true) ];
    this.tileCount = cols * rows;
    this.turn = 0;
    this.maxTurns = 300 + Math.floor(this.level * 2);
    this.unitIdCounter = 1;
    this.log = [];
    this.initMap();
    this.placeBases();
    this.spawnUnitsForLevel();
  }

  initMap() {
    for (let y = 0; y < this.rows; y++) {
      this.map[y] = [];
      for (let x = 0; x < this.cols; x++) {
        this.map[y][x] = new Tile(x, y);
      }
    }
  }

  placeBases() {
    // Base A left-middle, Base B right-middle
    const aX = 0, aY = Math.floor(this.rows / 2);
    const bX = this.cols - 1, bY = Math.floor(this.rows / 2);
    this.armies[0].basePos = {x: aX, y: aY};
    this.armies[1].basePos = {x: bX, y: bY};
    // Give base tiles to respective armies and higher defense
    this.tileAt(aX, aY).owner = 1;
    this.tileAt(aX, aY).defense = BASE_DEFENSE + 30;
    this.tileAt(bX, bY).owner = 2;
    this.tileAt(bX, bY).defense = BASE_DEFENSE + 30;
  }

  spawnUnitsForLevel() {
    // Scale unit count and levels with game level
    // Every 20 levels increases unit count / unlocks types.
    const baseUnitCount = 3 + Math.floor(this.level / 15); // small scale
    // Army A (left)
    for (let i = 0; i < baseUnitCount; i++) {
      const type = i === 0 && this.level >= 10 ? 'scout' : (i === 1 && this.level >= 30 ? 'tank' : 'infantry');
      const u = new Unit(this.unitIdCounter++, 1, this.armies[0].basePos.x, this.armies[0].basePos.y, Math.max(1, Math.floor(this.level / 10)), type);
      this.armies[0].units.push(u);
    }
    // Army B (right)
    for (let i = 0; i < baseUnitCount; i++) {
      const type = i === 0 && this.level >= 10 ? 'scout' : (i === 1 && this.level >= 30 ? 'tank' : 'infantry');
      const u = new Unit(this.unitIdCounter++, 2, this.armies[1].basePos.x, this.armies[1].basePos.y, Math.max(1, Math.floor(this.level / 10)), type);
      this.armies[1].units.push(u);
    }
  }

  tileAt(x, y) { if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return null; return this.map[y][x]; }

  distance(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }

  neighbors(x,y) {
    const deltas = [[1,0],[-1,0],[0,1],[0,-1]];
    return deltas.map(d => this.tileAt(x+d[0], y+d[1])).filter(t => t);
  }

  run() {
    while (!this.isFinished() && this.turn < this.maxTurns) {
      this.turn++;
      this.takeTurn();
    }
    const result = this.result();
    this.log.unshift(`Level ${this.level} finished in ${this.turn} turns. Result: ${result}`);
    return { result, turns: this.turn, log: this.log };
  }

  takeTurn() {
    // Each army acts in order
    for (let army of this.armies) {
      // Shuffle order a bit for variety
      const units = army.aliveUnits();
      for (let unit of units) {
        if (!unit.isAlive()) continue;
        this.unitAction(unit);
      }
    }
    // small regen of tile defenses or capture progress decay
    this.postTurnUpdates();
  }

  unitAction(unit) {
    // 1) If adjacent to enemy unit -> attack
    const adjacentEnemies = this.findAdjacentEnemies(unit);
    if (adjacentEnemies.length) {
      const target = adjacentEnemies[0];
      this.resolveCombat(unit, target);
      return;
    }
    // 2) If on tile that is not owned -> attempt capture
    const tile = this.tileAt(unit.x, unit.y);
    if (tile && tile.owner !== unit.owner) {
      this.attemptCapture(unit, tile);
      return;
    }
    // 3) Move towards best target (nearest enemy or neutral)
    const target = this.findTargetTileFor(unit);
    if (target) {
      this.moveUnitTowards(unit, target);
    } else {
      // idle / random patrol
      const nb = this.neighbors(unit.x, unit.y);
      if (nb.length) {
        const t = nb[randInt(0, nb.length - 1)];
        unit.x = t.x; unit.y = t.y;
      }
    }
  }

  findAdjacentEnemies(unit) {
    const nbs = this.neighbors(unit.x, unit.y);
    const enemies = [];
    for (const t of nbs) {
      // check units at that tile
      for (const army of this.armies) {
        if (army.id === unit.owner) continue;
        for (const u of army.aliveUnits()) {
          if (u.x === t.x && u.y === t.y) enemies.push(u);
        }
      }
    }
    return enemies;
  }

  resolveCombat(attacker, defender) {
    const atk = attacker.baseAtk + randInt(-2,2) + Math.floor(attacker.level * 0.5);
    const def = defender.baseDef + Math.floor(defender.level * 0.4);
    let damage = Math.max(1, Math.round(atk - def * 0.6 + randInt(-1,1)));
    defender.hp -= damage;
    this.log.push(`Turn ${this.turn}: Unit ${attacker.id}(A${attacker.owner}) attacked Unit ${defender.id}(A${defender.owner}) for ${damage} dmg (defender hp=${Math.max(0, defender.hp)})`);
    if (defender.hp <= 0) {
      this.log.push(`Unit ${defender.id} destroyed.`);
      // possibility: capturing tile by attacker if defender died on it
      const tile = this.tileAt(defender.x, defender.y);
      if (tile && tile.owner !== attacker.owner) {
        tile.captureProgress += attacker.captureRate * 1.0;
        if (tile.captureProgress >= CAPTURE_THRESHOLD) {
          tile.owner = attacker.owner;
          tile.captureProgress = 0;
          this.log.push(`Tile (${tile.x},${tile.y}) captured by Army ${attacker.owner} after combat.`);
        }
      }
    }
  }

  attemptCapture(unit, tile) {
    const effective = unit.captureRate;
    tile.captureProgress += effective;
    this.log.push(`Turn ${this.turn}: Unit ${unit.id} attempts capture on (${tile.x},${tile.y}) +${effective.toFixed ? effective.toFixed(1) : effective} (progress ${Math.min(CAPTURE_THRESHOLD, tile.captureProgress)}/${CAPTURE_THRESHOLD})`);
    if (tile.captureProgress >= CAPTURE_THRESHOLD) {
      tile.owner = unit.owner;
      tile.captureProgress = 0;
      this.log.push(`Tile (${tile.x},${tile.y}) captured by Army ${unit.owner}.`);
    }
  }

  findTargetTileFor(unit) {
    // Prioritize: adjacent enemy units -> nearest enemy unit -> nearest neutral tile -> enemy base
    // Find nearest enemy unit
    let nearestEnemy = null, neDist = 1e9;
    for (const army of this.armies) {
      if (army.id === unit.owner) continue;
      for (const u of army.aliveUnits()) {
        const d = this.distance(unit, u);
        if (d < neDist) { neDist = d; nearestEnemy = u; }
      }
    }
    if (nearestEnemy) return {x: nearestEnemy.x, y: nearestEnemy.y};
    // else nearest neutral tile
    let nearestNeutral = null; let nnDist = 1e9;
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const tile = this.tileAt(x,y);
        if (tile.owner === 0) {
          const d = Math.abs(unit.x - x) + Math.abs(unit.y - y);
          if (d < nnDist) { nnDist = d; nearestNeutral = tile; }
        }
      }
    }
    if (nearestNeutral) return {x: nearestNeutral.x, y: nearestNeutral.y};
    // fallback: enemy base
    const enemyArmy = this.armies.find(a => a.id !== unit.owner);
    if (enemyArmy) return enemyArmy.basePos;
    return null;
  }

  moveUnitTowards(unit, target) {
    const dx = Math.sign(target.x - unit.x);
    const dy = Math.sign(target.y - unit.y);
    // simple move: prefer horizontal if distance greater
    if (Math.abs(target.x - unit.x) > Math.abs(target.y - unit.y)) {
      const nx = unit.x + dx, ny = unit.y;
      if (this.tileAt(nx, ny)) { unit.x = nx; unit.y = ny; return; }
    }
    const nx = unit.x, ny = unit.y + dy;
    if (this.tileAt(nx, ny)) { unit.x = nx; unit.y = ny; return; }
    // else try vertical/horizontal fallback
    const nx2 = unit.x + dx, ny2 = unit.y;
    if (this.tileAt(nx2, ny2)) { unit.x = nx2; unit.y = ny2; return; }
  }

  postTurnUpdates() {
    // small decay of captureProgress (defense reassert)
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const t = this.tileAt(x,y);
        if (t.captureProgress > 0) {
          t.captureProgress = Math.max(0, t.captureProgress - 0.5);
        }
      }
    }
  }

  isFinished() {
    // Victory if one army controls >50% of tiles or base captured or opponent has no units and no tiles
    for (const army of this.armies) {
      const tilesOwned = this.countTilesOwnedBy(army.id);
      if (tilesOwned > this.tileCount * 0.5) return true;
      // base captured?
      const enemy = this.armies.find(a => a.id !== army.id);
      const enemyBaseTile = this.tileAt(enemy.basePos.x, enemy.basePos.y);
      if (enemyBaseTile && enemyBaseTile.owner === army.id) return true;
    }
    // armies wiped
    if (this.armies[0].aliveUnits().length === 0 && this.armies[1].aliveUnits().length === 0) return true;
    if (this.armies[0].aliveUnits().length === 0 || this.armies[1].aliveUnits().length === 0) return true;
    return false;
  }

  countTilesOwnedBy(id) {
    let c = 0;
    for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) if (this.tileAt(x,y).owner === id) c++;
    return c;
  }

  result() {
    const a1 = this.countTilesOwnedBy(1);
    const a2 = this.countTilesOwnedBy(2);
    if (a1 === a2) {
      return 'Draw';
    }
    return a1 > a2 ? 'Army 1 (Red) wins' : 'Army 2 (Blue) wins';
  }

  // Debug / small ASCII map to print summary
  mapAscii() {
    let s = '';
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const t = this.tileAt(x,y);
        const unitHere = this.armies.flatMap(a => a.units).find(u => u.x === x && u.y === y && u.isAlive());
        if (unitHere) s += unitHere.owner === 1 ? 'R' : 'B';
        else s += t.owner === 0 ? '.' : (t.owner === 1 ? '1' : '2');
      }
      s += '\n';
    }
    return s;
  }
}

module.exports = { Game };