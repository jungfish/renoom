import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// ── Shaders ──────────────────────────────────────────────────────────────────
const VS = `
  attribute vec3 aP; attribute vec3 aN; attribute vec2 aUV; attribute vec3 aC;
  uniform mat4 uMVP;
  varying vec3 vN; varying vec3 vC; varying vec2 vUV;
  void main(){ gl_Position=uMVP*vec4(aP,1.); vN=aN; vC=aC; vUV=aUV; }
`;
const FS = `
  precision mediump float;
  varying vec3 vN; varying vec3 vC; varying vec2 vUV;
  uniform vec3 uL1; uniform vec3 uL2;
  uniform sampler2D uTex;
  uniform int uUseTex;
  void main(){
    vec3 n=normalize(vN);
    float d=max(dot(n,normalize(uL1)),0.)*.62+max(dot(n,normalize(uL2)),0.)*.22+.32;
    vec3 base = uUseTex==1 ? texture2D(uTex,vUV).rgb : vC;
    gl_FragColor=vec4(base*d,1.);
  }
`;

// ── Geometry ─────────────────────────────────────────────────────────────────
function hexToRgb(h) {
  return [parseInt(h.slice(1,3),16)/255, parseInt(h.slice(3,5),16)/255, parseInt(h.slice(5,7),16)/255];
}
function dim(c,f){ return c.map(v=>v*f); }

// pos(3) + norm(3) + uv(2) + color(3) = 11 floats per vertex, 6 verts per quad
function makeQuad(p0,p1,p2,p3, n,c, tileU=1,tileV=1) {
  const uvs=[[0,0],[tileU,0],[tileU,tileV],[0,tileV]];
  const pts=[p0,p1,p2,p0,p2,p3], ui=[0,1,2,0,2,3];
  const v=[];
  for(let i=0;i<6;i++) v.push(...pts[i],...n,...uvs[ui[i]],...c);
  return new Float32Array(v);
}

function buildSurfaces(domHex,secHex,accHex) {
  const DOM=hexToRgb(domHex), SEC=hexToRgb(secHex), ACC=hexToRgb(accHex);
  const W=5,D=5,H=3;
  return {
    floor:     makeQuad([-W/2,0,-D/2],[W/2,0,-D/2],[W/2,0,D/2],[-W/2,0,D/2],     [0,1,0], DOM, 2,2),
    ceiling:   makeQuad([-W/2,H,D/2],[W/2,H,D/2],[W/2,H,-D/2],[-W/2,H,-D/2],     [0,-1,0],dim(DOM,.92)),
    backWall:  makeQuad([-W/2,0,-D/2],[-W/2,H,-D/2],[W/2,H,-D/2],[W/2,0,-D/2],   [0,0,1], SEC),
    frontWall: makeQuad([W/2,0,D/2],[W/2,H,D/2],[-W/2,H,D/2],[-W/2,0,D/2],       [0,0,-1],ACC),
    leftWall:  makeQuad([-W/2,0,D/2],[-W/2,H,D/2],[-W/2,H,-D/2],[-W/2,0,-D/2],  [1,0,0], dim(SEC,.78)),
    rightWall: makeQuad([W/2,0,-D/2],[W/2,H,-D/2],[W/2,H,D/2],[W/2,0,D/2],       [-1,0,0],dim(SEC,.78)),
    rug:       makeQuad([-1.4,.002,-2.2],[1.4,.002,-2.2],[1.4,.002,.4],[-1.4,.002,.4],[0,1,0],hexToRgb('#d8c4a8')),
    winLight:  makeQuad([-W/2+.015,.8,-1.2],[-W/2+.015,2.3,-1.2],[-W/2+.015,2.3,.4],[-W/2+.015,.8,.4],[1,0,0],dim(SEC,1.12)),
  };
}

