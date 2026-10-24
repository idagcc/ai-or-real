import type { Answer, Question } from '../core';
import './gameplay.css';
const art=(name:string)=>`approved/game/${name}`;
export interface ApprovedGameProps{question:Question;realFirst:boolean;index:number;count:number;playerName:string;elapsedMs:number;correctCount:number;score:number;feedback:Answer|null;ready:boolean;imageError:string;onAnswer:(selected:'real'|'ai')=>void;onRetry:()=>void;onExit:()=>void;}
export function ApprovedGame({question,realFirst,index,count,playerName,elapsedMs,correctCount,feedback,ready,imageError,onAnswer,onRetry}:ApprovedGameProps){
 const seconds=Math.max(0,Math.floor(elapsedMs/1000));const time=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
 return <main className="approved-game" data-design-node="4064:639">
  <div className="approved-game-panel" aria-hidden="true"><img className="approved-game-panel-art" src={art('game-panel.svg')} alt=""/><i className="ag-panel-bloom"/><i className="ag-panel-halo"/><i className="ag-panel-diffusion"/><i className="ag-panel-inner"/><i className="ag-panel-outer"/></div>
  <p className="ag-round">ROUND {String(index+1).padStart(2,'0')} / {String(count).padStart(2,'0')}</p>
  <div className="ag-round-marks" aria-hidden="true">{Array.from({length:count},(_,i)=><span key={i} style={{left:i*(460/count),width:Math.max(14,460/count-12)}}><img src={art(i<=index?'round-active.svg':'round-idle.svg')} alt="" style={{transform:`scaleX(${Math.max(14,460/count-12)/130})`}}/></span>)}</div>
  <h1 className="ag-title">Find the Real Image</h1><p className="ag-subtitle" aria-live="polite">{ready||feedback?'Tap the real image':'Preparing both images…'}</p>
  {[0,1].map(slot=>{const real=slot===0?realFirst:!realFirst;const selected=real?'real':'ai';const blink=feedback&&feedback.selected===selected?(feedback.correct?'correct':'incorrect'):'';return <button key={`${question.id}-${slot}`} className={`ag-choice ${blink?`ag-${blink}`:''}`} style={{top:slot===0?850:2050}} disabled={!ready||!!feedback} onClick={()=>onAnswer(selected)} aria-label={`Choose ${slot===0?'top':'bottom'} image as the real photograph`}><img className="ag-frame-art" src={art('image-frame.svg')} alt=""/><i className="ag-frame-bloom"/><i className="ag-frame-halo"/><i className="ag-frame-diffusion"/><i className="ag-frame-inner"/><i className="ag-frame-outer"/><img className="ag-photo" src={real?question.image:question.decoyImage} alt={`${slot===0?'Top':'Bottom'} image option`} draggable={false} style={{objectPosition:(real?question.imagePosition:question.decoyImagePosition)||'center'}}/></button>;})}
  {imageError&&<button className="ag-image-error" onClick={onRetry}>{imageError}<br/>Tap to retry</button>}
  <p className="ag-stat-label ag-player-label">AGENT</p><p className="ag-player-name">{playerName}</p><p className="ag-stat-label ag-time-label">TIME</p><p className="ag-time">{time}</p><p className="ag-stat-label ag-correct-label">CORRECT</p><p className="ag-correct-count">{correctCount} / {count}</p>
 </main>;
}
