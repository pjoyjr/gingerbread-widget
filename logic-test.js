// Lightweight logic test for Gingerbread widget. Runs in Node.js, no third-party packages.
// It mocks the browser and disables remote sprite downloads; it does not test rendering.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const src = fs.readFileSync(path.join(__dirname, 'some.js'), 'utf8');
const fieldData = JSON.parse(fs.readFileSync(path.join(__dirname, 'current-settings.json'), 'utf8'));
let now = 1000;
let nextTimer = 0;
const timers = new Map();
const handlers = {};
function element(tag) {
  const classes = new Set();
  const el = {
    tagName: tag,
    style: { setProperty(name, value) { this[name] = value; } },
    className: '', textContent: '', width: 1, height: 1, children: [],
    classList: {
      add(name) { classes.add(name); },
      remove(name) { classes.delete(name); },
      toggle(name, value) { if (value) classes.add(name); else classes.delete(name); },
      contains(name) { return classes.has(name); }
    },
    appendChild(child) { this.children.push(child); },
    remove() {},
    animate() { return { currentTime: 0, duration: 0, cancel() {}, pause() {}, playState: 'running' }; },
    getContext() { return { clearRect() {}, drawImage() {}, globalAlpha: 1 }; },
    decode() { return Promise.resolve(); }
  };
  return el;
}
const ctx = vm.createContext({
  window: { innerWidth: 1920, innerHeight: 1080, addEventListener(type, fn) { handlers[type] = fn; } },
  document: { body: element('body'), head: element('head'), documentElement: {clientWidth:1920,clientHeight:1080},
    createElement: element, fonts: {load() {return Promise.resolve();}} },
  performance: { now: () => now },
  Date: class extends Date { static now() {return now;} },
  setTimeout(cb, ms) { const id = ++nextTimer; timers.set(id, {at:now + ms,cb}); return id; },
  clearTimeout(id) { timers.delete(id); },
  setInterval() {},
  requestAnimationFrame() {},
  fetch() { return Promise.reject(Error('Asset loading disabled in logic test')); },
  createImageBitmap() { return Promise.reject(Error('Disabled')); },
  console, Math, Map, Set, Promise, Object, Array, String
});
function evalJs(code) { return vm.runInContext(code, ctx); }
function send(role, nick, text) {
 const tags = {'user-id': role === 'broadcaster' ? '777' : `${role}:${nick.toLowerCase()}`};
 if (role === 'subscriber') tags.subscriber='1';
 if (role === 'vip') tags.vip='1';
 if (role === 'moderator') tags.mod='1';
 if (role === 'broadcaster') tags['room-id']='777';
 const data = {text, nick:nick.toLowerCase(), displayName:nick, tags};
 if (role === 'member') data.authorDetails = {isChatSponsor:true};
 handlers.onEventReceived({detail:{listener:'message',event:{data}}});
}
function advance(ms) {
 const end = now + ms;
 while (true) {
   const due = [...timers.entries()].filter(([,timer])=>timer.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];
   if (!due) break;
   const [id,timer]=due;
   timers.delete(id); now=timer.at; timer.cb();
 }
 now=end;
}
vm.runInContext(src, ctx);
handlers.onWidgetLoad({detail:{fieldData}});
assert.equal(evalJs('settings.dodgeCmds[0]'), '!dodge');
assert.equal(evalJs('settings.dodgeCd'), 8);
send('viewer','NoSub','!gb');
assert.equal(evalJs('gingers.size'),0,'regular viewer cannot spawn');
send('subscriber','Cocoa','!gb');
assert.equal(evalJs('gingers.size'),1,'subscriber spawns');
evalJs('gingers.forEach(g=>g.onReveal())');
send('subscriber','Cocoa','!dodge');
assert.equal(evalJs('Array.from(gingers.values())[0].state'),'dodge');
assert.equal(evalJs('Array.from(gingers.values())[0].getHit()'),false,'dodging prevents hit');
assert.equal(evalJs('Array.from(gingers.values())[0].container.classList.contains("dodging")'),true);
advance(1600);
assert.equal(evalJs('Array.from(gingers.values())[0].state'),'idle','dodge ends on time');
send('subscriber','Cocoa','!dodge');
assert.equal(evalJs('Array.from(gingers.values())[0].state'),'idle','second dodge blocked by cooldown');
advance(6401);
send('subscriber','Cocoa','!dodge');
assert.equal(evalJs('Array.from(gingers.values())[0].state'),'dodge','dodge available after cooldown');
// Pre-targeted snowballs must drop a target who becomes invulnerable.
assert.equal(evalJs('(()=>{const g=Array.from(gingers.values())[0];const b=new Ball(g);b.target=g;b.update();const ok=b.target===null;b.dispose();return ok})()'),true);
handlers.onEventReceived({detail:{listener:'widget-button',event:{field:'testClear'}}});
assert.equal(evalJs('gingers.size'),0,'direct-form test button works');
handlers.onEventReceived({detail:{listener:'event:test',event:{listener:'widget-button',field:'testSpawn'}}});
assert.equal(evalJs('gingers.size'),1,'legacy test button works');
console.log('PASS: !dodge, hit protection, expiry, cooldown, permissions, snowball target release, test buttons');
