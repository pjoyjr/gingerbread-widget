const toBool = v => v === true || v === "true" || v === 1 || v === "1";
const optBool = (v, def) => (v === undefined || v === null || v === "") ? def : toBool(v);
const num = (v, def) => {
    if (v === undefined || v === null || v === "") return def;
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
};
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const CLIP_TYPES = ["walk", "idle", "throw", "hit", "dance"];
const CLIP_LOOP = { walk: true, idle: true };
const CLIP_LEN = { walk: 3, idle: 3, throw: 77 / 30, hit: 73 / 30, dance: 3 };

const ART = {
    bodyDX: 0.035,
    drawHalf: 0.355,
    hitHalf: 0.21,
    hitBottom: 0.065,
    hitTop: 0.93,
    ballDX: 0.3275,
    ballY: 0.42625,
    ballR: 0.0875
};

const BALL_BOX = { x: 310, y: 195, w: 70, h: 69, cx: 345, cy: 229.5 };
const SNOWBALL_URL = "https://cdn.streamelements.com/uploads/01kc2drrgaj02jkbvycfym2yw4.png";
const BALL_SPEED = 90;
const HIT_FADE_AT = 1.6;
const DODGE_MS = 1600; // Match gb-matrix-dodge in CSS
const DUEL_MOVE_MS = 1200;
const DUEL_SHOT_TIMEOUT_MS = 4800;
const DUEL_CELEBRATE_MS = 3300;

const INVISIBLE = new RegExp("[" + String.fromCodePoint(0xE0000) + "-" + String.fromCodePoint(0xE007F) + String.fromCharCode(0x34F, 0x200B, 0x200C, 0x200D, 0x2060, 0xFEFF) + "]", "gu");
const ELLIPSIS = String.fromCharCode(0x2026);

const settings = {
    spawnCmds: ["!gingerbread"],
    throwCmds: ["!throw"],
    dodgeCmds: ["!dodge"],
    danceCmds: ["!dance"],
    duelCmds: ["!duel"],
    clearCmds: ["!cleargb"],
    permSpawn: { everyone: true, viewers: true, subscribers: true, vips: true, members: true, moderators: true, broadcaster: true },
    permThrow: { everyone: true, viewers: true, subscribers: true, vips: true, members: true, moderators: true, broadcaster: true },
    permDodge: { everyone: true, viewers: true, subscribers: true, vips: true, members: true, moderators: true, broadcaster: true },
    permDance: { everyone: true, viewers: true, subscribers: true, vips: true, members: true, moderators: true, broadcaster: true },
    permDuel: { everyone: true, viewers: true, subscribers: true, vips: true, members: true, moderators: true, broadcaster: true },
    permClear: { everyone: false, viewers: false, subscribers: false, vips: false, members: false, moderators: true, broadcaster: true },
    userCd: 0,
    globalCd: 0,
    dodgeCd: 8,
    danceCd: 5,
    duelCd: 25,
    showBubble: true,
    bubbleScale: 1,
    size: 35,
    walkSpeed: 10,
    bottomOffset: 0,
    randomColor: false,
    hitSurvive: false,
    maxCount: 5,
    whenFull: "ignore",
    lifetimeMin: 30
};

const gingers = new Map();
const dying = new Set();
const balls = new Set();
const userThrowUntil = Object.create(null);
const userDodgeUntil = Object.create(null);
const userDanceUntil = Object.create(null);
let duel = null;
let nextDuelAt = 0;
let duelBanner = null;
let globalThrowUntil = 0;
let nextGingerId = 1;
let testCount = 0;
let loopOn = false;
let styleEl = null;

const viewW = () => window.innerWidth || document.documentElement.clientWidth || 1920;
const viewH = () => window.innerHeight || document.documentElement.clientHeight || 1080;
const frameSize = () => settings.size / 100 * viewH();
const frameVw = () => frameSize() / viewW() * 100;
const containerTransform = x => "translateX(" + x + "vw) translateX(-50%)";

function cmdList(value, fallback) {
    const list = String(value === undefined || value === null ? "" : value)
        .toLowerCase()
        .split(",")
        .map(c => c.replace(INVISIBLE, "").trim())
        .filter(c => c.length > 0);
    return list.length ? list : [fallback];
}

function readPerms(f, prefix, def) {
    return {
        everyone: optBool(f[prefix + "Everyone"], def.everyone),
        viewers: optBool(f[prefix + "Viewers"], def.viewers),
        subscribers: optBool(f[prefix + "Subscribers"], def.subscribers),
        vips: optBool(f[prefix + "VIPs"], def.vips),
        members: optBool(f[prefix + "Members"], def.members),
        moderators: optBool(f[prefix + "Moderators"], def.moderators),
        broadcaster: optBool(f[prefix + "Broadcaster"], def.broadcaster)
    };
}

function loadSettings(f) {
    settings.spawnCmds = cmdList(f.commandName, "!gingerbread");
    settings.throwCmds = cmdList(f.commandThrow, "!throw");
    settings.dodgeCmds = cmdList(f.commandDodge, "!dodge");
    settings.danceCmds = cmdList(f.commandDance, "!dance");
    settings.duelCmds = cmdList(f.commandDuel, "!duel");
    settings.clearCmds = cmdList(f.commandOff, "!cleargb");
    settings.permSpawn = readPerms(f, "allowSpawn", settings.permSpawn);
    settings.permThrow = readPerms(f, "allowThrow", settings.permThrow);
    // Unconfigured dodge permissions inherit throw permissions.
    settings.permDodge = readPerms(f, "allowDodge", settings.permThrow);
    settings.permDance = readPerms(f, "allowDance", settings.permThrow);
    settings.permDuel = readPerms(f, "allowDuel", settings.permThrow);
    settings.permClear = readPerms(f, "allowClear", settings.permClear);
    settings.userCd = Math.max(0, num(f.throwUserCooldown, 0));
    settings.globalCd = Math.max(0, num(f.throwGlobalCooldown, 0));
    settings.dodgeCd = clamp(num(f.dodgeUserCooldown, 8), 0, 3600);
    settings.danceCd = clamp(num(f.danceUserCooldown, 5), 0, 3600);
    settings.duelCd = clamp(num(f.duelGlobalCooldown, 25), 0, 3600);
    settings.showBubble = optBool(f.showBubble, true);
    settings.bubbleScale = clamp(num(f.bubbleScale, 50), 10, 100) / 50;
    settings.size = clamp(num(f.gingerSize, 35), 10, 50);
    settings.walkSpeed = clamp(num(f.walkSpeed, 10), 1, 20);
    settings.bottomOffset = clamp(num(f.bottomOffset, 0), -500, 500);
    settings.randomColor = optBool(f.randomColor, false);
    settings.hitSurvive = optBool(f.hitSurvive, false);
    settings.maxCount = clamp(Math.round(num(f.maxActiveGingers, 5)), 1, 10);
    settings.whenFull = f.whenFull === "replace" ? "replace" : "ignore";
    settings.lifetimeMin = clamp(num(f.gingerLifetime, 30), 1, 240);
}

