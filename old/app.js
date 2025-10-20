// app.js — 2-robotin päivitys (pohja säilytetty), v1.3.6
// Aina 5 nappulaa.
// 1-robotti: [red, yellow, blue, green, purple], heroes=[0]
// 2-robottia: [red, orange, green, blue, purple], heroes=[0,1]
// Liike: nappula saa liikkua VAIN jos sen suunnassa on toinen nappula; pysähtyy yhtä ruutua ennen sitä.
// Reunoihin EI törmätä. Jos suunnassa ei ole nappulaa → ei liikettä.
// 2-robotin maksimi on 13; 14 poistettu mahdottomana.

const boardEl = document.getElementById('board');
const moveCountEl = document.getElementById('moveCount');
const minMovesEl = document.getElementById('minMoves');
const statusEl = document.getElementById('status');

const btnNew = document.getElementById('newPuzzle');
const btnSolve = document.getElementById('showSolution');
const btnReset = document.getElementById('reset');
const selDiff = document.getElementById('difficulty');

const solutionBox = document.getElementById('solutionBox');
const solutionList = document.getElementById('solutionList');

const N = 5;
const CENTER = 12;                 // 2*5 + 2
const TOTAL = 5;                   // aina 5 nappulaa
const SENTINEL = 255;              // poistettu laudalta

// Nuolinäppäinten vektorit rivisarakemuodossa
const STEP = { up:[-1,0], down:[1,0], left:[0,-1], right:[0,1] };

// Vaikeusalueet (2-robotin maksimi 13)
const DIFF = {
  beginner: [3,5],
  intermediate: [6,8],
  advanced: [9,12],
  beginner2: [3,6],
  intermediate2: [7,9],
  advanced2: [10,13]
};

// -------- apurit --------
function idx(r,c){ return r*N + c; }
function rc(i){ return [Math.floor(i/N), i%N]; }
function clone(a){ return new Uint8Array(a); }
function isSolved(){ return state.cleared >= state.reqRobots; }

function paletteFor(value){
  const two = value.endsWith('2');
  if(two){
    return {
      colors: ['red','orange','green','blue','purple'],
      names:  ['Red','Orange','Green','Blue','Purple'],
      heroes: [0,1],
      heroLabels: {0:'X',1:'O'},
      reqRobots: 2
    };
  }
  return {
    colors: ['red','yellow','blue','green','purple'],
    names:  ['Red','Orange','Blue','Green','Purple'],
    heroes: [0],
    heroLabels: {0:'X'},
    reqRobots: 1
  };
}

let state = {
  start:null, pos:null,
  selected:0, moves:0,
  solution:null, minLen:null,
  colors:[], names:[], heroLabels:{},
  heroes:[0], reqRobots:1, cleared:0
};

function occupiedSet(pos){
  const s = new Set();
  for(let i=0;i<pos.length;i++){
    const p = pos[i];
    if(p!==SENTINEL) s.add(p);
  }
  return s;
}

// Etsi LÄHIN nappula annetussa suunnassa. Jos ei ole, ei liikettä.
function nearestBlocker(pos, from, dir){
  const [r,c] = rc(from);
  const [dr,dc] = STEP[dir];
  const occ = occupiedSet(pos);
  occ.delete(from); // älä laske itseä ankkuriksi
  let rr = r + dr, cc = c + dc;
  while (rr >= 0 && rr < N && cc >= 0 && cc < N){
    const cand = idx(rr, cc);
    if (occ.has(cand)) return cand; // löytyi nappula
    rr += dr; cc += dc;
  }
  return null; // ei nappulaa → ei liikettä
}

// Liiku vain kohti toista nappulaa; pysähdy juuri ennen sitä.
function slide(pos, robotIdx, dir){
  const cur = pos[robotIdx];
  if (cur === SENTINEL) return SENTINEL;
  const blk = nearestBlocker(pos, cur, dir);
  if (blk == null) return cur; // ei liikettä, koska ei kohdenappulaa
  const [dr,dc] = STEP[dir];
  const [br,bc] = rc(blk);
  return idx(br - dr, bc - dc);
}

