import { useEffect, useRef, useState, type CSSProperties } from 'react';
import './approved.css';
const asset=(name:string)=>`approved/${name}`;
export function ApprovedChrome({panel=true,sceneKey='home'}:{panel?:boolean;sceneKey?:string}){
  const video = useRef<HTMLVideoElement>(null);
  const [videoReady,setVideoReady] = useState(false);
  useEffect(()=>{
    const sync=()=>{if(!video.current)return;if(document.hidden)video.current.pause();else void video.current.play().catch(()=>{});};
    sync();document.addEventListener('visibilitychange',sync);window.addEventListener('pointerdown',sync,{once:true});
    return()=>{document.removeEventListener('visibilitychange',sync);window.removeEventListener('pointerdown',sync);};
  },[]);
  return <div className="approved-chrome" aria-hidden="true">
    <img className="approved-backdrop" src="media/background-poster.jpg" alt=""/>
    <video ref={video} className={`approved-backdrop-video ${videoReady?'video-ready':''}`} src="media/DGE_BG_Potrite.mp4" poster="media/background-poster.jpg" autoPlay loop muted playsInline preload="auto" onLoadedData={()=>setVideoReady(true)} onError={()=>setVideoReady(false)}/>
    <img className="approved-overlay" src={asset('imgRectangle3.png')} alt=""/>
    {panel&&<div key={sceneKey} className="neon-board-enter"><div className="approved-panel-art"><img src={asset('imgCenterBox65Opacity.svg')} alt=""/></div><div className="approved-panel-bloom"/><div className="approved-panel-halo"/><div className="approved-panel-inner-diffusion"/><div className="approved-panel-inner-crisp"/><div className="approved-panel-outer-crisp"/></div>}
  </div>;
}
interface ButtonProps{label:string;onClick?:()=>void;left:number;top:number;width?:number;height?:number;disabled?:boolean;type?:'button'|'submit';style?:CSSProperties;}
const buttonLayers:[string,number,number,number,number,number?,number?][]=[
 ['imgInteriorSubtleDarkBlueGradient.svg',27.14,22.43,825.712,208.944],['imgIndicators.svg',2.86,22.43,874.284,213.666,-.9015,-.4155],['imgStatusCluster.svg',214.42,231.5,25.428,2.125],['imgStatusCluster1.svg',214.42,21.38,25.428,2.125],['imgStatusCluster2.svg',640.13,231.5,25.427,2.125],['imgStatusCluster3.svg',640.13,21.38,25.427,2.125],['imgCircuitLines.svg',275.71,61.38,271.429,131.033,-.575,-.367],['imgInnerBorders.svg',27.15,5.9,825.711,243.178],['imgOuterFrame.svg',0,0,879.997,254.985,-.5745,-.703],['imgHexagonalGrid.svg',34.29,33.08,811.424,198.3,0,-.535],['imgPerimeterLightDiffusion.svg',445.71,0,434.284,254.984,-5.776,-6.2],['imgPerimeterLightDiffusion1.svg',0,0,434.285,254.985,-4,-6.2]
];
export function ApprovedButton({label,onClick,left,top,width=880.051,height=255,disabled,type='button',style}:ButtonProps){return <button type={type} disabled={disabled} onClick={onClick} className="approved-button" style={{left,top,width,height,...style}}><span className="approved-button-canvas" aria-hidden="true" style={{transform:`scale(${width/880.051},${height/255})`}}>{buttonLayers.map(([file,x,y,w,h,ox=0,oy=0])=><span key={file} className="approved-button-layer" style={{left:x,top:y,width:w,height:h}}><img src={asset(file)} alt="" style={{left:ox,top:oy}}/></span>)}<span className="approved-button-label">{label}</span></span><span className="sr-only">{label}</span></button>}