function applyStyle() {
    if (!styleEl) {
        styleEl = document.createElement("style");
        document.head.appendChild(styleEl);
    }
    styleEl.textContent = ":root{--ginger-size:" + settings.size + "vh !important;--bubble-display:" + (settings.showBubble ? "block" : "none") + " !important;--bubble-scale:" + settings.bubbleScale + " !important;--bottom-offset:" + settings.bottomOffset + "px !important;}";
}

function warmAssets() {
    const img = document.createElement("img");
    img.src = SNOWBALL_URL;
    img.alt = "";
    img.style.position = "absolute";
    img.style.top = "-9999px";
    img.style.left = "-9999px";
    img.style.opacity = "0.01";
    img.style.pointerEvents = "none";
    document.body.appendChild(img);
    if (img.decode) img.decode().catch(() => {});
    if (document.fonts && document.fonts.load) document.fonts.load("600 18px Fredoka").catch(() => {});
}

function parseBadges(raw) {
    if (!raw) return [];
    if (typeof raw === "string") {
        return raw.split(",").map(s => {
            const parts = s.split("/");
            return { type: String(parts[0] || "").toLowerCase(), version: parts[1] };
        });
    }
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "object") return Object.keys(raw).map(k => ({ type: k.toLowerCase(), version: raw[k] }));
    return [];
}

function isAllowed(data, p) {
    if (p.everyone) return true;
    const tags = data.tags || {};
    const listed = Array.isArray(data.badges) ? data.badges : [];
    const raw = parseBadges(tags.badges);
    const has = type => listed.some(b => b && String(b.type).toLowerCase() === type) || raw.some(b => b.type === type);
    const yt = data.authorDetails || {};

    const twitch = {
        broadcaster: !!(tags["room-id"] && tags["user-id"] && String(tags["room-id"]) === String(tags["user-id"])) || has("broadcaster"),
        mod: tags.mod === "1" || has("moderator"),
        vip: tags.vip === "1" || has("vip"),
        sub: tags.subscriber === "1" || has("subscriber") || has("founder")
    };
    const youtube = {
        owner: yt.isChatOwner === true,
        mod: yt.isChatModerator === true,
        member: yt.isChatSponsor === true
    };

    const viewer = !twitch.broadcaster && !twitch.mod && !twitch.vip && !twitch.sub && !youtube.owner && !youtube.mod && !youtube.member;

    if (p.broadcaster && (twitch.broadcaster || youtube.owner)) return true;
    if (p.moderators && (twitch.mod || youtube.mod)) return true;
    if (p.vips && twitch.vip) return true;
    if (p.subscribers && twitch.sub) return true;
    if (p.members && youtube.member) return true;
    if (p.viewers && viewer) return true;
    return false;
}

function identify(data) {
    const tags = data.tags || {};
    const id = String(tags["user-id"] || data.userId || data.nick || data.displayName || "anon");
    const login = String(data.nick || data.displayName || "").toLowerCase();
    const name = String(data.displayName || tags["display-name"] || data.nick || "viewer");
    return { id, login, name };
}

function parseMessage(data) {
    let text = String(data.text || "").replace(INVISIBLE, " ").trim().toLowerCase();
    const tags = data.tags || {};
    if (tags["reply-parent-msg-id"] && text.charAt(0) === "@") text = text.replace(/^@\S*\s*/, "");
    const parts = text.split(/\s+/);
    return { cmd: parts[0] || "", arg: (parts[1] || "").replace(/^@/, "") };
}

function shortName(name) {
    const chars = Array.from(String(name || "viewer"));
    return chars.length > 22 ? chars.slice(0, 21).join("") + ELLIPSIS : chars.join("");
}

function walkBounds() {
    const w = frameVw();
    const pad = 1.5;
    const min = w * ART.drawHalf + pad - w * ART.bodyDX;
    const max = 100 - w * ART.drawHalf - pad - w * ART.bodyDX;
    return min < max ? { min, max } : { min: 50, max: 50 };
}

function pickSpawnX() {
    const b = walkBounds();
    const others = [];
    gingers.forEach(g => others.push(g.currentPos()));
    let best = b.min + Math.random() * (b.max - b.min);
    let bestScore = -1;
    for (let i = 0; i < 10; i++) {
        const x = b.min + Math.random() * (b.max - b.min);
        let score = Math.random();
        if (others.length) score = Math.min.apply(null, others.map(o => Math.abs(o - x)));
        if (score > bestScore) {
            bestScore = score;
            best = x;
        }
    }
    return best;
}

function nearestTarget(from, dir) {
    const me = from.bodyX();
    let best = null;
    let bestD = Infinity;
    gingers.forEach(g => {
        if (g === from || !g.isTargetable()) return;
        const d = (g.bodyX() - me) * dir;
        if (d > 0 && d < bestD) {
            bestD = d;
            best = g;
        }
    });
    return best;
}

class Ginger {
    constructor(user) {
        this.id = nextGingerId++;
        this.userId = user.id;
        this.login = user.login;
        this.name = user.name;
        this.state = "new";
        this.token = 0;
        this.timer = null;
        this.lifeTimer = null;
        this.lifeEnd = 0;
        this.lifeLeft = 0;
        this.posX = 50;
        this.dir = 1;
        this.walk = null;
        this.arenaMove = null;
        this.shot = null;
        this.duelShotReleased = false;
        this.duelShotAt = 0;
        this.visible = false;
        this.survive = false;
        this.spawnedAt = performance.now();
        this.hue = settings.randomColor ? 30 + Math.floor(Math.random() * 300) : 0;

        this.container = document.createElement("div");
        this.container.className = "ginger-container";
        this.bubble = document.createElement("div");
        this.bubble.className = "speech-bubble";
        this.bubble.textContent = shortName(this.name);
        this.container.appendChild(this.bubble);

        this.anim = new Animator(this);
        if (this.hue) this.anim.setHue(this.hue);
        document.body.appendChild(this.container);
    }

    setState(name) {
        this.state = name;
        this.token += 1;
        clearTimeout(this.timer);
        this.timer = null;
    }

    setX(x) {
        this.posX = x;
        this.container.style.transform = containerTransform(x);
    }

    setMirror(dir) {
        this.dir = dir;
        this.anim.setMirror(dir);
    }

    walkTime() {
        const w = this.walk;
        if (!w) return 0;
        const ct = w.anim.currentTime;
        return clamp(ct === null || ct === undefined ? 0 : Number(ct), 0, w.duration);
    }

    walkSegment() {
        const w = this.walk;
        if (!w) return null;
        const t = this.walkTime();
        for (let i = 0; i < w.segs.length; i++) {
            if (t <= w.segs[i].t1) return w.segs[i];
        }
        return w.segs[w.segs.length - 1];
    }

