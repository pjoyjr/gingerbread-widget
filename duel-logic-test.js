// Dependency-free Node.js behavior test; not a substitute for a live sprite rendering test.
const fs=require('node:fs'), path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(path.join(__dirname,'some.js'),'utf8');
const fieldData=JSON.parse(fs.readFileSync(path.join(__dirname,'current-settings.json'),'utf8'));
let now=1000, timerId=0;
const timers=new Map(), handlers={};
function element(tag) {
 const classes=new Set();
 return {
  tagName:tag, style:{setProperty(name,value){this[name]=value}}, width:1,height:1,
  className:'',textContent:'',children:[],
  classList:{add(...names){names.forEach(x=>classes.add(x))}, remove(...names){names.forEach(x=>classes.delete(x))},toggle(name,v){if(v)classes.add(name);else classes.delete(name)},contains(name){return classes.has(name)}},
  appendChild(child){this.children.push(child);}, setAttribute(){}, remove(){},
  animate(){return {currentTime:0,duration:0,cancel(){},pause(){},playState:'running',onfinish:null}},
  getContext(){return {clearRect(){},drawImage(){},globalAlpha:1}},decode(){return Promise.resolve()}
 };
}
const ctx=vm.createContext({
 window:{innerWidth:1920,innerHeight:1080,addEventListener(type,fn){handlers[type]=fn}},
 document:{body:element('body'),head:element('head'),documentElement:{clientWidth:1920,clientHeight:1080},createElement:element,fonts:{load(){return Promise.resolve()}}},
 performance:{now:()=>now},Date:class extends Date{static now(){return now}},
 setTimeout(cb,ms){const id=++timerId;timers.set(id,{at:now+ms,cb});return id},
 clearTimeout(id){timers.delete(id)},setInterval(){},requestAnimationFrame(){},
 fetch(){return Promise.reject(Error('Offline'))},createImageBitmap(){return Promise.reject(Error('Offline'))},console,Promise
});
const run=code=>vm.runInContext(code,ctx);
function send(role,nick,text) {
 const tags={'user-id':role==='broadcaster'?'777':`${role}:${nick.toLowerCase()}`};
 if(role==='subscriber')tags.subscriber='1';if(role==='vip')tags.vip='1';
 if(role==='moderator')tags.mod='1';if(role==='broadcaster')tags['room-id']='777';
 const data={text,nick:nick.toLowerCase(),displayName:nick,tags};
 if(role==='member')data.authorDetails={isChatSponsor:true};
 handlers.onEventReceived({detail:{listener:'message',event:{data}}});
}
function advance(ms){
 const end=now+ms;
 for(;;){const due=[...timers.entries()].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];
 if(!due)break;const[id,t]=due;timers.delete(id);now=t.at;t.cb();}now=end;
}
vm.runInContext(src,ctx);handlers.onWidgetLoad({detail:{fieldData}});
assert.equal(run('settings.danceCmds[0]'),'!dance');
assert.equal(run('settings.duelCmds[0]'),'!duel');
assert.equal(run('settings.duelCd'),25);
send('viewer','NotSub','!gb');assert.equal(run('gingers.size'),0);
send('subscriber','Cocoa','!gb');send('subscriber','Latte','!gb');
send('vip','Side1','!gb');send('moderator','Side2','!gb');send('broadcaster','Side3','!gb');
assert.equal(run('gingers.size'),5);
run('gingers.forEach(g=>g.onReveal())');
send('subscriber','Cocoa','!dance');
assert.equal(run('findByName("cocoa").state'),'dance','!dance triggers existing dance clip');
assert.equal(run('findByName("cocoa").anim.pending'),'dance');
const firstToken=run('findByName("cocoa").token');
send('subscriber','Cocoa','!dance');
assert.equal(run('findByName("cocoa").token'),firstToken,'dance cooldown prevents spam');
send('viewer','NotSub','!duel @Latte');assert.equal(run('duel'),null,'viewers cannot duel');
send('subscriber','Cocoa','!duel @Nobody');assert.equal(run('duel'),null,'target must exist');
send('subscriber','Cocoa','!duel @Cocoa');assert.equal(run('duel'),null,'no self-duels');
run('Math.random=()=>0.1');
send('subscriber','Cocoa','!duel @Latte');
assert.equal(run('duel.phase'),'enter');
assert.equal(run('duel.winner.name'),'Cocoa','seeded 50/50 selects left');
assert.equal(run('duel.spectators.length'),3);
assert.equal(run('Array.from(gingers.values()).filter(g=>g.state==="spectator").length'),3);
assert.equal(run('duel.spectators.every(g => !g.isTargetable())'),true,'spectators are invulnerable');
assert.equal(run('duel.spectators.every(g => g.container.classList.contains("spectating"))'),true);
assert.equal(run('duel.spectators.every(g => g.bubble.textContent.startsWith("🍿"))'),true);
run('gingers.forEach(g=>{if(g.arenaMove)g.arenaMove.onfinish()})');
assert.equal(run('duel.a.posX < duel.b.posX'),true,'duelists face off in center');
assert.equal(run('duel.spectators.every(g => g.posX < duel.a.posX || g.posX > duel.b.posX)'),true,'crowd moves to sidelines');
send('vip','Side1','!throw');assert.equal(run('findByName("side1").state'),'spectator','throw blocked during duel');
send('subscriber','Cocoa','!dodge');assert.equal(run('duel.a.state'),'duel-ready','dodge blocked during duel');
advance(3300);assert.equal(run('duel.phase'),'shooting');
advance(1900);run('gingers.forEach(g => g.update(performance.now()))');
assert.equal(run('Array.from(balls).filter(b=>b.duelOnly).length'),2,'both players visually throw');
assert.equal(run('Array.from(balls).filter(b=>b.duelWinner).length'),1,'exactly one predetermined winner shot');
run('Array.from(balls).filter(b=>b.duelWinner).forEach(b=>{b.flight.currentTime=550;b.update()})');
assert.equal(run('duel.phase'),'result','winner ball resolves duel');
assert.equal(run('duel.winner.state'),'duel-winner');
assert.equal(run('duel.loser.state'),'duel-loser');
assert.equal(run('duelBanner.textContent.includes("Cocoa")'),true);
assert.equal(run('gingers.size'),5,'loser is not despawned');
advance(3300);
assert.equal(run('duel'),null,'duel ends and cleans up');
assert.equal(run('gingers.size'),5,'everyone returns alive');
assert.equal(run('Array.from(gingers.values()).every(g=>g.state==="walk")'),true,'movement resumes');
send('subscriber','Latte','!duel @Cocoa');assert.equal(run('duel'),null,'global duel cooldown');
advance(25100);
run('Math.random=()=>0.99');
send('subscriber','Latte','!duel @Cocoa');
assert.equal(run('duel.winner.name'),'Cocoa','other RNG branch selects right');
send('moderator','Side2','!cleargb');
assert.equal(run('duel'),null,'mod clear cancels arena timers');
assert.equal(run('gingers.size'),0,'clear removes all');
advance(10000);assert.equal(run('duel'),null,'stale callbacks cannot restart the duel');
handlers.onEventReceived({detail:{listener:'event:test',event:{listener:'widget-button',field:'testSpawn'}}});
assert.equal(run('gingers.size'),1,'test spawn continues to work');
handlers.onEventReceived({detail:{listener:'widget-button',event:{field:'testDance'}}});
assert.equal(run('Array.from(gingers.values())[0].state'),'dance','test dance button');
handlers.onEventReceived({detail:{listener:'widget-button',event:{field:'testDuel'}}});
run('gingers.forEach(g=>g.onReveal())');advance(1500);
assert.equal(run('duel.phase'),'enter','test duel button auto-spawns opponents');
console.log('PASS: !dance, cooldown, duel targeting/permissions, spectator sidelines, 50/50 RNG, dual throws, result, cleanup, spectator safety, test buttons');
