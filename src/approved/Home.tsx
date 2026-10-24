import type { Result } from '../core';
import { ApprovedButton } from './Chrome';
const seconds=(value:number)=>{const total=Math.floor(value/1000);return `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;};
export function ApprovedHome({rows,onStart}:{rows:Result[];onStart:()=>void}){return <main className="approved-home" data-figma-node="4064:533">
 <h1>Find the Real Image</h1><p className="approved-home-subtitle">CAN YOU SPOT THE REAL IMAGE?</p><h2>Leaderboard</h2>
 <div className="approved-table-header"><span>Rank</span><span>Agent</span><span>Correct</span><span>Time</span></div>
 {Array.from({length:5},(_,i)=>{const row=rows[i];return <div className="approved-table-row" key={row?.id??i} style={{top:1714+i*185}}><span>{i+1}</span><span>{row?.player.name??'—'}</span><span>{row?.correctCount??'—'}</span><span>{row?seconds(row.correctTimeMs):'—'}</span></div>;})}
 {[1815,2000,2185,2370,2555].map(y=><img className="approved-table-horizontal" key={y} src="approved/imgVector.svg" style={{top:y-1}} alt=""/>)}
 {[540,1300,1580].map(x=><img className="approved-table-vertical" key={x} src="approved/imgVector1.svg" style={{left:x-1}} alt=""/>)}
 <ApprovedButton label="Start" left={640} top={3000} onClick={onStart}/>
 </main>}