function buildFurniture(domHex,secHex) {
  const SOFA=hexToRgb('#cdb89e'), WD=hexToRgb('#b78030'), WD_D=dim(WD,.72);
  const v=[];
  function quad(p0,p1,p2,p3,n,c){ for(const p of[p0,p1,p2,p0,p2,p3]) v.push(...p,...n,0,0,...c); }
  function box(cx,cy,cz,w,h,d,c){
    const[x0,x1]=[cx-w/2,cx+w/2],[y0,y1]=[cy-h/2,cy+h/2],[z0,z1]=[cz-d/2,cz+d/2];
    const cs=dim(c,.82);
    quad([x0,y0,z1],[x1,y0,z1],[x1,y0,z0],[x0,y0,z0],[0,-1,0],cs);
    quad([x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1],[0,1,0],c);
    quad([x0,y0,z1],[x0,y1,z1],[x1,y1,z1],[x1,y0,z1],[0,0,1],cs);
    quad([x1,y0,z0],[x1,y1,z0],[x0,y1,z0],[x0,y0,z0],[0,0,-1],cs);
    quad([x0,y0,z0],[x0,y1,z0],[x0,y1,z1],[x0,y0,z1],[-1,0,0],cs);
    quad([x1,y0,z1],[x1,y1,z1],[x1,y1,z0],[x1,y0,z0],[1,0,0],cs);
  }
  box(0,.225,-1.72,2.2,.45,.85,SOFA);
  box(0,.57,-2.03,2.2,.56,.18,SOFA);
  box(-0.97,.225,-1.72,.12,.45,.85,dim(SOFA,.92));
  box( 0.97,.225,-1.72,.12,.45,.85,dim(SOFA,.92));
  box(0,.41,-.65,1.08,.055,.54,WD);
  for(const[lx,lz] of[[.46,.23],[.46,-.23],[-.46,.23],[-.46,-.23]])
    box(lx,.2,-.65+lz,.055,.4,.055,WD_D);
  return new Float32Array(v);
}

// ── Matrix helpers ────────────────────────────────────────────────────────────
const m4=()=>new Float32Array(16);
function persp(fov,asp,near,far){
  const m=m4(),f=1/Math.tan(fov/2),nf=1/(near-far);
  m[0]=f/asp;m[5]=f;m[10]=(far+near)*nf;m[11]=-1;m[14]=2*far*near*nf; return m;
}
function lookAt(ex,ey,ez,cx,cy,cz){
  let fx=cx-ex,fy=cy-ey,fz=cz-ez,fl=Math.sqrt(fx*fx+fy*fy+fz*fz);
  fx/=fl;fy/=fl;fz/=fl;
  let rx=-fz,ry=0,rz=fx,rl=Math.sqrt(rx*rx+rz*rz); rx/=rl;rz/=rl;
  const ux=ry*fz-rz*fy,uy=rz*fx-rx*fz,uz=rx*fy-ry*fx;
  const m=m4();
  m[0]=rx;m[1]=ux;m[2]=-fx; m[4]=ry;m[5]=uy;m[6]=-fy; m[8]=rz;m[9]=uz;m[10]=-fz;
  m[12]=-(rx*ex+ry*ey+rz*ez); m[13]=-(ux*ex+uy*ey+uz*ez); m[14]=fx*ex+fy*ey+fz*ez; m[15]=1;
  return m;
}
function mul(a,b){
  const m=m4();
  for(let c=0;c<4;c++) for(let r=0;r<4;r++){let s=0;for(let k=0;k<4;k++) s+=a[k*4+r]*b[c*4+k];m[c*4+r]=s;}
  return m;
}

// ── Texture loader ────────────────────────────────────────────────────────────
function loadTexture(gl, url) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([200,200,200,255]));
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);
  };
  img.src = url;
  return tex;
}

// ── Surface config ─────────────────────────────────────────────────────────────
const SURFACE_LABELS = {
  floor:     "Sol",
  backWall:  "Mur fond",
  frontWall: "Mur accent",
  leftWall:  "Mur gauche",
  rightWall: "Mur droit",
};