    currentPos() {
        const w = this.walk;
        if (!w) return this.posX;
        const t = this.walkTime();
        const s = this.walkSegment();
        const span = Math.max(1, s.t1 - s.t0);
        return s.x0 + (s.x1 - s.x0) * clamp((t - s.t0) / span, 0, 1);
    }

    bodyX() {
        return this.currentPos() + ART.bodyDX * frameVw();
    }

    isTargetable() {
        if (!this.visible) return false;
        return this.state === "walk" || this.state === "idle" || this.state === "throw" || this.state === "aftermath" || this.state === "dance";
    }

    canThrow() {
        return this.state === "walk" || this.state === "idle" || this.state === "dance";
    }

    canDodge() {
        // Cannot interrupt an already-released throw, a hit, or another dodge.
        return this.canThrow();
    }

    startDodge() {
        if (!this.canDodge()) return false;
        this.stopWalk();
        this.setState("dodge");
        // Lean in the direction the closest incoming snowball is flying.
        // This makes the pose flip naturally for shots from either side.
        const me = this.bodyX() / 100 * viewW();
        let incoming = null;
        let nearest = Infinity;
        balls.forEach(b => {
            if (b.done || b.owner === this) return;
            const t = clamp(Number(b.flight.currentTime || 0) / 1000, 0, b.end);
            const x = b.at(t).x;
            const distAhead = (me - x) * b.dir;
            if (distAhead >= -b.r && distAhead < nearest) {
                nearest = distAhead;
                incoming = b;
            }
        });
        const lean = (incoming ? incoming.dir : this.dir) * 62;
        this.container.style.setProperty("--matrix-lean", lean + "deg");
        this.container.classList.add("dodging");
        this.bubble.textContent = "🕶️ " + shortName(this.name);
        this.anim.play("idle");
        const token = this.token;
        this.timer = setTimeout(() => {
            if (this.token !== token || this.state !== "dodge") return;
            this.container.classList.remove("dodging");
            this.bubble.textContent = shortName(this.name);
            this.startIdle();
        }, DODGE_MS);
        ensureLoop();
        return true;
    }

    spawn() {
        this.setX(pickSpawnX());
        const ms = settings.lifetimeMin * 60000;
        this.lifeEnd = performance.now() + ms;
        this.lifeTimer = setTimeout(() => this.remove("lifetime"), ms);
        this.startWalk();
        ensureLoop();
    }

    onReveal() {
        if (this.visible || this.state === "dead") return;
        this.visible = true;
        void this.container.offsetWidth;
        this.container.classList.add("visible");
    }

    pulse() {
        this.bubble.classList.remove("pulse");
        void this.bubble.offsetWidth;
        this.bubble.classList.add("pulse");
    }

    stopWalk() {
        const w = this.walk;
        if (!w) return;
        const x = this.currentPos();
        this.walk = null;
        this.setX(x);
        w.anim.cancel();
    }

    stopArenaMove() {
        if (!this.arenaMove) return;
        const animation = this.arenaMove;
        this.arenaMove = null;
        animation.cancel();
    }

    moveToArena(x) {
        this.stopWalk();
        this.stopArenaMove();
        const from = this.currentPos();
        const anim = this.container.animate([
            { transform: containerTransform(from) },
            { transform: containerTransform(x) }
        ], { duration: DUEL_MOVE_MS, easing: "ease-in-out", fill: "forwards" });
        this.arenaMove = anim;
        anim.onfinish = () => {
            if (this.arenaMove !== anim) return;
            this.arenaMove = null;
            this.setX(x);
            anim.cancel();
        };
    }

    prepareDuel(x, side) {
        this.stopWalk();
        this.stopArenaMove();
        this.container.classList.remove("dodging", "spectating", "duel-winner", "duel-loser");
        this.container.classList.add(side === "fighter" ? "duelist" : "spectating");
        this.bubble.textContent = (side === "fighter" ? "⚔️ " : "🍿 ") + shortName(this.name);
        this.setState(side === "fighter" ? "duel-ready" : "spectator");
        this.anim.play("idle");
        this.moveToArena(x);
        this.setMirror(x < 50 ? 1 : -1);
    }

    startDuelThrow() {
        this.setState("duel-throw");
        this.duelShotReleased = false;
        this.duelShotAt = performance.now();
        this.anim.play("throw");
    }

    updateDuelThrow(now) {
        if (!duel || (duel.a !== this && duel.b !== this)) return;
        const elapsed = (now - this.duelShotAt) / 1000;
        if (!this.duelShotReleased && (this.anim.clipTime("throw") >= this.anim.releaseTime || elapsed >= 1.9)) {
            this.duelShotReleased = true;
            new Ball(this, { duel: true, winner: duel.winner === this,
                target: duel.winner === this ? duel.loser : null });
        }
        if (this.anim.clipEnded("throw") || elapsed >= CLIP_LEN.throw + 0.5) {
            this.setState("duel-ready");
            this.anim.play("idle");
        }
    }

    startWalk() {
        this.stopWalk();
        this.setState("walk");

        const loops = 3 + Math.floor(Math.random() * 4);
        const duration = loops * CLIP_LEN.walk * 1000;
        const speed = 4 * Math.sqrt(settings.size / 35) * (settings.walkSpeed / 10);
        const total = speed * duration / 1000;
        const b = walkBounds();

        let x = clamp(this.posX, b.min, b.max);
        let dir = Math.random() < 0.5 ? 1 : -1;
        if (x <= b.min + 2) dir = 1;
        else if (x >= b.max - 2) dir = -1;

        const segs = [];
        const frames = [{ transform: containerTransform(x), offset: 0 }];
        let left = total;
        let travelled = 0;
        let guard = 0;

        while (left > 0.0001 && b.max > b.min && guard < 60) {
            guard += 1;
            const wall = dir === 1 ? b.max : b.min;
            const toWall = Math.abs(wall - x);
            const step = Math.min(left, toWall);
            const nx = x + step * dir;
            const t0 = travelled / total * duration;
            travelled += step;
            left -= step;
            const t1 = travelled / total * duration;
            segs.push({ t0, t1, x0: x, x1: nx, dir });
            frames.push({ transform: containerTransform(nx), offset: clamp(travelled / total, 0, 1) });
            x = nx;
            if (left > 0.0001) dir = -dir;
        }

        if (!segs.length) {
            segs.push({ t0: 0, t1: duration, x0: x, x1: x, dir });
            frames.push({ transform: containerTransform(x), offset: 1 });
        }
        frames[frames.length - 1].offset = 1;

        this.setX(segs[0].x0);
        this.setMirror(segs[0].dir);
        this.anim.play("walk");

        const anim = this.container.animate(frames, { duration, fill: "forwards", easing: "linear" });
        const walk = { anim, segs, duration, endX: x };
        this.walk = walk;
        const token = this.token;
        anim.onfinish = () => {
            if (this.token === token && this.walk === walk) this.finishWalk();
        };
    }

    finishWalk() {
        const w = this.walk;
        if (!w) return;
        this.walk = null;
        this.setX(w.endX);
        w.anim.cancel();
        this.startIdle();
    }

