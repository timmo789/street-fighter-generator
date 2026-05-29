(() => {
  "use strict";

  const canvas = document.querySelector("#game");
  const ctx = canvas.getContext("2d", { alpha: false });

  const ui = {
    overlay: document.querySelector("#overlay"),
    overlayTitle: document.querySelector("#overlayTitle"),
    overlayText: document.querySelector("#overlayText"),
    startBtn: document.querySelector("#startBtn"),
    rerollBtn: document.querySelector("#rerollBtn"),
    rerollTop: document.querySelector("#rerollTop"),
    pauseBtn: document.querySelector("#pauseBtn"),
    playerName: document.querySelector("#playerName"),
    enemyName: document.querySelector("#enemyName"),
    playerHp: document.querySelector("#playerHp"),
    enemyHp: document.querySelector("#enemyHp"),
    playerEnergy: document.querySelector("#playerEnergy"),
    enemyEnergy: document.querySelector("#enemyEnergy"),
    roundLabel: document.querySelector("#roundLabel"),
    timer: document.querySelector("#timer"),
  };

  const VIEW = {
    width: 960,
    height: 540,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  };

  const WORLD = {
    width: 1680,
    height: 540,
    groundY: 426,
  };

  const SPRITE = {
    width: 190,
    height: 194,
    pivotX: 95,
    pivotY: 176,
  };

  const TAU = Math.PI * 2;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const randBetween = (rng, min, max) => min + (max - min) * rng();

  const input = {
    left: false,
    right: false,
    block: false,
  };

  const game = {
    mode: "ready",
    round: 1,
    timer: 99,
    cameraX: 0,
    shake: 0,
    lastTime: 0,
    particles: [],
    hitMarks: [],
    ai: {
      cooldown: 0.6,
      blockFor: 0,
      strafeFor: 0,
      strafeDir: 0,
    },
  };

  let dpr = 1;
  let player;
  let enemy;

  const attacks = {
    punch: {
      duration: 0.34,
      activeStart: 0.1,
      activeEnd: 0.2,
      damage: 8,
      reach: 72,
      height: 86,
      yOffset: -110,
      knockback: 260,
      gain: 14,
      cost: 0,
    },
    kick: {
      duration: 0.48,
      activeStart: 0.16,
      activeEnd: 0.31,
      damage: 12,
      reach: 96,
      height: 72,
      yOffset: -88,
      knockback: 340,
      gain: 18,
      cost: 0,
    },
    special: {
      duration: 0.72,
      activeStart: 0.23,
      activeEnd: 0.48,
      damage: 20,
      reach: 138,
      height: 112,
      yOffset: -104,
      knockback: 520,
      gain: 4,
      cost: 38,
    },
  };

  const keyboardMap = new Map([
    ["ArrowLeft", "left"],
    ["a", "left"],
    ["A", "left"],
    ["ArrowRight", "right"],
    ["d", "right"],
    ["D", "right"],
    ["ArrowDown", "block"],
    ["Shift", "block"],
    ["s", "block"],
    ["S", "block"],
  ]);

  const attackKeys = new Map([
    ["j", "punch"],
    ["J", "punch"],
    ["k", "kick"],
    ["K", "kick"],
    ["l", "special"],
    ["L", "special"],
    [" ", "special"],
  ]);

  const palettes = [
    {
      skin: "#f0b083",
      hair: "#1e1413",
      jacket: "#eb4d5c",
      pants: "#18394d",
      trim: "#ffd166",
      glove: "#f6f3e8",
      boot: "#191c22",
      aura: "#34cbd4",
    },
    {
      skin: "#9e6c4d",
      hair: "#f0d8a6",
      jacket: "#2ab07f",
      pants: "#37265f",
      trim: "#ff8a5b",
      glove: "#151923",
      boot: "#f1c453",
      aura: "#ff4f59",
    },
    {
      skin: "#d28c67",
      hair: "#2f2118",
      jacket: "#3f88c5",
      pants: "#242834",
      trim: "#80ed99",
      glove: "#ffdf76",
      boot: "#11131a",
      aura: "#7b61ff",
    },
    {
      skin: "#6d493b",
      hair: "#101216",
      jacket: "#f6a03f",
      pants: "#165f5c",
      trim: "#f7f0df",
      glove: "#bb3e57",
      boot: "#2f243a",
      aura: "#ffc857",
    },
    {
      skin: "#efc2a3",
      hair: "#b43b5f",
      jacket: "#6bd2d6",
      pants: "#473f3b",
      trim: "#feef6d",
      glove: "#11131a",
      boot: "#e85d75",
      aura: "#58d68d",
    },
  ];

  const nameLeft = ["岚", "赤", "云", "隼", "镜", "青", "曜", "夏", "星", "霆"];
  const nameRight = ["拳", "刃", "步", "影", "焰", "潮", "甲", "闪", "极", "锋"];
  const titlePool = ["巷战新星", "擂台浪人", "夜市冠军", "街角武者", "风暴门徒"];

  function mulberry32(seed) {
    let t = seed >>> 0;
    return () => {
      t += 0x6d2b79f5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pick(rng, list) {
    return list[Math.floor(rng() * list.length)];
  }

  function shade(hex, amount) {
    const raw = hex.replace("#", "");
    const num = parseInt(raw, 16);
    const r = clamp((num >> 16) + amount, 0, 255);
    const g = clamp(((num >> 8) & 255) + amount, 0, 255);
    const b = clamp((num & 255) + amount, 0, 255);
    return `rgb(${r}, ${g}, ${b})`;
  }

  function makeFighterStyle(seed, side) {
    const rng = mulberry32(seed);
    const palette = { ...pick(rng, palettes) };
    const style = {
      seed,
      side,
      palette,
      name: `${pick(rng, nameLeft)}${pick(rng, nameRight)}`,
      title: pick(rng, titlePool),
      bodyWidth: randBetween(rng, 0.9, 1.08),
      bodyHeight: randBetween(rng, 0.94, 1.08),
      hair: Math.floor(randBetween(rng, 0, 4)),
      collar: rng() > 0.42,
      mask: rng() > 0.5,
      stripe: rng() > 0.38,
      shoulder: rng() > 0.55,
      stance: randBetween(rng, -3, 3),
    };

    if (side === "enemy") {
      [style.palette.jacket, style.palette.pants] = [style.palette.pants, style.palette.jacket];
    }

    return style;
  }

  function roundedRect(pathCtx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    pathCtx.beginPath();
    pathCtx.moveTo(x + r, y);
    pathCtx.lineTo(x + width - r, y);
    pathCtx.quadraticCurveTo(x + width, y, x + width, y + r);
    pathCtx.lineTo(x + width, y + height - r);
    pathCtx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    pathCtx.lineTo(x + r, y + height);
    pathCtx.quadraticCurveTo(x, y + height, x, y + height - r);
    pathCtx.lineTo(x, y + r);
    pathCtx.quadraticCurveTo(x, y, x + r, y);
    pathCtx.closePath();
  }

  function drawCapsule(pathCtx, a, b, width, color) {
    pathCtx.save();
    pathCtx.strokeStyle = color;
    pathCtx.lineWidth = width;
    pathCtx.lineCap = "round";
    pathCtx.lineJoin = "round";
    pathCtx.beginPath();
    pathCtx.moveTo(a.x, a.y);
    pathCtx.lineTo(b.x, b.y);
    pathCtx.stroke();
    pathCtx.restore();
  }

  function drawDisc(pathCtx, x, y, radius, color) {
    pathCtx.fillStyle = color;
    pathCtx.beginPath();
    pathCtx.arc(x, y, radius, 0, TAU);
    pathCtx.fill();
  }

  function drawBoot(pathCtx, foot, dir, palette) {
    pathCtx.save();
    pathCtx.translate(foot.x, foot.y);
    pathCtx.scale(dir, 1);
    pathCtx.fillStyle = palette.boot;
    roundedRect(pathCtx, -10, -5, 24, 10, 4);
    pathCtx.fill();
    pathCtx.fillStyle = shade(palette.boot, 38);
    pathCtx.fillRect(2, -4, 8, 3);
    pathCtx.restore();
  }

  function drawGlove(pathCtx, hand, radius, palette) {
    drawDisc(pathCtx, hand.x, hand.y, radius + 2, "rgba(0, 0, 0, 0.25)");
    drawDisc(pathCtx, hand.x, hand.y, radius, palette.glove);
    drawDisc(pathCtx, hand.x + 2, hand.y - 2, Math.max(2, radius * 0.35), shade(palette.glove, 36));
  }

  function poseFor(action, progress, style) {
    const t = progress;
    const wave = Math.sin(t * TAU);
    const punch = action === "punch" ? Math.sin(Math.min(1, t) * Math.PI) : 0;
    const kick = action === "kick" ? Math.sin(Math.min(1, t) * Math.PI) : 0;
    const special = action === "special" ? Math.sin(Math.min(1, t) * Math.PI) : 0;
    const hurt = action === "hurt" ? 1 - t : 0;
    const win = action === "win" ? Math.sin(t * TAU) : 0;
    const walk = action === "walk" ? wave : 0;
    const ko = action === "ko" ? clamp(t * 1.5, 0, 1) : 0;
    const block = action === "block" ? 1 : 0;

    const lean = punch * 8 - kick * 8 - hurt * 12 - ko * 12 + style.stance;
    const bob = action === "idle" ? Math.sin(t * TAU) * 2 : action === "walk" ? Math.abs(wave) * 3 : 0;

    const pose = {
      bob,
      lean,
      head: { x: 7 + punch * 5 - hurt * 7 - ko * 6, y: -137 + bob + ko * 12 },
      neck: { x: 2 + lean * 0.18, y: -116 + bob + ko * 12 },
      chest: { x: 1 + lean * 0.35, y: -96 + bob + ko * 16 },
      hip: { x: -1 - lean * 0.08, y: -60 + bob + ko * 22 },
      backArm: {
        shoulder: { x: -18 + lean * 0.08, y: -108 + bob + ko * 12 },
        elbow: { x: -37 - block * 2 + punch * 14 - hurt * 14, y: -83 + block * -16 + bob + ko * 18 },
        hand: { x: -40 + block * 40 + punch * 12 - hurt * 22, y: -64 + block * -34 + bob + ko * 18 },
      },
      frontArm: {
        shoulder: { x: 18 + lean * 0.12, y: -108 + bob + ko * 12 },
        elbow: { x: 37 + punch * 31 + special * 28 + block * 8 - hurt * 10, y: -84 - punch * 11 - special * 4 + block * -10 + bob + ko * 18 },
        hand: { x: 48 + punch * 58 + special * 62 + block * -10 - hurt * 20, y: -67 - punch * 25 - special * 15 + block * -42 + bob + ko * 20 },
      },
      backLeg: {
        hip: { x: -14, y: -58 + bob + ko * 22 },
        knee: { x: -24 - walk * 11 + kick * 6, y: -31 + bob + ko * 26 },
        foot: { x: -34 - walk * 24 + kick * 9, y: -4 + ko * 18 },
      },
      frontLeg: {
        hip: { x: 14, y: -58 + bob + ko * 22 },
        knee: { x: 25 + walk * 11 + kick * 41, y: -31 - kick * 28 + bob + ko * 26 },
        foot: { x: 36 + walk * 24 + kick * 76, y: -4 - kick * 64 + ko * 18 },
      },
      pulse: punch || kick || special,
      special,
      ko,
      win,
    };

    if (action === "win") {
      pose.frontArm.elbow = { x: 29, y: -137 + win * 3 };
      pose.frontArm.hand = { x: 34, y: -173 + win * 4 };
      pose.backArm.elbow = { x: -31, y: -90 };
      pose.backArm.hand = { x: -42, y: -70 };
      pose.head.y -= 4;
    }

    return pose;
  }

  function drawHair(pathCtx, style, head) {
    const { palette } = style;
    pathCtx.fillStyle = palette.hair;
    if (style.hair === 0) {
      pathCtx.beginPath();
      pathCtx.arc(head.x - 1, head.y - 5, 19, Math.PI * 1.02, Math.PI * 2.08);
      pathCtx.lineTo(head.x + 16, head.y - 8);
      pathCtx.quadraticCurveTo(head.x + 3, head.y - 25, head.x - 18, head.y - 11);
      pathCtx.fill();
    } else if (style.hair === 1) {
      pathCtx.beginPath();
      pathCtx.moveTo(head.x - 17, head.y - 10);
      pathCtx.lineTo(head.x - 2, head.y - 30);
      pathCtx.lineTo(head.x + 7, head.y - 11);
      pathCtx.lineTo(head.x + 20, head.y - 22);
      pathCtx.lineTo(head.x + 17, head.y - 4);
      pathCtx.closePath();
      pathCtx.fill();
    } else if (style.hair === 2) {
      roundedRect(pathCtx, head.x - 18, head.y - 24, 36, 28, 13);
      pathCtx.fill();
    } else {
      pathCtx.beginPath();
      pathCtx.arc(head.x - 2, head.y - 7, 19, Math.PI, TAU);
      pathCtx.fill();
      drawCapsule(pathCtx, { x: head.x - 13, y: head.y - 12 }, { x: head.x - 25, y: head.y + 3 }, 9, palette.hair);
    }
  }

  function drawTorso(pathCtx, style, pose) {
    const { palette } = style;
    pathCtx.save();
    pathCtx.fillStyle = palette.jacket;
    pathCtx.beginPath();
    pathCtx.moveTo(-23 + pose.lean * 0.1, -111 + pose.bob);
    pathCtx.lineTo(23 + pose.lean * 0.14, -108 + pose.bob);
    pathCtx.lineTo(21 - pose.lean * 0.03, -61 + pose.bob + pose.ko * 18);
    pathCtx.lineTo(-22 - pose.lean * 0.04, -58 + pose.bob + pose.ko * 18);
    pathCtx.closePath();
    pathCtx.fill();

    pathCtx.fillStyle = shade(palette.jacket, -35);
    pathCtx.beginPath();
    pathCtx.moveTo(1 + pose.lean * 0.1, -108 + pose.bob);
    pathCtx.lineTo(22 + pose.lean * 0.14, -106 + pose.bob);
    pathCtx.lineTo(18, -62 + pose.bob + pose.ko * 18);
    pathCtx.lineTo(2, -64 + pose.bob + pose.ko * 18);
    pathCtx.closePath();
    pathCtx.fill();

    if (style.stripe) {
      drawCapsule(pathCtx, { x: -12, y: -102 + pose.bob }, { x: 15, y: -68 + pose.bob + pose.ko * 12 }, 4, palette.trim);
    } else {
      pathCtx.fillStyle = palette.trim;
      roundedRect(pathCtx, -14, -84 + pose.bob, 31, 6, 3);
      pathCtx.fill();
    }

    if (style.collar) {
      pathCtx.fillStyle = palette.trim;
      pathCtx.beginPath();
      pathCtx.moveTo(-23, -111 + pose.bob);
      pathCtx.lineTo(-4, -102 + pose.bob);
      pathCtx.lineTo(-12, -94 + pose.bob);
      pathCtx.closePath();
      pathCtx.fill();
      pathCtx.beginPath();
      pathCtx.moveTo(23, -109 + pose.bob);
      pathCtx.lineTo(5, -101 + pose.bob);
      pathCtx.lineTo(13, -93 + pose.bob);
      pathCtx.closePath();
      pathCtx.fill();
    }

    pathCtx.fillStyle = palette.pants;
    roundedRect(pathCtx, -23, -64 + pose.bob + pose.ko * 18, 46, 14, 5);
    pathCtx.fill();
    pathCtx.restore();
  }

  function drawHead(pathCtx, style, pose) {
    const { palette } = style;
    const head = pose.head;
    drawDisc(pathCtx, head.x + 2, head.y + 3, 18, "rgba(0, 0, 0, 0.24)");
    drawDisc(pathCtx, head.x, head.y, 18, palette.skin);
    drawHair(pathCtx, style, head);

    pathCtx.fillStyle = "#11131a";
    drawDisc(pathCtx, head.x + 6, head.y - 1, 2, "#11131a");
    drawDisc(pathCtx, head.x - 5, head.y - 1, 2, "#11131a");
    pathCtx.strokeStyle = shade(palette.skin, -42);
    pathCtx.lineWidth = 2;
    pathCtx.beginPath();
    pathCtx.moveTo(head.x - 2, head.y + 7);
    pathCtx.quadraticCurveTo(head.x + 4, head.y + 10, head.x + 11, head.y + 6);
    pathCtx.stroke();

    if (style.mask) {
      pathCtx.fillStyle = "rgba(17, 19, 26, 0.82)";
      roundedRect(pathCtx, head.x - 16, head.y - 7, 34, 9, 4);
      pathCtx.fill();
      pathCtx.fillStyle = palette.trim;
      pathCtx.fillRect(head.x + 2, head.y - 5, 12, 3);
    }
  }

  function drawGeneratedSprite(style, action, progress) {
    const sprite = document.createElement("canvas");
    sprite.width = SPRITE.width;
    sprite.height = SPRITE.height;
    const g = sprite.getContext("2d");
    const pose = poseFor(action, progress, style);
    const { palette } = style;

    g.clearRect(0, 0, sprite.width, sprite.height);
    g.save();
    g.translate(SPRITE.pivotX, SPRITE.pivotY);
    g.scale(style.bodyWidth, style.bodyHeight);

    if (pose.special > 0) {
      g.save();
      g.globalAlpha = 0.28 + pose.special * 0.25;
      g.strokeStyle = palette.aura;
      g.lineWidth = 4;
      g.beginPath();
      g.arc(20, -90, 62 + pose.special * 12, -0.9, 0.9);
      g.stroke();
      g.beginPath();
      g.arc(12, -82, 44 + pose.special * 10, -0.7, 0.72);
      g.stroke();
      g.restore();
    }

    if (style.shoulder) {
      drawDisc(g, -21, -109 + pose.bob + pose.ko * 10, 9, palette.trim);
      drawDisc(g, 22, -108 + pose.bob + pose.ko * 10, 9, palette.trim);
    }

    drawCapsule(g, pose.backLeg.hip, pose.backLeg.knee, 16, palette.pants);
    drawCapsule(g, pose.backLeg.knee, pose.backLeg.foot, 15, shade(palette.pants, -22));
    drawBoot(g, pose.backLeg.foot, -1, palette);

    drawCapsule(g, pose.backArm.shoulder, pose.backArm.elbow, 13, shade(palette.jacket, -18));
    drawCapsule(g, pose.backArm.elbow, pose.backArm.hand, 12, palette.skin);
    drawGlove(g, pose.backArm.hand, 9, palette);

    drawTorso(g, style, pose);

    drawCapsule(g, pose.frontLeg.hip, pose.frontLeg.knee, 17, shade(palette.pants, 8));
    drawCapsule(g, pose.frontLeg.knee, pose.frontLeg.foot, 15, palette.pants);
    drawBoot(g, pose.frontLeg.foot, 1, palette);

    drawHead(g, style, pose);

    drawCapsule(g, pose.frontArm.shoulder, pose.frontArm.elbow, 14, palette.jacket);
    drawCapsule(g, pose.frontArm.elbow, pose.frontArm.hand, 12, palette.skin);
    drawGlove(g, pose.frontArm.hand, 10 + pose.pulse * 2, palette);

    g.restore();
    return sprite;
  }

  function createSpriteBank(style) {
    const frameCounts = {
      idle: 8,
      walk: 8,
      punch: 6,
      kick: 7,
      block: 3,
      hurt: 4,
      special: 9,
      ko: 6,
      win: 8,
    };

    return Object.fromEntries(
      Object.entries(frameCounts).map(([action, count]) => {
        const frames = Array.from({ length: count }, (_, index) => {
          const progress = count === 1 ? 0 : index / (count - 1);
          return drawGeneratedSprite(style, action, progress);
        });
        return [action, frames];
      }),
    );
  }

  class Fighter {
    constructor(role, style, startX) {
      this.role = role;
      this.style = style;
      this.sprites = createSpriteBank(style);
      this.maxHp = 100;
      this.reset(startX);
    }

    reset(startX) {
      this.x = startX;
      this.y = WORLD.groundY;
      this.vx = 0;
      this.hp = this.maxHp;
      this.energy = 18;
      this.facing = this.role === "player" ? 1 : -1;
      this.state = "idle";
      this.stateTime = 0;
      this.hitLanded = false;
      this.flash = 0;
    }

    canAct() {
      return !["punch", "kick", "special", "hurt", "ko", "win"].includes(this.state);
    }

    canMove() {
      return !["punch", "kick", "special", "hurt", "ko", "win"].includes(this.state);
    }

    isAttacking() {
      return ["punch", "kick", "special"].includes(this.state);
    }

    startAttack(kind) {
      const spec = attacks[kind];
      if (!spec || !this.canAct()) return false;
      if (this.energy < spec.cost) return false;
      this.energy = Math.max(0, this.energy - spec.cost);
      this.state = kind;
      this.stateTime = 0;
      this.hitLanded = false;
      this.vx += this.facing * (kind === "special" ? 140 : 70);
      return true;
    }

    takeHit(amount, knockback, blocked) {
      const finalDamage = blocked ? Math.ceil(amount * 0.32) : amount;
      this.hp = clamp(this.hp - finalDamage, 0, this.maxHp);
      this.energy = clamp(this.energy + (blocked ? 8 : 5), 0, 100);
      this.vx += knockback * (blocked ? 0.28 : 1);
      this.flash = blocked ? 0.1 : 0.18;
      if (this.hp <= 0) {
        this.state = "ko";
        this.stateTime = 0;
      } else if (!blocked) {
        this.state = "hurt";
        this.stateTime = 0;
      }
      return finalDamage;
    }

    setWinner() {
      this.state = "win";
      this.stateTime = 0;
      this.vx = 0;
    }

    update(dt, controls) {
      this.stateTime += dt;
      this.flash = Math.max(0, this.flash - dt);
      this.energy = clamp(this.energy + dt * 5, 0, 100);

      if (this.state === "hurt" && this.stateTime > 0.28) {
        this.state = "idle";
        this.stateTime = 0;
      }

      if (this.isAttacking() && this.stateTime > attacks[this.state].duration) {
        this.state = "idle";
        this.stateTime = 0;
        this.hitLanded = false;
      }

      if (this.canMove()) {
        const axis = (controls.right ? 1 : 0) - (controls.left ? 1 : 0);
        const blocking = controls.block;
        const maxSpeed = blocking ? 82 : 238;
        const targetVx = axis * maxSpeed;
        this.vx = lerp(this.vx, targetVx, clamp(dt * 11, 0, 1));

        if (blocking) {
          this.state = "block";
        } else if (Math.abs(axis) > 0.01) {
          this.state = "walk";
        } else if (this.state === "walk" || this.state === "block") {
          this.state = "idle";
        }
      } else {
        this.vx = lerp(this.vx, 0, clamp(dt * 2.4, 0, 1));
      }

      this.x += this.vx * dt;
      this.x = clamp(this.x, 78, WORLD.width - 78);
    }

    currentFrame() {
      const frames = this.sprites[this.state] || this.sprites.idle;
      let index;
      if (this.isAttacking()) {
        const percent = clamp(this.stateTime / attacks[this.state].duration, 0, 0.999);
        index = Math.floor(percent * frames.length);
      } else if (this.state === "hurt") {
        index = Math.min(frames.length - 1, Math.floor((this.stateTime / 0.28) * frames.length));
      } else if (this.state === "block") {
        index = Math.min(frames.length - 1, Math.floor(this.stateTime * 10) % frames.length);
      } else if (this.state === "ko") {
        index = Math.min(frames.length - 1, Math.floor(this.stateTime * 8));
      } else {
        index = Math.floor(this.stateTime * 10) % frames.length;
      }
      return frames[index] || frames[0];
    }
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    VIEW.scale = Math.min(rect.width / VIEW.width, rect.height / VIEW.height);
    VIEW.offsetX = (rect.width - VIEW.width * VIEW.scale) / 2;
    VIEW.offsetY = (rect.height - VIEW.height * VIEW.scale) / 2;
  }

  function generateMatch() {
    const seedBase = Date.now() ^ Math.floor(Math.random() * 0xfffffff);
    player = new Fighter("player", makeFighterStyle(seedBase, "player"), 360);
    enemy = new Fighter("enemy", makeFighterStyle(seedBase + 8191, "enemy"), 1260);
    game.cameraX = 300;
    game.particles.length = 0;
    game.hitMarks.length = 0;
    updateNames();
    updateHud();
  }

  function startRound() {
    player.reset(360);
    enemy.reset(1260);
    game.mode = "playing";
    game.timer = 99;
    game.ai.cooldown = 0.65;
    game.ai.blockFor = 0;
    game.ai.strafeFor = 0;
    game.round += game.round === 0 ? 1 : 0;
    hideOverlay();
    updateHud();
  }

  function updateNames() {
    ui.playerName.textContent = player.style.name;
    ui.enemyName.textContent = enemy.style.name;
  }

  function updateHud() {
    ui.playerHp.style.transform = `scaleX(${clamp(player.hp / player.maxHp, 0, 1)})`;
    ui.enemyHp.style.transform = `scaleX(${clamp(enemy.hp / enemy.maxHp, 0, 1)})`;
    ui.playerEnergy.style.transform = `scaleX(${clamp(player.energy / 100, 0, 1)})`;
    ui.enemyEnergy.style.transform = `scaleX(${clamp(enemy.energy / 100, 0, 1)})`;
    ui.roundLabel.textContent = `ROUND ${game.round}`;
    ui.timer.textContent = `${Math.ceil(game.timer)}`;
    ui.pauseBtn.textContent = game.mode === "paused" ? "继续" : "暂停";
  }

  function showOverlay(title, text, buttonText = "开战") {
    ui.overlayTitle.textContent = title;
    ui.overlayText.textContent = text;
    ui.startBtn.textContent = buttonText;
    ui.overlay.classList.remove("is-hidden");
  }

  function hideOverlay() {
    ui.overlay.classList.add("is-hidden");
  }

  function rerollAndShow() {
    generateMatch();
    game.mode = "ready";
    showOverlay("街斗生成器", `${player.style.title} 对阵 ${enemy.style.title}`, "开战");
  }

  function hardRestart() {
    generateMatch();
    game.mode = "playing";
    startRound();
  }

  function pauseToggle() {
    if (game.mode === "playing") {
      game.mode = "paused";
      showOverlay("暂停", `${player.style.name} 对阵 ${enemy.style.name}`, "继续");
    } else if (game.mode === "paused") {
      game.mode = "playing";
      hideOverlay();
      game.lastTime = performance.now();
    }
    updateHud();
  }

  function finishRound(result) {
    if (game.mode === "over") return;
    game.mode = "over";
    const title = result === "player" ? "胜利" : result === "enemy" ? "落败" : "平局";
    const text =
      result === "draw"
        ? "双方都站到了最后一秒。"
        : `${result === "player" ? player.style.name : enemy.style.name} 拿下这一回合。`;
    if (result === "player") {
      player.setWinner();
      if (enemy.hp > 0) enemy.state = "ko";
    } else if (result === "enemy") {
      enemy.setWinner();
      if (player.hp > 0) player.state = "ko";
    }
    setTimeout(() => showOverlay(title, text, "再战"), 480);
  }

  function runAI(dt) {
    const aiInput = { left: false, right: false, block: false };
    if (enemy.hp <= 0 || player.hp <= 0) return aiInput;

    game.ai.cooldown -= dt;
    game.ai.blockFor = Math.max(0, game.ai.blockFor - dt);
    game.ai.strafeFor = Math.max(0, game.ai.strafeFor - dt);

    const dx = player.x - enemy.x;
    const distance = Math.abs(dx);
    const dir = Math.sign(dx) || enemy.facing;
    const playerThreat = player.isAttacking() && distance < 165;

    if (playerThreat && Math.random() < 0.045) {
      game.ai.blockFor = randBetween(Math.random, 0.22, 0.5);
    }

    if (game.ai.blockFor > 0 && enemy.canAct()) {
      aiInput.block = true;
      if (distance > 120) {
        aiInput.left = dir < 0;
        aiInput.right = dir > 0;
      }
      return aiInput;
    }

    if (!enemy.canAct()) return aiInput;

    if (distance > 132) {
      aiInput.left = dir < 0;
      aiInput.right = dir > 0;
    } else if (distance < 58) {
      aiInput.left = dir > 0;
      aiInput.right = dir < 0;
    } else if (game.ai.strafeFor > 0) {
      aiInput.left = game.ai.strafeDir < 0;
      aiInput.right = game.ai.strafeDir > 0;
    } else if (Math.random() < 0.01) {
      game.ai.strafeFor = randBetween(Math.random, 0.24, 0.52);
      game.ai.strafeDir = Math.random() > 0.5 ? 1 : -1;
    }

    if (distance < 138 && game.ai.cooldown <= 0) {
      const roll = Math.random();
      if (enemy.energy >= attacks.special.cost && (roll > 0.72 || player.hp < 30)) {
        enemy.startAttack("special");
        game.ai.cooldown = randBetween(Math.random, 0.95, 1.45);
      } else if (roll > 0.44) {
        enemy.startAttack("kick");
        game.ai.cooldown = randBetween(Math.random, 0.62, 1.05);
      } else {
        enemy.startAttack("punch");
        game.ai.cooldown = randBetween(Math.random, 0.45, 0.9);
      }
    }

    return aiInput;
  }

  function updateFacing() {
    if (!player.isAttacking() && player.state !== "hurt" && player.state !== "ko") {
      player.facing = enemy.x >= player.x ? 1 : -1;
    }
    if (!enemy.isAttacking() && enemy.state !== "hurt" && enemy.state !== "ko") {
      enemy.facing = player.x >= enemy.x ? 1 : -1;
    }
  }

  function resolveSpacing() {
    const minGap = 46;
    const dx = enemy.x - player.x;
    const distance = Math.abs(dx);
    if (distance <= 0.01 || distance >= minGap) return;
    const push = (minGap - distance) * 0.5;
    const dir = Math.sign(dx) || 1;
    player.x = clamp(player.x - push * dir, 78, WORLD.width - 78);
    enemy.x = clamp(enemy.x + push * dir, 78, WORLD.width - 78);
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function hurtBox(fighter) {
    return {
      x: fighter.x - 30,
      y: WORLD.groundY - 150,
      w: 60,
      h: 146,
    };
  }

  function attackBox(fighter, spec) {
    const x = fighter.x + fighter.facing * (38 + spec.reach * 0.5);
    return {
      x: x - spec.reach / 2,
      y: WORLD.groundY + spec.yOffset - spec.height / 2,
      w: spec.reach,
      h: spec.height,
    };
  }

  function isBlocking(defender, attacker) {
    if (defender.state !== "block") return false;
    return Math.sign(attacker.x - defender.x) === defender.facing;
  }

  function checkHit(attacker, defender) {
    if (!attacker.isAttacking() || attacker.hitLanded || defender.state === "ko") return;
    const spec = attacks[attacker.state];
    if (attacker.stateTime < spec.activeStart || attacker.stateTime > spec.activeEnd) return;
    const hit = attackBox(attacker, spec);
    if (!rectsOverlap(hit, hurtBox(defender))) return;

    const blocked = isBlocking(defender, attacker);
    const knockback = attacker.facing * spec.knockback;
    const damage = defender.takeHit(spec.damage, knockback, blocked);
    attacker.energy = clamp(attacker.energy + spec.gain, 0, 100);
    attacker.hitLanded = true;
    game.shake = blocked ? 0.08 : 0.16;

    const impactX = defender.x - defender.facing * 28;
    const impactY = WORLD.groundY - 100;
    spawnImpact(impactX, impactY, blocked ? "#78d7ff" : attacker.style.palette.trim, blocked);
    game.hitMarks.push({
      x: impactX,
      y: impactY - 28,
      text: blocked ? "GUARD" : `${damage}`,
      life: 0.52,
      maxLife: 0.52,
      color: blocked ? "#78d7ff" : "#ffdf76",
    });
  }

  function spawnImpact(x, y, color, blocked) {
    const count = blocked ? 9 : 16;
    for (let i = 0; i < count; i += 1) {
      const angle = randBetween(Math.random, -Math.PI, Math.PI);
      const speed = randBetween(Math.random, blocked ? 80 : 120, blocked ? 220 : 330);
      game.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        size: randBetween(Math.random, 2, blocked ? 5 : 7),
        life: randBetween(Math.random, 0.22, 0.48),
        maxLife: 0.48,
        color,
      });
    }
  }

  function updateParticles(dt) {
    for (const p of game.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 460 * dt;
    }
    game.particles = game.particles.filter((p) => p.life > 0);

    for (const mark of game.hitMarks) {
      mark.life -= dt;
      mark.y -= 34 * dt;
    }
    game.hitMarks = game.hitMarks.filter((mark) => mark.life > 0);
  }

  function updateCamera(dt) {
    const midpoint = (player.x + enemy.x) * 0.5;
    const target = clamp(midpoint - VIEW.width * 0.5, 0, WORLD.width - VIEW.width);
    game.cameraX = lerp(game.cameraX, target, clamp(dt * 4.8, 0, 1));
  }

  function update(dt) {
    if (game.mode !== "playing") return;

    game.timer = Math.max(0, game.timer - dt);
    updateFacing();
    player.update(dt, input);
    const aiInput = runAI(dt);
    enemy.update(dt, aiInput);
    updateFacing();
    resolveSpacing();
    checkHit(player, enemy);
    checkHit(enemy, player);
    updateParticles(dt);
    updateCamera(dt);
    game.shake = Math.max(0, game.shake - dt);

    if (game.timer <= 0) {
      if (player.hp === enemy.hp) finishRound("draw");
      else finishRound(player.hp > enemy.hp ? "player" : "enemy");
    } else if (player.hp <= 0 && enemy.hp <= 0) {
      finishRound("draw");
    } else if (enemy.hp <= 0) {
      finishRound("player");
    } else if (player.hp <= 0) {
      finishRound("enemy");
    }

    updateHud();
  }

  function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, VIEW.height);
    sky.addColorStop(0, "#21355f");
    sky.addColorStop(0.42, "#3c6b7a");
    sky.addColorStop(0.72, "#d3845a");
    sky.addColorStop(1, "#1a1a22");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);

    const sunX = 720 - game.cameraX * 0.1;
    const sunGradient = ctx.createRadialGradient(sunX, 112, 8, sunX, 112, 88);
    sunGradient.addColorStop(0, "rgba(255, 226, 124, 0.92)");
    sunGradient.addColorStop(1, "rgba(255, 137, 90, 0)");
    ctx.fillStyle = sunGradient;
    ctx.beginPath();
    ctx.arc(sunX, 112, 88, 0, TAU);
    ctx.fill();

    drawParallaxBuildings(0.18, 260, "#172035", 84);
    drawParallaxBuildings(0.36, 304, "#252743", 116);
    drawParallaxBuildings(0.58, 350, "#313445", 148);

    ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
    for (let i = 0; i < 10; i += 1) {
      const x = (i * 137 - game.cameraX * 0.22) % (VIEW.width + 160);
      ctx.fillRect(x - 80, 148 + (i % 3) * 28, 92, 2);
    }
  }

  function drawParallaxBuildings(speed, baseY, color, maxHeight) {
    const offset = (game.cameraX * speed) % 180;
    ctx.fillStyle = color;
    for (let x = -220 - offset; x < VIEW.width + 220; x += 180) {
      const h1 = 50 + ((x + maxHeight) % maxHeight);
      const w = 76 + (Math.abs(x) % 48);
      ctx.fillRect(x, baseY - h1, w, h1);
      ctx.fillRect(x + w + 16, baseY - h1 * 0.72, w * 0.55, h1 * 0.72);
      ctx.fillStyle = "rgba(255, 214, 102, 0.22)";
      for (let y = baseY - h1 + 16; y < baseY - 10; y += 22) {
        ctx.fillRect(x + 12, y, 8, 4);
        ctx.fillRect(x + 34, y, 8, 4);
      }
      ctx.fillStyle = color;
    }
  }

  function drawArena() {
    ctx.save();
    ctx.translate(-game.cameraX, 0);

    const floor = ctx.createLinearGradient(0, WORLD.groundY, 0, WORLD.height);
    floor.addColorStop(0, "#263139");
    floor.addColorStop(0.48, "#151923");
    floor.addColorStop(1, "#0b0c12");
    ctx.fillStyle = floor;
    ctx.fillRect(-120, WORLD.groundY, WORLD.width + 240, WORLD.height - WORLD.groundY);

    ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
    ctx.fillRect(0, WORLD.groundY, WORLD.width, 2);
    ctx.fillStyle = "rgba(255, 200, 87, 0.2)";
    for (let x = 70; x < WORLD.width; x += 120) {
      ctx.fillRect(x, WORLD.groundY + 28, 74, 3);
    }

    ctx.strokeStyle = "rgba(52, 203, 212, 0.36)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, WORLD.groundY + 76);
    ctx.lineTo(WORLD.width, WORLD.groundY + 76);
    ctx.stroke();

    for (let x = 120; x < WORLD.width; x += 280) {
      ctx.fillStyle = "rgba(17, 19, 26, 0.74)";
      roundedRect(ctx, x, WORLD.groundY - 178, 28, 178, 6);
      ctx.fill();
      ctx.fillStyle = x % 560 === 120 ? "#ff4f59" : "#34cbd4";
      roundedRect(ctx, x - 18, WORLD.groundY - 178, 64, 18, 6);
      ctx.fill();
    }

    drawFighter(player);
    drawFighter(enemy);
    drawParticles();
    drawHitMarks();

    ctx.restore();
  }

  function drawFighter(fighter) {
    ctx.save();
    ctx.translate(fighter.x, WORLD.groundY);

    const shadowScale = fighter.state === "ko" ? 1.18 : 1;
    ctx.fillStyle = "rgba(0, 0, 0, 0.32)";
    ctx.beginPath();
    ctx.ellipse(0, -2, 42 * shadowScale, 9, 0, 0, TAU);
    ctx.fill();

    if (fighter.flash > 0) {
      ctx.globalAlpha = 0.72;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.ellipse(0, -86, 42, 78, 0, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    if (fighter.state === "special") {
      drawAttackTrail(fighter);
    }

    ctx.scale(fighter.facing, 1);
    const frame = fighter.currentFrame();
    ctx.drawImage(frame, -SPRITE.pivotX, -SPRITE.pivotY);
    ctx.restore();

    if (fighter.state === "punch" || fighter.state === "kick") {
      drawAttackTrail(fighter);
    }
  }

  function drawAttackTrail(fighter) {
    const spec = attacks[fighter.state];
    if (!spec) return;
    const active = fighter.stateTime >= spec.activeStart && fighter.stateTime <= spec.activeEnd;
    const progress = clamp(fighter.stateTime / spec.duration, 0, 1);
    const alpha = active ? 0.42 : 0.18 * Math.sin(progress * Math.PI);
    if (alpha <= 0) return;

    ctx.save();
    ctx.translate(fighter.x, WORLD.groundY);
    ctx.scale(fighter.facing, 1);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = fighter.style.palette.aura;
    ctx.fillStyle = fighter.style.palette.aura;
    ctx.lineWidth = fighter.state === "special" ? 10 : 7;
    ctx.lineCap = "round";
    ctx.beginPath();

    if (fighter.state === "kick") {
      ctx.arc(52, -78, 55, -0.6, 0.72);
    } else if (fighter.state === "special") {
      ctx.moveTo(34, -124);
      ctx.quadraticCurveTo(94, -110, 148, -78);
      ctx.quadraticCurveTo(96, -62, 36, -70);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.moveTo(38, -108);
      ctx.quadraticCurveTo(78, -122, 112, -101);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawParticles() {
    for (const p of game.particles) {
      const alpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.7 + alpha), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawHitMarks() {
    ctx.save();
    ctx.font = "900 22px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const mark of game.hitMarks) {
      const alpha = clamp(mark.life / mark.maxLife, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "rgba(0, 0, 0, 0.38)";
      ctx.fillText(mark.text, mark.x + 2, mark.y + 2);
      ctx.fillStyle = mark.color;
      ctx.fillText(mark.text, mark.x, mark.y);
    }
    ctx.restore();
  }

  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#08090d";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(
      dpr * VIEW.scale,
      0,
      0,
      dpr * VIEW.scale,
      dpr * VIEW.offsetX,
      dpr * VIEW.offsetY,
    );

    const shakeX = game.shake > 0 ? randBetween(Math.random, -8, 8) * game.shake * 6 : 0;
    const shakeY = game.shake > 0 ? randBetween(Math.random, -5, 5) * game.shake * 5 : 0;
    ctx.save();
    ctx.translate(shakeX, shakeY);
    drawBackground();
    drawArena();
    ctx.restore();

    if (game.mode === "paused") {
      ctx.fillStyle = "rgba(0, 0, 0, 0.26)";
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    }
  }

  function loop(now) {
    const dt = clamp((now - game.lastTime) / 1000 || 0, 0, 1 / 30);
    game.lastTime = now;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  function handleTapAction(action) {
    if (game.mode !== "playing") return;
    player.startAttack(action);
  }

  function bindControls() {
    document.querySelectorAll("[data-hold]").forEach((button) => {
      const key = button.dataset.hold;
      const release = () => {
        input[key] = false;
        button.classList.remove("is-pressed");
      };

      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        input[key] = true;
        button.classList.add("is-pressed");
        button.setPointerCapture?.(event.pointerId);
      });
      button.addEventListener("pointerup", release);
      button.addEventListener("pointercancel", release);
      button.addEventListener("lostpointercapture", release);
    });

    document.querySelectorAll("[data-tap]").forEach((button) => {
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        button.classList.add("is-pressed");
        handleTapAction(button.dataset.tap);
      });
      const clear = () => button.classList.remove("is-pressed");
      button.addEventListener("pointerup", clear);
      button.addEventListener("pointercancel", clear);
      button.addEventListener("lostpointercapture", clear);
    });

    window.addEventListener("keydown", (event) => {
      const move = keyboardMap.get(event.key);
      if (move) {
        input[move] = true;
        event.preventDefault();
      }

      const attack = attackKeys.get(event.key);
      if (attack && !event.repeat) {
        handleTapAction(attack);
        event.preventDefault();
      }

      if ((event.key === "p" || event.key === "P") && !event.repeat) {
        pauseToggle();
      }
      if ((event.key === "r" || event.key === "R") && !event.repeat) {
        hardRestart();
      }
    });

    window.addEventListener("keyup", (event) => {
      const move = keyboardMap.get(event.key);
      if (move) {
        input[move] = false;
        event.preventDefault();
      }
    });

    window.addEventListener("blur", () => {
      input.left = false;
      input.right = false;
      input.block = false;
    });

    window.addEventListener("contextmenu", (event) => event.preventDefault());
  }

  ui.startBtn.addEventListener("click", () => {
    if (game.mode === "paused") {
      pauseToggle();
      return;
    }
    startRound();
  });

  ui.rerollBtn.addEventListener("click", rerollAndShow);
  ui.rerollTop.addEventListener("click", hardRestart);
  ui.pauseBtn.addEventListener("click", pauseToggle);

  window.addEventListener("resize", () => {
    resize();
    render();
  });

  resize();
  bindControls();
  generateMatch();
  showOverlay("街斗生成器", `${player.style.title} 对阵 ${enemy.style.title}`, "开战");
  game.lastTime = performance.now();
  requestAnimationFrame(loop);
})();
