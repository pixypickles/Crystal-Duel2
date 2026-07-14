(() => {
"use strict";

const canvas=document.getElementById("game");
const ctx=canvas.getContext("2d",{alpha:false});
const LANES=5,MAX_SHOTS=4,MAX_HP=15;
const SHOT_SPEED_FACTOR=.30;
const CHARGE_TIME=700;
const JUST_GUARD_MS=180;

const state={
 running:true,playerHp:MAX_HP,enemyHp:MAX_HP,playerLane:2,enemyLane:2,
 guarding:false,guardStartedAt:0,shots:[],particles:[],
 playerAnim:"neutral",enemyAnim:"neutral",playerAnimUntil:0,enemyAnimUntil:0,
 aiShotCooldown:.9,aiMoveCooldown:.55,lastTime:performance.now(),
 charging:false,chargeStartedAt:0
};

const images={};
["neutral","guard","attack","hit"].forEach(name=>{
 const img=new Image();
 img.decoding="async";
 img.src=`./assets/${name}.png`;
 images[name]=img;
});

const ui={
 playerHp:document.getElementById("playerHp"),enemyHp:document.getElementById("enemyHp"),
 playerHpBar:document.getElementById("playerHpBar"),enemyHpBar:document.getElementById("enemyHpBar"),
 shotCount:document.getElementById("shotCount"),result:document.getElementById("result"),
 resultText:document.getElementById("resultText"),chargeText:document.getElementById("chargeText")
};

function resize(){
 const r=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);
 canvas.width=Math.max(320,Math.round(r.width*dpr));
 canvas.height=Math.max(240,Math.round(r.height*dpr));
}
new ResizeObserver(resize).observe(canvas);
window.addEventListener("orientationchange",()=>setTimeout(resize,150));
resize();

function geo(){
 const w=canvas.width,h=canvas.height,top=h*.08,bottom=h*.92,laneHeight=(bottom-top)/LANES;
 return {w,h,top,bottom,laneHeight,leftCrystal:w*.055,rightCrystal:w*.945,playerX:w*.24,enemyX:w*.76};
}
function laneY(v){const g=geo();return g.top+g.laneHeight*(v+.5)}
function wrapLane(v){while(v<0)v+=LANES;while(v>=LANES)v-=LANES;return v}
function laneDist(a,b){const d=Math.abs(a-b);return Math.min(d,LANES-d)}
function setAnim(side,name,ms){state[`${side}Anim`]=name;state[`${side}AnimUntil`]=performance.now()+ms}

function move(d){
 if(!state.running||state.guarding||state.charging)return;
 state.playerLane=Math.max(0,Math.min(LANES-1,state.playerLane+d));
}

function fire(owner,laneStep,charged=false,fromX=null,fromLane=null){
 if(!state.running)return false;
 if(state.shots.filter(s=>s.owner===owner).length>=MAX_SHOTS)return false;
 const g=geo(),player=owner==="player";
 state.shots.push({
  owner,
  x:fromX??(player?g.playerX+g.w*.047:g.enemyX-g.w*.047),
  lane:fromLane??(player?state.playerLane:state.enemyLane),
  laneStep,
  speed:g.w*SHOT_SPEED_FACTOR,
  power:charged?2:1,
  alive:true,
  reflected:false
 });
 setAnim(owner,"attack",210);
 updateHud();
 return true;
}

function startGuard(){
 if(!state.running)return;
 state.guarding=true;
 state.guardStartedAt=performance.now();
 state.playerAnim="guard";
 state.playerAnimUntil=Infinity;
}
function endGuard(){
 state.guarding=false;
 state.playerAnim="neutral";
 state.playerAnimUntil=0;
}

function startCharge(button){
 if(!state.running||state.guarding)return;
 state.charging=true;
 state.chargeStartedAt=performance.now();
 button.classList.add("charging");
 state.playerAnim="attack";
 state.playerAnimUntil=Infinity;
}
function endCharge(button,laneStep){
 if(!state.charging)return;
 const charged=performance.now()-state.chargeStartedAt>=CHARGE_TIME;
 state.charging=false;
 button.classList.remove("charging");
 state.playerAnim="neutral";
 state.playerAnimUntil=0;
 fire("player",laneStep,charged);
}

function damageCrystal(side,damage){
 const key=`${side}Hp`;
 state[key]=Math.max(0,state[key]-damage);
 updateHud();
 if(state[key]===0){
  state.running=false;
  ui.resultText.textContent=side==="enemy"?"YOU WIN":"YOU LOSE";
  ui.result.classList.remove("hidden");
 }
}

function burst(x,y,count=12){
 for(let i=0;i<count;i++)state.particles.push({
  x,y,vx:(Math.random()-.5)*300,vy:(Math.random()-.5)*300,
  life:.25+Math.random()*.3,size:2+Math.random()*6
 });
}

function reflectShot(shot){
 const g=geo();
 shot.owner="player";
 shot.x=g.playerX+g.w*.05;
 shot.speed=g.w*SHOT_SPEED_FACTOR*1.08;
 shot.laneStep*=-1;
 shot.power=Math.max(1,shot.power);
 shot.reflected=true;
 burst(shot.x,laneY(shot.lane),18);
}

function update(dt,now){
 if(now>state.playerAnimUntil&&!state.guarding&&!state.charging)state.playerAnim="neutral";
 if(now>state.enemyAnimUntil)state.enemyAnim="neutral";
 const g=geo();

 if(state.charging){
  const t=Math.min(1,(performance.now()-state.chargeStartedAt)/CHARGE_TIME);
  ui.chargeText.textContent=t>=1?"CHARGE READY":"CHARGING...";
 }else ui.chargeText.textContent="長押しでチャージ";

 if(state.running){
  for(const shot of state.shots){
   const dir=shot.owner==="player"?1:-1;
   shot.x+=dir*shot.speed*dt;
   shot.lane=wrapLane(shot.lane+shot.laneStep*(shot.speed*dt/g.laneHeight));
  }

  for(let i=0;i<state.shots.length;i++){
   const a=state.shots[i];if(!a.alive)continue;
   for(let j=i+1;j<state.shots.length;j++){
    const b=state.shots[j];if(!b.alive||a.owner===b.owner)continue;
    if(Math.abs(a.x-b.x)<g.w*.024&&laneDist(a.lane,b.lane)<.24){
     if(a.power===b.power){a.alive=b.alive=false}
     else if(a.power>b.power){a.power-=b.power;b.alive=false}
     else{b.power-=a.power;a.alive=false}
     burst((a.x+b.x)/2,laneY(a.lane));
    }
   }
  }

  for(const shot of state.shots){
   if(!shot.alive)continue;
   const y=laneY(shot.lane);

   if(shot.owner==="enemy"&&state.guarding&&
      Math.abs(shot.x-(g.playerX+g.w*.045))<g.w*.034&&
      laneDist(shot.lane,state.playerLane)<.43){
      const just=performance.now()-state.guardStartedAt<=JUST_GUARD_MS;
      if(just)reflectShot(shot);
      else{shot.alive=false;burst(shot.x,y,14)}
      continue;
   }

   if(shot.owner==="enemy"&&Math.abs(shot.x-g.playerX)<g.w*.028&&laneDist(shot.lane,state.playerLane)<.35){
    shot.alive=false;setAnim("player","hit",420);burst(shot.x,y);continue;
   }

   if(shot.owner==="player"&&Math.abs(shot.x-g.enemyX)<g.w*.028&&laneDist(shot.lane,state.enemyLane)<.35){
    shot.alive=false;setAnim("enemy","hit",420);burst(shot.x,y);continue;
   }

   if(shot.owner==="player"&&shot.x>=g.rightCrystal){
    shot.alive=false;damageCrystal("enemy",shot.power);burst(g.rightCrystal,y,18);
   }else if(shot.owner==="enemy"&&shot.x<=g.leftCrystal){
    shot.alive=false;damageCrystal("player",shot.power);burst(g.leftCrystal,y,18);
   }
  }

  state.shots=state.shots.filter(s=>s.alive);
  state.aiMoveCooldown-=dt;state.aiShotCooldown-=dt;
  if(state.aiMoveCooldown<=0){
   state.aiMoveCooldown=.45+Math.random()*.75;
   const target=Math.floor(Math.random()*LANES);
   state.enemyLane+=Math.sign(target-state.enemyLane);
  }
  if(state.aiShotCooldown<=0){
   state.aiShotCooldown=.75+Math.random()*.85;
   const dirs=[-1,0,1];
   fire("enemy",dirs[Math.floor(Math.random()*dirs.length)],Math.random()<.08);
  }
 }

 for(const p of state.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt}
 state.particles=state.particles.filter(p=>p.life>0);
 updateHud();
}

function drawBackground(g){
 const gr=ctx.createLinearGradient(0,0,g.w,g.h);
 gr.addColorStop(0,"#06111f");gr.addColorStop(.5,"#0a1d3a");gr.addColorStop(1,"#030913");
 ctx.fillStyle=gr;ctx.fillRect(0,0,g.w,g.h);
 ctx.fillStyle="rgba(55,153,255,.08)";
 for(let i=0;i<40;i++)ctx.fillRect((i*97)%g.w,(i*53)%g.h,2,2);
}
function drawLanes(g){
 for(let i=0;i<=LANES;i++){
  const y=g.top+g.laneHeight*i;
  ctx.beginPath();ctx.moveTo(g.leftCrystal,y);ctx.lineTo(g.rightCrystal,y);
  ctx.strokeStyle=i===0||i===LANES?"rgba(105,224,255,.6)":"rgba(105,224,255,.2)";
  ctx.lineWidth=Math.max(1,g.h/500);ctx.stroke();
 }
}
function drawCrystal(x,y,hp,mirror){
 const g=geo(),width=Math.max(22,g.w*.045),height=g.bottom-g.top;
 ctx.save();ctx.translate(x,y);if(mirror)ctx.scale(-1,1);
 ctx.shadowColor="#1aa8ff";ctx.shadowBlur=Math.max(12,g.w*.018);
 const gr=ctx.createLinearGradient(-width,0,width,0);
 gr.addColorStop(0,"#0757b6");gr.addColorStop(.45,"#d8fbff");gr.addColorStop(1,"#087ee0");
 ctx.fillStyle=gr;ctx.beginPath();
 ctx.moveTo(-width*.55,0);ctx.lineTo(-width*.1,-height*.48);ctx.lineTo(width*.48,-height*.31);
 ctx.lineTo(width*.58,0);ctx.lineTo(width*.48,height*.31);ctx.lineTo(-width*.1,height*.48);
 ctx.closePath();ctx.fill();
 const cracks=Math.floor((MAX_HP-hp)/3);
 ctx.strokeStyle="rgba(255,255,255,.86)";ctx.lineWidth=Math.max(1.5,g.w*.0015);
 for(let i=0;i<cracks;i++){ctx.beginPath();ctx.moveTo(-width*.05,-height*.12+i*height*.055);ctx.lineTo(width*(.22+i*.04),height*(.02+i*.04));ctx.stroke()}
 ctx.restore();
}
function drawCharacter(side,x,y,mirror){
 const g=geo(),name=state[`${side}Anim`],img=images[name];
 const h=Math.min(g.laneHeight*1.72,g.h*.30);
 const ratio=img&&img.naturalWidth?img.naturalWidth/img.naturalHeight:1;
 const w=h*ratio;
 if(img&&img.complete&&img.naturalWidth>0){
  ctx.save();ctx.translate(x,y);if(mirror)ctx.scale(-1,1);
  ctx.drawImage(img,-w/2,-h/2,w,h);ctx.restore();
 }else{
  ctx.save();ctx.translate(x,y);if(mirror)ctx.scale(-1,1);
  ctx.fillStyle="#17243c";ctx.strokeStyle="#2da2ff";ctx.lineWidth=4;
  ctx.beginPath();ctx.arc(0,-h*.12,h*.18,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.fillRect(-h*.15,h*.05,h*.3,h*.3);ctx.restore();
 }
 if(side==="player"&&state.guarding){
  ctx.save();ctx.strokeStyle="#aff4ff";ctx.lineWidth=Math.max(3,g.w*.003);
  ctx.shadowColor="#4dcbff";ctx.shadowBlur=Math.max(12,g.w*.016);
  ctx.beginPath();ctx.ellipse(x+g.w*.04,y,g.w*.035,g.laneHeight*.46,0,0,Math.PI*2);ctx.stroke();ctx.restore();
 }
 if(side==="player"&&state.charging){
  const pulse=.65+.35*Math.sin(performance.now()/85);
  ctx.save();ctx.fillStyle=`rgba(173,242,255,${pulse})`;ctx.shadowColor="#5edcff";ctx.shadowBlur=26;
  ctx.beginPath();ctx.arc(x+g.w*.045,y-g.laneHeight*.12,g.laneHeight*.10,0,Math.PI*2);ctx.fill();ctx.restore();
 }
}
function drawShots(g){
 for(const shot of state.shots){
  const y=laneY(shot.lane),r=shot.power>1?g.laneHeight*.115:g.laneHeight*.07;
  ctx.save();ctx.shadowColor=shot.reflected?"#ffffff":"#5edcff";ctx.shadowBlur=r*2.2;
  ctx.fillStyle=shot.power>1?"#efffff":"#48cbff";
  ctx.beginPath();ctx.arc(shot.x,y,r,0,Math.PI*2);ctx.fill();ctx.restore();
 }
}
function drawParticles(){
 ctx.fillStyle="#9cecff";
 for(const p of state.particles){ctx.globalAlpha=Math.max(0,p.life*3);ctx.fillRect(p.x,p.y,p.size,p.size)}
 ctx.globalAlpha=1;
}
function draw(){const g=geo();drawBackground(g);drawLanes(g);drawCrystal(g.leftCrystal,(g.top+g.bottom)/2,state.playerHp,false);drawCrystal(g.rightCrystal,(g.top+g.bottom)/2,state.enemyHp,true);drawCharacter("player",g.playerX,laneY(state.playerLane),false);drawCharacter("enemy",g.enemyX,laneY(state.enemyLane),true);drawShots(g);drawParticles()}
function updateHud(){
 ui.playerHp.textContent=state.playerHp;ui.enemyHp.textContent=state.enemyHp;
 ui.playerHpBar.style.width=`${state.playerHp/MAX_HP*100}%`;
 ui.enemyHpBar.style.width=`${state.enemyHp/MAX_HP*100}%`;
 ui.shotCount.textContent=state.shots.filter(s=>s.owner==="player").length;
}
function frame(now){const dt=Math.min(.035,(now-state.lastTime)/1000);state.lastTime=now;update(dt,now);draw();requestAnimationFrame(frame)}

function bindMove(id,fn){
 const b=document.getElementById(id);
 b.addEventListener("pointerdown",e=>{e.preventDefault();b.classList.add("active");fn()});
 ["pointerup","pointercancel","pointerleave"].forEach(t=>b.addEventListener(t,e=>{e.preventDefault();b.classList.remove("active")}));
}
bindMove("upBtn",()=>move(-1));bindMove("downBtn",()=>move(1));

const guardBtn=document.getElementById("guardBtn");
guardBtn.addEventListener("pointerdown",e=>{e.preventDefault();guardBtn.classList.add("active");startGuard();guardBtn.setPointerCapture?.(e.pointerId)});
["pointerup","pointercancel","lostpointercapture"].forEach(t=>guardBtn.addEventListener(t,e=>{e.preventDefault();guardBtn.classList.remove("active");endGuard()}));

document.querySelectorAll("[data-shot]").forEach(btn=>{
 let pointerId=null;
 btn.addEventListener("pointerdown",e=>{
  e.preventDefault();pointerId=e.pointerId;btn.classList.add("active");
  btn.setPointerCapture?.(e.pointerId);startCharge(btn);
 });
 const release=e=>{
  if(pointerId!==null&&e.pointerId!==undefined&&e.pointerId!==pointerId)return;
  e.preventDefault();btn.classList.remove("active");endCharge(btn,Number(btn.dataset.shot));pointerId=null;
 };
 ["pointerup","pointercancel","lostpointercapture"].forEach(t=>btn.addEventListener(t,release));
});

document.getElementById("restart").addEventListener("click",()=>location.reload());
document.addEventListener("contextmenu",e=>e.preventDefault());
updateHud();requestAnimationFrame(frame);
})();