    followWalk() {
        const s = this.walkSegment();
        if (s && s.dir !== this.dir) this.setMirror(s.dir);
        if (this.walk && this.walkTime() >= this.walk.duration) this.finishWalk();
    }

    startIdle() {
        this.stopWalk();
        this.setState("idle");
        this.anim.play("idle");
        const token = this.token;
        this.timer = setTimeout(() => {
            if (this.token === token) this.startWalk();
        }, CLIP_LEN.idle * 1000);
    }

    startThrow(target) {
        this.stopWalk();
        const me = this.bodyX();
        let dir = this.dir;
        if (target && target !== this && target.isTargetable()) {
            const d = target.bodyX() - me;
            if (Math.abs(d) > 0.3) dir = d > 0 ? 1 : -1;
        } else if (!nearestTarget(this, dir) && nearestTarget(this, -dir)) {
            dir = -dir;
        }
        this.setMirror(dir);
        this.setState("throw");
        this.shot = { released: false, result: null, ball: null, startedAt: performance.now(), endedAt: 0 };
        this.anim.play("throw");
        ensureLoop();
    }

    updateThrow(now) {
        const s = this.shot;
        if (!s) return;
        if (!s.released && this.anim.clipTime("throw") >= this.anim.releaseTime) {
            s.released = true;
            s.ball = new Ball(this);
        }
        if (s.released && this.anim.clipEnded("throw")) {
            this.setState("aftermath");
            s.endedAt = now;
        } else if (now - s.startedAt > 7000) {
            this.startIdle();
        }
    }

    updateAftermath(now) {
        const s = this.shot;
        if (!s || s.result === "miss" || now - s.endedAt > 1500) {
            this.startIdle();
            return;
        }
        if (s.result === "hit") this.startDance();
    }

    onBallResult(ball, result) {
        if (this.shot && this.shot.ball === ball && !this.shot.result) this.shot.result = result;
    }

    startDance() {
        this.stopWalk();
        this.setState("dance");
        this.danceAt = performance.now();
        this.anim.play("dance");
    }

    updateDance(now) {
        if (this.anim.clipEnded("dance") || now - this.danceAt > CLIP_LEN.dance * 1000 + 2000) this.startWalk();
    }

    getHit() {
        if (!this.isTargetable()) return false;
        this.stopWalk();
        this.setState("hit");
        this.hitAt = performance.now();
        this.shot = null;
        this.survive = settings.hitSurvive;
        clearTimeout(this.lifeTimer);
        this.lifeLeft = Math.max(0, this.lifeEnd - performance.now());
        this.anim.play("hit");
        if (!this.survive) {
            gingers.delete(this.id);
            dying.add(this);
        }
        ensureLoop();
        return true;
    }

    updateHit(now) {
        if (!this.survive) {
            if (this.anim.clipTime("hit") >= HIT_FADE_AT || now - this.hitAt > 3200) this.remove("hit");
            return;
        }
        if (this.anim.clipEnded("hit") || now - this.hitAt > 4000) {
            this.setState("revive");
            const token = this.token;
            this.anim.revive(ok => {
                if (this.token !== token) return;
                if (!ok) {
                    this.remove("hit");
                    return;
                }
                const ms = Math.max(this.lifeLeft, 5000);
                this.lifeEnd = performance.now() + ms;
                this.lifeTimer = setTimeout(() => this.remove("lifetime"), ms);
                this.startIdle();
            });
        }
    }

    update(now) {
        this.anim.update(now);
        if (this.state === "walk") this.followWalk();
        else if (this.state === "throw") this.updateThrow(now);
        else if (this.state === "aftermath") this.updateAftermath(now);
        else if (this.state === "dance") this.updateDance(now);
        else if (this.state === "duel-throw") this.updateDuelThrow(now);
        else if (this.state === "hit") this.updateHit(now);
    }

    remove(reason) {
        if (this.state === "dead") return;
        if (duel && (duel.a === this || duel.b === this)) stopDuel();
        this.container.classList.remove("dodging", "duelist", "spectating", "duel-winner", "duel-loser");
        this.stopArenaMove();
        this.stopWalk();
        this.setState("dead");
        clearTimeout(this.lifeTimer);
        gingers.delete(this.id);
        dying.add(this);
        this.anim.halt();
        this.container.classList.remove("visible");
        if (reason !== "hit") removeBallsOf(this);
        setTimeout(() => {
            this.anim.destroy();
            this.container.remove();
            dying.delete(this);
        }, 450);
        ensureLoop();
    }
}

class Ball {
    constructor(owner, options = {}) {
        this.owner = owner;
        this.duelOnly = !!options.duel;
        this.duelWinner = !!options.winner;
        this.duelTarget = options.target || null;
        this.done = false;
        this.disposed = false;

        const W = frameSize();
        const width = viewW();
        this.W = W;
        this.r = ART.ballR * W;
        this.dir = owner.dir;
        this.x0 = owner.bodyX() / 100 * width + this.dir * ART.ballDX * W;
        this.y0 = ART.ballY * W;
        this.vx = BALL_SPEED / 100 * width;

        this.build();
        balls.add(this);
        ensureLoop();
    }

    at(t) {
        return { x: this.x0 + this.dir * this.vx * t, y: this.y0 };
    }

    exitTime() {
        const margin = this.r * 3 + 20;
        const dist = this.dir > 0 ? viewW() + margin - this.x0 : this.x0 + margin;
        return Math.max(0.05, dist / this.vx);
    }

    build() {
        const W = this.W;
        const k = W / 400;
        const wrap = document.createElement("div");
        wrap.className = "snowball-wrap";
        const ball = document.createElement("div");
        ball.className = "snowball";
        ball.style.width = (BALL_BOX.w * k) + "px";
        ball.style.height = (BALL_BOX.h * k) + "px";
        ball.style.left = (-(BALL_BOX.cx - BALL_BOX.x) * k) + "px";
        ball.style.top = (-(BALL_BOX.cy - BALL_BOX.y) * k) + "px";
        ball.style.backgroundImage = "url(\"" + SNOWBALL_URL + "\")";
        ball.style.backgroundSize = W + "px " + W + "px";
        ball.style.backgroundPosition = (-BALL_BOX.x * k) + "px " + (-BALL_BOX.y * k) + "px";
        this.sx = this.dir === -1 ? -1 : 1;
        ball.style.transform = "scale(" + this.sx + ", 1)";
        if (this.owner.hue) ball.style.filter = "hue-rotate(" + this.owner.hue + "deg)";
        wrap.appendChild(ball);

        this.end = this.exitTime();
        const from = this.at(0);
        const to = this.at(this.end);
        const frames = [
            { transform: "translate(" + from.x.toFixed(2) + "px, " + (-from.y).toFixed(2) + "px)", opacity: 1 },
            { transform: "translate(" + to.x.toFixed(2) + "px, " + (-to.y).toFixed(2) + "px)", opacity: 1 }
        ];

        this.el = wrap;
        this.ball = ball;
        this.lastX = this.x0;
        this.flight = wrap.animate(frames, { duration: this.end * 1000, easing: "linear", fill: "both" });
        document.body.appendChild(wrap);
    }