// --- kanoninen avain ---
// 1-robotti: lajittele KAIKKI viisi paikkaa (palauttaa alkuperäisen toimivuuden 9–12).
// 2-robottia: pidä R ja O erikseen, lajittele vain blockerit (3 kpl).
function canonicalKey(pos, heroes, cleared){
  if (heroes.length === 1){
    const a = Array.from(pos).slice().sort((x,y)=>x-y);
    return a.join(',') + '|' + cleared;
  }
  // 2-robotti
  const h0 = pos[0];
  const h1 = pos[1];
  const rest = [pos[2],pos[3],pos[4]].sort((a,b)=>a-b);
  return `${h0}|${h1}|${rest.join(',')}|${cleared}`;
}

// sankari keskelle → poistuu (SENTINEL) ja cleared kasvaa
function applyGoalRule(pos, heroes, cleared, reqRobots, robotIndex){
  if(heroes.includes(robotIndex) && pos[robotIndex]===CENTER){
    const np = new Uint8Array(pos);
    np[robotIndex] = SENTINEL;
    return { pos: np, cleared: cleared+1 };
  }
  return { pos, cleared };
}

function nextStates(pos, heroes, cleared, reqRobots){
  const out = [];
  for(let r=0;r<pos.length;r++){
    if(pos[r]===SENTINEL) continue;
    for(const d of ['up','down','left','right']){
      const to = slide(pos, r, d);
      if(to!==pos[r] && to!==SENTINEL){
        let np = clone(pos);
        np[r]=to;
        const ap = applyGoalRule(np, heroes, cleared, reqRobots, r);
        out.push({ pos: ap.pos, cleared: ap.cleared, move:{robot:r, dir:d} });
      }
    }
  }
  return out;
}

function solveBFS(startPos, heroes, reqRobots, maxNodes=800000){
  const startKey = canonicalKey(startPos, heroes, 0);
  const q = [{pos:startPos, cleared:0}];
  const prev = new Map([[startKey, null]]);
  let nodes=0;

  while(q.length){
    const cur = q.shift();
    if(cur.cleared >= reqRobots){
      // rakenna polku
      const path = [];
      let key = canonicalKey(cur.pos, heroes, cur.cleared);
      while(true){
        const p = prev.get(key);
        if(!p) break;
        path.push(p.move);
        key = p.key;
      }
      path.reverse();
      return { length: path.length, path };
    }

    if(++nodes>maxNodes) break;

    for(const ns of nextStates(cur.pos, heroes, cur.cleared, reqRobots)){
      const k = canonicalKey(ns.pos, heroes, ns.cleared);
      if(prev.has(k)) continue;
      prev.set(k, { key: canonicalKey(cur.pos, heroes, cur.cleared), move: ns.move });
      q.push(ns);
    }
  }
  return { length:null, path:null };
}

// --- Generointi ---
function randomLayout(){
  // 5 eri ruutua, ei keskelle
  const all = [];
  for(let i=0;i<N*N;i++) if(i!==CENTER) all.push(i);
  for(let i=all.length-1;i>0;i--){
    const j=(Math.random()*(i+1))|0; [all[i],all[j]]=[all[j],all[i]];
  }
  const p = new Uint8Array(TOTAL);
  for(let i=0;i<TOTAL;i++) p[i]=all[i];
  return p;
}

async function generatePuzzleFor(value){
  const pal = paletteFor(value);
  let [lo, hi] = DIFF[value] || DIFF.beginner;
  if (pal.reqRobots===2 && hi>13) hi = 13; // varmistus

  statusEl.textContent = "Generating…";
  const MAX_TRIES = 15000;

  // “Paras tähän mennessä” -haku: jos ei osu täsmälleen väliin,
  // palautetaan lähin (preferoidaan ≤ hi).
  let best = null; // {len, start, sol}
  for(let tries=1; tries<=MAX_TRIES; tries++){
    const lay = randomLayout();
    const sol = solveBFS(lay, pal.heroes, pal.reqRobots, pal.reqRobots===2 ? 350000 : 800000);

    if(sol.length){
      if(!best || closer(sol.length, best.len, lo, hi))
        best = {len: sol.length, start: lay, sol: sol.path};

      if(sol.length>=lo && sol.length<=hi){
        statusEl.textContent = `Solution ${sol.length} steps.`;
        return {start: lay, minLen: sol.length, solution: sol.path, palette: pal};
      }
    }
    if(tries%200===0) statusEl.textContent = `Etsitään… (${tries}/${MAX_TRIES})`;
  }

  if(best){
    statusEl.textContent = `Path: ${best.len} moves.`;
    return {start: best.start, minLen: best.len, solution: best.sol, palette: pal};
  }
  statusEl.textContent = "Unable to find solution.";
  return null;

  function closer(a, b, lo, hi){
    if(b==null) return true;
    const aIn = a>=lo && a<=hi, bIn = b>=lo && b<=hi;
    if(aIn && !bIn) return true;
    if(!aIn && bIn) return false;
    if(aIn && bIn) return Math.abs(a - (lo+hi)/2) < Math.abs(b - (lo+hi)/2);
    const aOver = a>hi, bOver = b>hi;
    if(aOver!==bOver) return !aOver; // suosi ≤ hi
    const aDist = aOver ? a-hi : lo-a;
    const bDist = bOver ? b-hi : lo-b;
    return aDist < bDist;
  }
}

