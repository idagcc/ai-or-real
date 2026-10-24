import {useState} from 'react';
import './TouchKeyboard.css';

export default function TouchKeyboard({field,onKey,onClose}:{field:'name'|'email';onKey:(k:string)=>void;onClose:()=>void}) {
  const [shift,setShift]=useState(field==='name');
  const rows=['1234567890','qwertyuiop','asdfghjkl','zxcvbnm'];
  return <section className="air-touch-keyboard" aria-label={`${field} touch keyboard`} onPointerDown={e=>e.preventDefault()}>
    <div className="air-keyboard-title">{field==='name'?'Enter your name':'Enter your email'}<button type="button" onClick={onClose}>Done ✓</button></div>
    {rows.map(row=><div className="air-key-row" key={row}>{[...row].map(k=><button type="button" key={k} onClick={()=>{onKey(shift?k.toUpperCase():k);if(shift)setShift(false)}}>{shift?k.toUpperCase():k}</button>)}</div>)}
    <div className="air-key-row"><button type="button" onClick={()=>setShift(!shift)} aria-pressed={shift}>Shift</button>{field==='email'&&<><button type="button" onClick={()=>onKey('@')}>@</button><button type="button" onClick={()=>onKey('.')}>.</button><button type="button" onClick={()=>onKey('.com')}>.com</button></>}{['-','_',"'",'+'].map(k=><button type="button" key={k} onClick={()=>onKey(k)}>{k}</button>)}<button type="button" className="air-space-key" onClick={()=>onKey(' ')}>Space</button><button type="button" aria-label="Backspace" onClick={()=>onKey('BACKSPACE')}>⌫</button></div>
  </section>;
}