    update() {
        if (this.done) return;
        const ct = this.flight.currentTime;
        const t = clamp((ct === null || ct === undefined ? 0 : Number(ct)) / 1000, 0, this.end);
        const p = this.at(t);
        const width = viewW();
        const W = this.W;
        const prevX = this.lastX;
        this.lastX = p.x;

        // During a duel, visually animate both throws but only the RNG winner's
        // snowball can land. Spectators cannot be hit.
        if (this.duelOnly) {
            if (!duel || duel.phase !== "shooting") { this.finish("miss"); return; }
            if (this.duelWinner && this.duelTarget && this.duelTarget.state !== "dead") {
                const center = this.duelTarget.bodyX() / 100 * width;
                if ((p.x - center) * this.dir >= 0) {
                    this.finish("hit");
                    resolveDuel(duel);
                    return;
                }
            }
            if (t >= this.end - 0.001 || this.flight.playState === "finished") {
                this.finish("miss");
            }
            return;
        }

        // A snowball already aimed at a character must pass through if they dodge.
        if (this.target && !this.target.isTargetable()) this.target = null;

        if (!this.target) {
            const lo = Math.min(prevX, p.x);
            const hi = Math.max(prevX, p.x);
            let bestD = Infinity;
            gingers.forEach(g => {
                if (g === this.owner || !g.isTargetable()) return;
                const gb = g.bodyX() / 100 * width;
                const half = ART.hitHalf * W + this.r;
                const left = gb - half;
                const right = gb + half;
                if (hi < left || lo > right) return;
                const cx = this.dir > 0 ? Math.max(prevX, left) : Math.min(prevX, right);
                const d = Math.abs(cx - prevX);
                if (d < bestD) {
                    bestD = d;
                    this.target = g;
                }
            });
        }

        if (this.target) {
            const center = this.target.bodyX() / 100 * width;
            const step = this.vx / 60;
            const past = (p.x - center) * this.dir;
            if (past >= -step / 2 || t >= this.end - 0.001) {
                const snapTo = past > step ? clamp((center - this.x0) / (this.dir * this.vx), 0, this.end) : -1;
                this.burst(this.target, snapTo);
            }
            return;
        }

        if (t >= this.end - 0.001 || this.flight.playState === "finished") this.finish("miss");
    }

    burst(target, snapTo) {
        this.done = true;
        this.flight.pause();
        if (snapTo >= 0) this.flight.currentTime = snapTo * 1000;
        this.pop = this.ball.animate([
            { transform: "scale(" + this.sx + ", 1)", opacity: 1 },
            { transform: "scale(" + (1.3 * this.sx) + ", 1.3)", opacity: 0 }
        ], { duration: 60, easing: "ease-out", fill: "forwards" });
        this.pop.onfinish = () => this.dispose();
        setTimeout(() => this.dispose(), 400);
        const hit = target.getHit();
        this.owner.onBallResult(this, hit ? "hit" : "miss");
    }

    finish(result) {
        this.done = true;
        this.dispose();
        this.owner.onBallResult(this, result);
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.done = true;
        this.el.style.display = "none";
        this.el.remove();
        balls.delete(this);
    }
}

function removeBallsOf(owner) {
    balls.forEach(b => {
        if (b.owner === owner) b.dispose();
    });
}

function ensureLoop() {
    if (loopOn) return;
    loopOn = true;
    requestAnimationFrame(tick);
}

function tick(now) {
    gingers.forEach(g => g.update(now));
    dying.forEach(g => g.update(now));
    balls.forEach(b => b.update(now));
    if (gingers.size || dying.size || balls.size) {
        requestAnimationFrame(tick);
        return;
    }
    loopOn = false;
    animationIdle();
}

function findByUser(id) {
    let found = null;
    gingers.forEach(g => {
        if (g.userId === id) found = g;
    });
    return found;
}

function findByName(name) {
    const n = String(name || "").toLowerCase();
    if (!n) return null;
    let found = null;
    gingers.forEach(g => {
        if (g.login === n || String(g.name).toLowerCase() === n) found = g;
    });
    return found;
}

function findTarget(msg, data) {
    const tags = data.tags || {};
    const replyId = tags["reply-parent-user-id"];
    if (replyId) {
        const g = findByUser(String(replyId));
        if (g) return g;
    }
    if (msg.arg) return findByName(msg.arg);
    return null;
}

function spawnFor(user) {
    if (duel) return null;
    if (findByUser(user.id)) {
        findByUser(user.id).pulse();
        return null;
    }
    if (gingers.size >= settings.maxCount) {
        if (settings.whenFull !== "replace") return null;
        let oldest = null;
        gingers.forEach(g => {
            if (!oldest || g.spawnedAt < oldest.spawnedAt) oldest = g;
        });
        if (oldest) oldest.remove("replace");
    }
    const g = new Ginger(user);
    gingers.set(g.id, g);
    g.spawn();
    return g;
}

function throwFor(user, target) {
    if (duel) return;
    const g = findByUser(user.id);
    if (!g || !g.canThrow()) return;
    const now = Date.now();
    if (now < globalThrowUntil) return;
    if (userThrowUntil[user.id] && now < userThrowUntil[user.id]) return;
    g.startThrow(target);
    if (settings.globalCd > 0) globalThrowUntil = now + settings.globalCd * 1000;
    if (settings.userCd > 0) userThrowUntil[user.id] = now + settings.userCd * 1000;
}

function dodgeFor(user) {
    if (duel) return;
    const g = findByUser(user.id);
    if (!g || !g.canDodge()) return;
    const now = Date.now();
    if (userDodgeUntil[user.id] && now < userDodgeUntil[user.id]) return;
    if (g.startDodge() && settings.dodgeCd > 0) {
        userDodgeUntil[user.id] = now + settings.dodgeCd * 1000;
    }
}

// !dance reuses the original 3-second sprite sheet.
function danceFor(user) {
    if (duel) return;
    const g = findByUser(user.id);
    if (!g || !g.canThrow()) return;
    const now = Date.now();
    if (userDanceUntil[user.id] && now < userDanceUntil[user.id]) return;
    g.startDance();
    if (settings.danceCd > 0) userDanceUntil[user.id] = now + settings.danceCd * 1000;
}

function showDuelBanner(text, result = false) {
    if (!duelBanner) {
        duelBanner = document.createElement("div");
        duelBanner.className = "gb-duel-banner";
        duelBanner.setAttribute("role", "status");
        document.body.appendChild(duelBanner);
    }
    duelBanner.textContent = text;
    duelBanner.classList.toggle("result", result);
    duelBanner.style.display = text ? "block" : "none";
}