// ----- UI -----
function buildBoard(){
  boardEl.innerHTML='';
  for(let i=0;i<25;i++){
    const cell = document.createElement('div');
    cell.className='cell';
    if(i===CENTER) cell.classList.add('goalCell');
    cell.addEventListener('click', ()=> boardEl.focus());
    boardEl.appendChild(cell);
  }
}

function render(){
  Array.from(boardEl.children).forEach(cell=>cell.innerHTML='');

  if(state.pos){
    for(let i=0;i<TOTAL;i++){
      const at = state.pos[i];
      if(at===SENTINEL) continue;
      const cell = boardEl.children[at];
      const div = document.createElement('div');
      div.className = `robot ${state.colors[i]} ${i===state.selected?'selected':''}`;
      div.textContent = state.heroLabels[i] || '';
      cell.appendChild(div);
      div.addEventListener('click', (e)=>{
        e.stopPropagation();
        state.selected=i; render();
      });
    }
  }

  moveCountEl.textContent = String(state.moves||0);
  minMovesEl.textContent = (state.minLen??'–');
  btnSolve.disabled = !state.solution || !state.solution.length;

  if(isSolved()){
    statusEl.textContent = state.reqRobots===2
      ? `Both robots safe – you win! 🎉`
      : `Solved! 🎉`;
  } 
  else if(state.reqRobots===2){
    const left = state.reqRobots - state.cleared;
    if (state.minLen)
      statusEl.textContent = `Two robots to the center in ${state.minLen} moves`;
    else if (left===2)
      statusEl.textContent = `Two robots to the center`;
    else if (left===1)
      statusEl.textContent = `One more robot to the center`;
  } 
  else {
    if (state.minLen)
      statusEl.textContent = `Red robot to the center in ${state.minLen} moves`;
    else
      statusEl.textContent = "";
  }

}

function tryMove(dir){
  if(!state.pos || isSolved()) return;

  const from = state.pos[state.selected];
  const to = slide(state.pos, state.selected, dir);
  if(to===from || to===SENTINEL) return;

  const np = clone(state.pos);
  np[state.selected] = to;

  const isHero = state.heroes.includes(state.selected);
  const reachedCenter = (to === CENTER) && isHero;

if (reachedCenter){
  // Päivitä tila ja piirrä robotti keskelle
  state.pos = np;
  state.moves++;
  solutionBox.hidden = true;
  render();

  const cell   = boardEl.children[CENTER];
  const robDiv = cell && cell.querySelector('.robot');

  // Lukitse UI animaation ajaksi (estää kaikki klikkaukset)
  state.locked = true;
  boardEl.style.pointerEvents = 'none';

  const finalizeRemoval = () => {
    // suojataan tuplapoistoilta
    if (state.pos[state.selected] !== SENTINEL){
      state.pos[state.selected] = SENTINEL;
      state.cleared++;

      // valitse seuraava elossa oleva
      const next = state.pos.findIndex(p => p !== SENTINEL);
      state.selected = next >= 0 ? next : -1;
    }

    state.locked = false;
    boardEl.style.pointerEvents = ''; // palauta
    render();
  };

  if (robDiv){
    robDiv.classList.add('fadeOut');

    // Poista vasta kun animaatio varmasti päättyy
    const onEnd = () => {
      robDiv.removeEventListener('animationend', onEnd);
      finalizeRemoval();
    };
    robDiv.addEventListener('animationend', onEnd, { once: true });

    // Fallback jos animationend ei laukea
    setTimeout(()=>{
      if (state.locked) finalizeRemoval();
    }, 2500);
  } else {
    // varafallback: poista heti jos elementtiä ei löydy
    finalizeRemoval();
  }

  return;
}


  // Tavallinen siirto (ei keskelle)
  const ap = applyGoalRule(np, state.heroes, state.cleared, state.reqRobots, state.selected);
  state.pos = ap.pos;
  state.cleared = ap.cleared;

  if(state.pos[state.selected]===SENTINEL){
    for(let i=0;i<TOTAL;i++){ if(state.pos[i]!==SENTINEL){ state.selected=i; break; } }
  }

  state.moves++;
  solutionBox.hidden = true;
  render();
}