// ── Component ─────────────────────────────────────────────────────────────────
export function RoomViewer3D({ dominant, secondary, accent, roomLabel, availablePhotos = [], onClose }) {
  const canvasRef  = useRef(null);
  const glState    = useRef(null);   // { gl, prog, LOC, surfBufs, furnBuf, furnNV, cam, raf }
  const texCache   = useRef({});     // url → WebGLTexture
  const assignRef  = useRef({});     // surfaceKey → url

  const [assignments, setAssignments] = useState({});   // surfaceKey → url
  const [pickerSurface, setPickerSurface] = useState(null);

  // ── Setup WebGL once ────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) return;

    function mkShader(src,type){ const s=gl.createShader(type); gl.shaderSource(s,src); gl.compileShader(s); return s; }
    const prog=gl.createProgram();
    gl.attachShader(prog,mkShader(VS,gl.VERTEX_SHADER));
    gl.attachShader(prog,mkShader(FS,gl.FRAGMENT_SHADER));
    gl.linkProgram(prog); gl.useProgram(prog);

    const LOC={
      aP: gl.getAttribLocation(prog,"aP"),
      aN: gl.getAttribLocation(prog,"aN"),
      aUV:gl.getAttribLocation(prog,"aUV"),
      aC: gl.getAttribLocation(prog,"aC"),
      MVP:    gl.getUniformLocation(prog,"uMVP"),
      L1:     gl.getUniformLocation(prog,"uL1"),
      L2:     gl.getUniformLocation(prog,"uL2"),
      uTex:   gl.getUniformLocation(prog,"uTex"),
      uUseTex:gl.getUniformLocation(prog,"uUseTex"),
    };

    const STRIDE=11*4;
    function bindAttribs(){
      gl.enableVertexAttribArray(LOC.aP);  gl.vertexAttribPointer(LOC.aP, 3,gl.FLOAT,false,STRIDE,0);
      gl.enableVertexAttribArray(LOC.aN);  gl.vertexAttribPointer(LOC.aN, 3,gl.FLOAT,false,STRIDE,12);
      gl.enableVertexAttribArray(LOC.aUV); gl.vertexAttribPointer(LOC.aUV,2,gl.FLOAT,false,STRIDE,24);
      gl.enableVertexAttribArray(LOC.aC);  gl.vertexAttribPointer(LOC.aC, 3,gl.FLOAT,false,STRIDE,32);
    }

    // Surface buffers (one per named surface)
    const surfBufs = {};
    const surfData = buildSurfaces(dominant, secondary, accent);
    for (const [key, data] of Object.entries(surfData)) {
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      surfBufs[key] = { buf, nVerts: data.length / 11 };
    }

    // Furniture buffer
    const furnData = buildFurniture(dominant, secondary);
    const furnBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, furnBuf);
    gl.bufferData(gl.ARRAY_BUFFER, furnData, gl.STATIC_DRAW);
    const furnNV = furnData.length / 11;

    // Camera
    const cam={az:Math.PI/4, el:.32, r:3.6};
    const TGT=[0,1.1,0];
    const drag={on:false,lx:0,ly:0,pd:0};
    function camEye(){
      return[TGT[0]+cam.r*Math.cos(cam.el)*Math.sin(cam.az),TGT[1]+cam.r*Math.sin(cam.el),TGT[2]+cam.r*Math.cos(cam.el)*Math.cos(cam.az)];
    }

    // Controls
    const onMD=e=>{drag.on=true;drag.lx=e.clientX;drag.ly=e.clientY;};
    const onMU=()=>{drag.on=false;};
    const onMM=e=>{
      if(!drag.on) return;
      cam.az-=(e.clientX-drag.lx)*.006; drag.lx=e.clientX;
      cam.el=Math.max(-.04,Math.min(.52,cam.el+(e.clientY-drag.ly)*.005)); drag.ly=e.clientY;
    };
    const onWHL=e=>{cam.r=Math.max(1.6,Math.min(4.4,cam.r+e.deltaY*.008));e.preventDefault();};
    const onTS=e=>{
      if(e.touches.length===1){drag.lx=e.touches[0].clientX;drag.ly=e.touches[0].clientY;}
      if(e.touches.length===2) drag.pd=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
      e.preventDefault();
    };
    const onTM=e=>{
      if(e.touches.length===1){
        cam.az-=(e.touches[0].clientX-drag.lx)*.006; drag.lx=e.touches[0].clientX;
        cam.el=Math.max(-.04,Math.min(.52,cam.el+(e.touches[0].clientY-drag.ly)*.005)); drag.ly=e.touches[0].clientY;
      } else if(e.touches.length===2){
        const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
        cam.r=Math.max(1.6,Math.min(4.4,cam.r-(d-drag.pd)*.02)); drag.pd=d;
      }
      e.preventDefault();
    };
    canvas.addEventListener("mousedown",onMD);
    window.addEventListener("mouseup",  onMU);
    window.addEventListener("mousemove",onMM);
    canvas.addEventListener("wheel",    onWHL,{passive:false});
    canvas.addEventListener("touchstart",onTS,{passive:false});
    canvas.addEventListener("touchmove", onTM,{passive:false});

    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(.098,.098,.09,1);

    const raf={id:null};
    glState.current={gl,prog,LOC,surfBufs,furnBuf,furnNV,cam,TGT,raf,bindAttribs};

    function frame(){
      const dpr=Math.min(window.devicePixelRatio||1,2);
      const w=window.innerWidth,h=window.innerHeight;
      const pw=Math.round(w*dpr),ph=Math.round(h*dpr);
      if(canvas.width!==pw||canvas.height!==ph){
        canvas.width=pw; canvas.height=ph;
        canvas.style.width=w+"px"; canvas.style.height=h+"px";
        gl.viewport(0,0,pw,ph);
      }
      gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      const[ex,ey,ez]=camEye();
      const MVP=mul(persp(Math.PI/3,w/h,.08,30),lookAt(ex,ey,ez,...TGT));
      gl.uniformMatrix4fv(LOC.MVP,false,MVP);
      gl.uniform3f(LOC.L1,1.4,3.2,2.1);
      gl.uniform3f(LOC.L2,-1.0,1.2,-.8);
      gl.uniform1i(LOC.uTex,0);

      // Draw each surface
      for(const[key,{buf,nVerts}] of Object.entries(glState.current.surfBufs)){
        gl.bindBuffer(gl.ARRAY_BUFFER,buf);
        bindAttribs();
        const url=assignRef.current[key];
        const tex=url ? texCache.current[url] : null;
        gl.uniform1i(LOC.uUseTex, tex ? 1 : 0);
        if(tex){ gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,tex); }
        gl.drawArrays(gl.TRIANGLES,0,nVerts);
      }

      // Draw furniture (no texture)
      gl.bindBuffer(gl.ARRAY_BUFFER,glState.current.furnBuf);
      bindAttribs();
      gl.uniform1i(LOC.uUseTex,0);
      gl.drawArrays(gl.TRIANGLES,0,glState.current.furnNV);

      raf.id=requestAnimationFrame(frame);
    }
    raf.id=requestAnimationFrame(frame);

    return ()=>{
      cancelAnimationFrame(raf.id);
      canvas.removeEventListener("mousedown",onMD);
      window.removeEventListener("mouseup",onMU);
      window.removeEventListener("mousemove",onMM);
      canvas.removeEventListener("wheel",onWHL);
      canvas.removeEventListener("touchstart",onTS);
      canvas.removeEventListener("touchmove",onTM);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Update surface geometry when colors change ──────────────────────────────
  useEffect(()=>{
    const state=glState.current;
    if(!state) return;
    const{gl,surfBufs}=state;
    const surfData=buildSurfaces(dominant,secondary,accent);
    for(const[key,data] of Object.entries(surfData)){
      if(surfBufs[key]){
        gl.bindBuffer(gl.ARRAY_BUFFER,surfBufs[key].buf);
        gl.bufferData(gl.ARRAY_BUFFER,data,gl.DYNAMIC_DRAW);
      }
    }
  },[dominant,secondary,accent]);

  // ── Load texture when a new photo is assigned ───────────────────────────────
  useEffect(()=>{
    assignRef.current=assignments;
    const state=glState.current;
    if(!state) return;
    for(const url of Object.values(assignments)){
      if(url && !texCache.current[url]){
        texCache.current[url]=loadTexture(state.gl,url);
      }
    }
  },[assignments]);

  // ── ESC to close ────────────────────────────────────────────────────────────
  useEffect(()=>{
    const onKey=e=>{ if(e.key==="Escape") onClose(); };
    document.addEventListener("keydown",onKey);
    return()=>document.removeEventListener("keydown",onKey);
  },[onClose]);

  function assignTexture(surface, url) {
    setAssignments(prev=>({...prev,[surface]:url||null}));
    setPickerSurface(null);
  }

  return createPortal(
    <div className="fixed inset-0 z-[200] flex flex-col bg-[#191917]" style={{touchAction:"none"}}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full"/>

      {/* Top bar */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 flex items-start justify-between p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.08em] text-white/60">{roomLabel}</p>
          <p className="text-[11px] text-white/30">Glisser pour tourner · scroll / pincer pour zoomer</p>
        </div>
        <button type="button" onClick={onClose}
          className="pointer-events-auto grid h-9 w-9 place-items-center rounded-full bg-white/10 text-lg text-white hover:bg-white/20">
          ×
        </button>
      </div>

      {/* Surface picker panel — right side */}
      {availablePhotos.length > 0 && (
        <div className="pointer-events-auto absolute right-2 top-1/2 flex -translate-y-1/2 flex-col gap-1.5 sm:right-3"
          style={{maxHeight:"min(70vh, calc(100vh - 160px))",overflowY:"auto"}}>
          {Object.entries(SURFACE_LABELS).map(([key,label])=>{
            const assigned=assignments[key];
            const isOpen=pickerSurface===key;
            return(
              <div key={key} className="flex flex-col items-end gap-1">
                <button type="button"
                  onClick={()=>setPickerSurface(isOpen?null:key)}
                  className={`flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium shadow transition-all
                    ${isOpen?"bg-white text-slate-900":"bg-black/50 text-white/70 hover:bg-black/70 hover:text-white"}
                    border border-white/10 backdrop-blur-sm`}
                >
                  {assigned&&<span className="h-3 w-3 rounded-full border border-white/30 flex-shrink-0"
                    style={{backgroundImage:`url(${assigned})`,backgroundSize:"cover"}}/>}
                  {label}
                </button>
                {/* Remove texture button */}
                {assigned&&!isOpen&&(
                  <button type="button" onClick={()=>assignTexture(key,null)}
                    className="text-[10px] text-white/30 hover:text-white/60 pr-1">
                    retirer
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Photo picker — bottom strip */}
      {pickerSurface && availablePhotos.length > 0 && (
        <div className="pointer-events-auto absolute bottom-20 left-0 right-12 overflow-x-auto"
          style={{scrollbarWidth:"none"}}>
          <div className="flex gap-2 px-4 pb-2">
            {availablePhotos.map((photo,i)=>(
              <button key={i} type="button"
                onClick={()=>assignTexture(pickerSurface,photo.url)}
                className={`flex-shrink-0 overflow-hidden rounded-lg border-2 transition-all
                  ${assignments[pickerSurface]===photo.url?"border-white":"border-transparent hover:border-white/50"}`}
                style={{width:72,height:72}}>
                <img src={photo.url} alt={photo.label}
                  className="h-full w-full object-cover"
                  crossOrigin="anonymous"
                  onError={e=>{e.currentTarget.style.display="none";}}/>
              </button>
            ))}
          </div>
          <p className="px-4 text-[11px] text-white/30">
            Cliquer une photo pour l'appliquer sur <span className="text-white/60">{SURFACE_LABELS[pickerSurface]}</span>
          </p>
        </div>
      )}

      {/* Bottom palette */}
      <div className="pointer-events-none absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-3
        rounded-full border border-white/10 bg-black/50 px-5 py-2.5 backdrop-blur-sm">
        {[{hex:dominant,label:"Dominant"},{hex:secondary,label:"Secondaire"},{hex:accent,label:"Accent"}].map(({hex,label},i)=>(
          <div key={i} className="flex flex-col items-center gap-1.5">
            <div className="h-7 w-7 rounded-full border-[1.5px] border-white/25" style={{background:hex}}/>
            <span className="text-[10px] uppercase tracking-[.04em] text-white/40">{label}</span>
          </div>
        ))}
      </div>
    </div>,
    document.body
  );
}