function duelLater(d, fn, ms) {
    const id = setTimeout(() => { if (duel === d) fn(); }, ms);
    d.timers.push(id);
}

function duelPositions(n) {
    const bounds = walkBounds();
    const gap = clamp(frameVw() * 1.2, 20, 30);
    const leftFighter = clamp(50 - gap / 2, bounds.min, bounds.max);
    const rightFighter = clamp(50 + gap / 2, bounds.min, bounds.max);
    const crowdMargin = Math.max(frameVw() * 0.55, 6);
    const leftEnd = Math.max(bounds.min, leftFighter - crowdMargin);
    const rightEnd = Math.min(bounds.max, rightFighter + crowdMargin);
    const leftN = Math.ceil(n / 2);
    const rightN = Math.floor(n / 2);
    const spots = [];
    for (let i = 0; i < n; i++) {
        const onLeft = i % 2 === 0;
        const index = Math.floor(i / 2);
        const count = onLeft ? leftN : rightN;
        const fraction = (index + 0.5) / Math.max(1, count);
        spots.push(onLeft
            ? bounds.min + (leftEnd - bounds.min) * fraction
            : bounds.max - (bounds.max - rightEnd) * fraction);
    }
    return { leftFighter, rightFighter, spots };
}

function startDuel(a, b) {
    if (duel || Date.now() < nextDuelAt) return false;
    if (!a || !b || a === b || !gingers.has(a.id) || !gingers.has(b.id)) return false;
    const allowed = g => g.visible && ["walk", "idle", "dance"].includes(g.state);
    if (!allowed(a) || !allowed(b)) return false;

    const spectators = Array.from(gingers.values()).filter(g => g !== a && g !== b && g.visible);
    const layout = duelPositions(spectators.length);
    const winner = Math.random() < 0.5 ? a : b; // fair 50/50, no stats advantage
    const d = { a, b, winner, loser: winner === a ? b : a,
        spectators, phase: "enter", timers: [] };
    duel = d;
    nextDuelAt = Date.now() + settings.duelCd * 1000;

    // Stop stray throws from hitting the crowd or changing the predetermined result.
    balls.forEach(ball => ball.dispose());
    spectators.forEach((g, i) => g.prepareDuel(layout.spots[i], "spectator"));
    a.prepareDuel(layout.leftFighter, "fighter");
    b.prepareDuel(layout.rightFighter, "fighter");
    showDuelBanner("⚔️ " + shortName(a.name) + " VS " + shortName(b.name));
    duelLater(d, () => showDuelBanner("3"), DUEL_MOVE_MS);
    duelLater(d, () => showDuelBanner("2"), DUEL_MOVE_MS + 700);
    duelLater(d, () => showDuelBanner("1"), DUEL_MOVE_MS + 1400);
    duelLater(d, () => {
        d.phase = "shooting";
        showDuelBanner("❄️ THROW!");
        a.startDuelThrow();
        b.startDuelThrow();
        // Safe ending even when images are blocked or the overlay is backgrounded.
        duelLater(d, () => resolveDuel(d), DUEL_SHOT_TIMEOUT_MS);
    }, DUEL_MOVE_MS + 2100);
    return true;
}

function resolveDuel(d) {
    if (duel !== d || d.phase !== "shooting") return;
    d.phase = "result";
    balls.forEach(ball => { if (ball.duelOnly) ball.dispose(); });
    d.winner.setState("duel-winner");
    d.winner.container.classList.add("duel-winner");
    d.winner.bubble.textContent = "🏆 " + shortName(d.winner.name);
    d.winner.anim.play("dance");
    d.loser.setState("duel-loser");
    d.loser.container.classList.add("duel-loser");
    d.loser.bubble.textContent = "💫 " + shortName(d.loser.name);
    d.loser.anim.play("hit");
    showDuelBanner("🏆 " + shortName(d.winner.name) + " WINS!", true);
    duelLater(d, stopDuel, DUEL_CELEBRATE_MS);
}

function stopDuel() {
    if (!duel) return;
    const d = duel;
    duel = null;
    d.timers.forEach(id => clearTimeout(id));
    balls.forEach(ball => { if (ball.duelOnly) ball.dispose(); });
    showDuelBanner("");
    [d.a, d.b, ...d.spectators].forEach(g => {
        if (g.state === "dead" || !gingers.has(g.id)) return;
        g.stopArenaMove();
        g.container.classList.remove("duelist", "spectating", "duel-winner", "duel-loser");
        g.bubble.textContent = shortName(g.name);
        g.startWalk();
    });
}

function duelFor(user, target) {
    if (duel || Date.now() < nextDuelAt) return;
    const challenger = findByUser(user.id);
    if (!challenger || !target || challenger === target) return;
    startDuel(challenger, target);
}

function clearAll() {
    stopDuel();
    gingers.forEach(g => g.remove("clear"));
    dying.forEach(g => g.remove("clear"));
    balls.forEach(b => b.dispose());
}

function removeUserId(id) {
    const g = findByUser(id);
    if (g) g.remove("ban");
}

function testUser() {
    testCount += 1;
    return { id: "gb-test-" + testCount, login: "testviewer" + testCount, name: "TestViewer" + testCount };
}

function testThrow() {
    let added = false;
    while (gingers.size < 2 && gingers.size < settings.maxCount) {
        if (!spawnFor(testUser())) break;
        added = true;
    }
    const go = () => {
        const list = [];
        gingers.forEach(g => {
            if (g.canThrow() && g.visible) list.push(g);
        });
        if (!list.length) return;
        list[Math.floor(Math.random() * list.length)].startThrow(null);
    };
    if (added) setTimeout(go, 1500);
    else go();
}

function testDance() {
    if (duel) return;
    const g = Array.from(gingers.values()).find(g => g.canThrow());
    if (g) g.startDance();
    else if (gingers.size < settings.maxCount) {
        const fresh = spawnFor(testUser());
        if (fresh) setTimeout(() => { if (fresh.canThrow()) fresh.startDance(); }, 1500);
    }
}

function testDuel() {
    if (duel) return;
    // Test duel bypasses only the global cooldown; it still uses the actual duel logic.
    const added = [];
    while (gingers.size < 2 && gingers.size < settings.maxCount) {
        const g = spawnFor(testUser());
        if (!g) break;
        added.push(g);
    }
    const go = () => {
        const ready = Array.from(gingers.values()).filter(g => g.visible && ["walk", "idle", "dance"].includes(g.state));
        if (ready.length >= 2) {
            nextDuelAt = 0;
            startDuel(ready[0], ready[1]);
        }
    };
    if (added.length) setTimeout(go, 1500);
    else go();
}

function testDodge() {
    let g = null;
    gingers.forEach(candidate => {
        if (!g && candidate.canDodge()) g = candidate;
    });
    if (g) {
        g.startDodge();
        return;
    }
    if (gingers.size >= settings.maxCount) return;
    g = spawnFor(testUser());
    if (g) setTimeout(() => { if (g.canDodge()) g.startDodge(); }, 1500);
}