// Ratkaisun nuolilista
function dirArrow(d){ return d==='left'?'←': d==='right'?'→': d==='up'?'↑':'↓'; }
function dirWordFi(d){ return d==='left'?'left': d==='right'?'right': d==='up'?'up':'down'; }

function buildSolutionList(){
  if(!state.solution || !state.solution.length){ solutionBox.hidden=true; return; }
  solutionList.innerHTML='';
  state.solution.forEach((step)=>{
    const li = document.createElement('li');
    const r = step.robot; const d = step.dir;
    const wrap = document.createElement('span');
    wrap.className='step';
    const pill = document.createElement('span');
    pill.className = `pill ${state.colors[r]}`;
    pill.textContent = (state.names[r]||'?')[0];
    const arrow = document.createElement('span');
    arrow.className='arrow';
    arrow.textContent = dirArrow(d);
    const label = document.createElement('span');
    label.textContent = `${state.names[r]} ${dirWordFi(d)}`;
    wrap.appendChild(pill); wrap.appendChild(arrow); wrap.appendChild(label);
    li.appendChild(wrap);
    solutionList.appendChild(li);
  });
  solutionBox.hidden=false;
}

// ohjaus
boardEl.addEventListener('keydown', (e)=>{
  const map = {ArrowUp:'up', ArrowDown:'down', ArrowLeft:'left', ArrowRight:'right', w:'up', s:'down', a:'left', d:'right'};
  const dir = map[e.key];
  if(dir){ e.preventDefault(); tryMove(dir); }
});
document.querySelectorAll('.dir').forEach(btn=>{
  btn.addEventListener('click', ()=> tryMove(btn.dataset.dir));
});

btnNew.addEventListener('click', async ()=>{
  btnNew.disabled = true;
  btnSolve.disabled = true;
  solutionBox.hidden = true;

  // nollaa tila
  state = {start:null,pos:null,selected:0,moves:0,solution:null,minLen:null, colors:[],names:[],heroLabels:{}, heroes:[0], reqRobots:1, cleared:0};
  render();

  const res = await generatePuzzleFor(selDiff.value);
  if(res){
    state.start = clone(res.start);
    state.pos = clone(res.start);
    state.selected = 0;
    state.moves = 0;
    state.solution = res.solution;
    state.minLen = res.minLen;

    state.colors = res.palette.colors.slice();
    state.names = res.palette.names.slice();
    state.heroLabels = {...res.palette.heroLabels};
    state.heroes = res.palette.heroes.slice();
    state.reqRobots = res.palette.reqRobots;
    state.cleared = 0;

    render();
  } else {
    statusEl.textContent = "Tehtävää ei saatu luotua.";
  }
  btnNew.disabled = false;
  btnSolve.disabled = !state.solution;
});

btnSolve.addEventListener('click', ()=> buildSolutionList());

btnReset.addEventListener('click', ()=>{
  if(!state.start) return;
  state.pos = clone(state.start);
  state.selected = 0;
  state.moves = 0;
  state.cleared = 0;
  solutionBox.hidden = true;
  render();
});

// init
(function init(){
  if(!boardEl.children.length){
    for(let i=0;i<25;i++){
      const cell = document.createElement('div');
      cell.className='cell';
      if(i===CENTER) cell.classList.add('goalCell');
      boardEl.appendChild(cell);
    }
  }
  render();
})();