function handleButton(field) {
    if (field === "testSpawn") spawnFor(testUser());
    else if (field === "testThrow") testThrow();
    else if (field === "testDodge") testDodge();
    else if (field === "testDance") testDance();
    else if (field === "testDuel") testDuel();
    else if (field === "testClear") clearAll();
}

function handleMessage(data) {
    const msg = parseMessage(data);
    if (!msg.cmd) return;
    const isClear = settings.clearCmds.includes(msg.cmd);
    const isSpawn = !isClear && settings.spawnCmds.includes(msg.cmd);
    const isThrow = !isClear && !isSpawn && settings.throwCmds.includes(msg.cmd);
    const isDodge = !isClear && !isSpawn && !isThrow && settings.dodgeCmds.includes(msg.cmd);
    const isDance = !isClear && !isSpawn && !isThrow && !isDodge && settings.danceCmds.includes(msg.cmd);
    const isDuel = !isClear && !isSpawn && !isThrow && !isDodge && !isDance && settings.duelCmds.includes(msg.cmd);
    if (!isClear && !isSpawn && !isThrow && !isDodge && !isDance && !isDuel) return;

    // Only authorized clear commands can interrupt the arena.
    if (isClear) {
        if (!isAllowed(data, settings.permClear)) return;
        if (msg.arg) {
            const g = findByName(msg.arg);
            if (g) g.remove("clear");
        } else clearAll();
        return;
    }
    if (duel) return;

    const user = identify(data);
    if (isSpawn) {
        if (isAllowed(data, settings.permSpawn)) spawnFor(user);
    } else if (isDodge) {
        if (isAllowed(data, settings.permDodge)) dodgeFor(user);
    } else if (isDance) {
        if (isAllowed(data, settings.permDance)) danceFor(user);
    } else if (isDuel) {
        if (isAllowed(data, settings.permDuel)) duelFor(user, findTarget(msg, data));
    } else if (isAllowed(data, settings.permThrow)) {
        throwFor(user, findTarget(msg, data));
    }
}

function pruneCooldowns() {
    const now = Date.now();
    Object.keys(userThrowUntil).forEach(k => {
        if (userThrowUntil[k] < now) delete userThrowUntil[k];
    });
    Object.keys(userDodgeUntil).forEach(k => {
        if (userDodgeUntil[k] < now) delete userDodgeUntil[k];
    });
    Object.keys(userDanceUntil).forEach(k => {
        if (userDanceUntil[k] < now) delete userDanceUntil[k];
    });
}

window.addEventListener("onWidgetLoad", function (obj) {
    const detail = obj.detail || {};
    loadSettings(detail.fieldData || {});
    applyStyle();
    warmAssets();
    prepareAnimationAssets();
    setInterval(pruneCooldowns, 60000);
});

window.addEventListener("onEventReceived", function (obj) {
    const detail = obj.detail || {};
    const listener = detail.listener;
    const event = detail.event || {};
    if (listener === "message") {
        handleMessage(event.data || {});
    } else if (listener === "delete-messages") {
        const uid = event.userId || (event.data && event.data.userId);
        if (uid) removeUserId(String(uid));
    } else if (listener === "widget-button" || listener === "event:test") {
        if (listener === "widget-button" || event.listener === "widget-button") {
            handleButton(event.field || detail.field);
        }
    }
});

const ANIM_KIND = "sprite";
const SHEET_META = {"frameSize":400,"cropX":46,"cropY":6,"cellW":306,"cellH":394,"gutter":4,"clips":{"walk":{"frames":90,"cells":90,"cols":13,"rows":7,"map":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89]},"idle":{"frames":90,"cells":24,"cols":13,"rows":2,"map":[0,1,2,3,4,5,6,6,6,6,7,8,8,8,8,8,8,8,8,8,9,10,10,10,10,10,10,10,10,10,11,12,12,12,12,12,12,12,12,12,13,13,13,13,13,13,13,13,13,13,14,14,14,14,14,14,14,15,16,17,18,19,19,19,19,19,19,19,19,19,20,21,21,21,21,21,21,21,21,21,22,23,23,23,23,23,23,23,23,23]},"throw":{"frames":77,"cells":77,"cols":13,"rows":6,"map":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76]},"hit":{"frames":73,"cells":37,"cols":13,"rows":3,"map":[0,1,2,3,4,5,6,7,8,9,10,11,12,12,12,12,12,12,12,12,13,14,15,15,15,15,16,17,18,19,20,21,22,23,24,25,26,27,28,28,29,30,30,30,30,30,30,30,31,31,32,32,32,32,32,32,32,32,32,32,33,34,34,34,34,34,34,34,34,34,35,36,36]},"dance":{"frames":90,"cells":47,"cols":13,"rows":4,"map":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,35,35,35,35,36,37,37,37,37,37,37,37,37,37,38,38,38,38,38,38,38,39,40,41,42,42,42,42,42,42,42,42,42,42,43,44,44,44,44,44,44,44,44,44,45,46,46,46,46,46,46,46,46,46]}}};
const SHEET_URLS = {"walk":"https://cdn.streamelements.com/uploads/01m45wbzpnnjvpczyep1nq8xpa.webp","idle":"https://cdn.streamelements.com/uploads/01m45wbykd69d7nb0ydqdb4j2r.webp","throw":"https://cdn.streamelements.com/uploads/01m45wbzgm9hf4x5sj0c8jcb51.webp","hit":"https://cdn.streamelements.com/uploads/01m45wbzfffh7kzmemx3fwcckd.webp","dance":"https://cdn.streamelements.com/uploads/01m45wbzhvw46kmj5e3t9bpgtp.webp"};

const sheetStore = {
    state: "empty",
    scale: 0,
    frame: 0,
    cw: 0,
    ch: 0,
    pitchX: 0,
    pitchY: 0,
    offX: 0,
    offY: 0,
    bitmaps: null,
    loading: false,
    failed: "",
    releaseTimer: null
};

let sheetWarning = null;

const spriteTick = now => Math.floor(now * 0.03);

function showSheetWarning(text) {
    if (!text) {
        if (sheetWarning) sheetWarning.style.display = "none";
        return;
    }
    if (!sheetWarning) {
        sheetWarning = document.createElement("div");
        sheetWarning.className = "gb-warning";
        document.body.appendChild(sheetWarning);
    }
    sheetWarning.textContent = text;
    sheetWarning.style.display = "block";
}

function prepareAnimationAssets() {
    Object.values(SHEET_URLS).forEach(url => {
        fetch(url, { mode: "cors" }).then(r => r.arrayBuffer()).catch(() => {});
    });
}

function targetSheetScale() {
    return Math.min(1, frameSize() / SHEET_META.frameSize);
}

async function buildSheets(urls, scale) {
    const m = SHEET_META;
    const native = scale > 0.999;
    const fullPitchX = m.cellW + m.gutter;
    const fullPitchY = m.cellH + m.gutter;
    const pitchX = native ? fullPitchX : Math.max(2, Math.round(fullPitchX * scale));
    const pitchY = native ? fullPitchY : Math.max(2, Math.round(fullPitchY * scale));
    const kx = pitchX / fullPitchX;
    const ky = pitchY / fullPitchY;
    const bitmaps = {};

    for (let i = 0; i < CLIP_TYPES.length; i++) {
        const type = CLIP_TYPES[i];
        const clip = m.clips[type];
        const resp = await fetch(urls[type], { mode: "cors" });
        if (!resp.ok) throw new Error(type + " sheet HTTP " + resp.status);
        const blob = await resp.blob();
        bitmaps[type] = native
            ? await createImageBitmap(blob)
            : await createImageBitmap(blob, { resizeWidth: clip.cols * pitchX, resizeHeight: clip.rows * pitchY, resizeQuality: "high" });
    }

    return {
        bitmaps,
        scale,
        frame: native ? m.frameSize : Math.round(m.frameSize * scale),
        cw: native ? m.cellW : Math.floor(m.cellW * kx),
        ch: native ? m.cellH : Math.floor(m.cellH * ky),
        pitchX,
        pitchY,
        offX: native ? m.cropX : Math.round(m.cropX * scale),
        offY: native ? m.cropY : Math.round(m.cropY * scale)
    };
}

function freeSheet(b) {
    try {
        if (b.close) b.close();
        else {
            b.width = 0;
            b.height = 0;
        }
    } catch (e) {}
}

function releaseSheets() {
    if (sheetStore.bitmaps) Object.values(sheetStore.bitmaps).forEach(freeSheet);
    sheetStore.bitmaps = null;
    sheetStore.state = "empty";
    sheetStore.scale = 0;
}

function ensureSheets() {
    clearTimeout(sheetStore.releaseTimer);
    sheetStore.releaseTimer = null;
    const want = targetSheetScale();
    if (sheetStore.state === "ready" && Math.abs(sheetStore.scale - want) <= want * 0.02) return;
    if (sheetStore.loading) return;
    sheetStore.loading = true;
    buildSheets(SHEET_URLS, want).then(res => {
        const old = sheetStore.bitmaps;
        Object.assign(sheetStore, res, { state: "ready", loading: false, failed: "" });
        if (old) Object.values(old).forEach(freeSheet);
        showSheetWarning("");
    }).catch(err => {
        sheetStore.loading = false;
        sheetStore.failed = String(err && err.message ? err.message : err);
        showSheetWarning("GINGERBREAD: could not load the animation sheets (" + sheetStore.failed + ").");
    });
}

function animationIdle() {
    clearTimeout(sheetStore.releaseTimer);
    sheetStore.releaseTimer = setTimeout(() => {
        if (!gingers.size && !dying.size && !sheetStore.loading) releaseSheets();
    }, 60000);
}

class Animator {
    constructor(ginger) {
        this.g = ginger;
        this.dead = false;
        this.canvas = document.createElement("canvas");
        this.canvas.className = "ginger-canvas";
        this.canvas.width = 1;
        this.canvas.height = 1;
        this.ctx = this.canvas.getContext("2d");
        ginger.container.appendChild(this.canvas);

        this.type = null;
        this.g0 = 0;
        this.pending = null;
        this.drawnKey = "";
        this.revealedFor = -1;
        this.lastNow = performance.now();
        this.reviving = null;
        this.req = {};
        this.started = {};
        this.releaseTime = 56 / 30 - 0.0001;

        CLIP_TYPES.forEach(t => {
            this.req[t] = 0;
            this.started[t] = -1;
        });

        ensureSheets();
    }

    setHue(deg) {
        this.canvas.style.filter = "hue-rotate(" + deg + "deg)";
    }

    setMirror(dir) {
        this.canvas.classList.toggle("mirror", dir === -1);
    }

    play(type) {
        if (this.dead) return;
        this.req[type] += 1;
        this.reviving = null;
        if (sheetStore.state !== "ready") {
            this.pending = type;
            ensureSheets();
            return;
        }
        this.start(type, this.lastNow);
    }

    start(type, now) {
        this.pending = null;
        this.type = type;
        this.started[type] = this.req[type];
        this.g0 = spriteTick(now) + 1;
    }

    frameIndex() {
        return spriteTick(this.lastNow) - this.g0;
    }

    clipTime(type) {
        if (this.type !== type || this.started[type] !== this.req[type]) return 0;
        return Math.max(0, this.frameIndex()) / 30;
    }

    clipEnded(type) {
        if (this.type !== type || this.started[type] !== this.req[type]) return false;
        return this.frameIndex() >= SHEET_META.clips[type].frames;
    }

    revive(done) {
        if (this.dead) return;
        this.reviving = { at: null, done };
    }

    drawCell(type, cell, alpha, clear) {
        const st = sheetStore;
        const clip = SHEET_META.clips[type];
        if (this.canvas.width !== st.frame) {
            this.canvas.width = st.frame;
            this.canvas.height = st.frame;
        }
        const ctx = this.ctx;
        if (clear) ctx.clearRect(0, 0, st.frame, st.frame);
        const col = cell % clip.cols;
        const row = Math.floor(cell / clip.cols);
        ctx.globalAlpha = alpha;
        ctx.drawImage(st.bitmaps[type], col * st.pitchX, row * st.pitchY, st.cw, st.ch, st.offX, st.offY, st.cw, st.ch);
        ctx.globalAlpha = 1;
    }

    update(now) {
        this.lastNow = now;
        if (this.dead || sheetStore.state !== "ready") return;
        if (this.pending) this.start(this.pending, now);

        if (this.reviving) {
            const r = this.reviving;
            if (r.at === null) r.at = now;
            const p = Math.min(1, (now - r.at) / 700);
            const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
            const hit = SHEET_META.clips.hit;
            this.drawCell("idle", SHEET_META.clips.idle.map[0], 1, true);
            this.drawCell("hit", hit.map[hit.frames - 1], 1 - e, false);
            this.drawnKey = "";
            if (p >= 1) {
                this.reviving = null;
                r.done(true);
            }
            return;
        }

        if (!this.type) return;
        const clip = SHEET_META.clips[this.type];
        let f = this.frameIndex();
        if (f < 0) {
            if (this.drawnKey) return;
            f = 0;
        }
        f = CLIP_LOOP[this.type] ? f % clip.frames : Math.min(f, clip.frames - 1);
        const cell = clip.map[f];
        const key = this.type + ":" + cell + ":" + sheetStore.frame;
        if (key === this.drawnKey) return;
        this.drawnKey = key;
        this.drawCell(this.type, cell, 1, true);
        if (this.revealedFor !== this.started[this.type]) {
            this.revealedFor = this.started[this.type];
            this.g.onReveal(this.type);
        }
    }

    halt() {
        this.dead = true;
    }

    destroy() {
        this.dead = true;
        this.canvas.width = 0;
        this.canvas.height = 0;
    }
}