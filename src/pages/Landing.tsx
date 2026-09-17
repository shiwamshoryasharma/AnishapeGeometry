import { ThemeToggle } from '../components/ThemeToggle'
import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowRight, ArrowUpRight, Box, Check, ChevronDown, Cpu, FileBox, HardDrive, Layers3, Maximize2, Menu, MoveUpRight, Ruler, ShieldCheck, Square, X } from 'lucide-react'
import { Brand } from '../components/Brand'
import { Viewport, type ViewportHandle } from '../viewport/Viewport'
import { GeometryClient } from '../cad/worker-client'
import { applyCommand, createDocument } from '../cad/document'
import type { CadDocument, ModelResult } from '../cad/types'
import { UnitService } from '../cad/units'
interface Props {onNew:()=>void;onProjects:()=>void;onExample:(doc:CadDocument)=>void;onInfo:(topic:'guide'|'privacy')=>void}
export function Landing({onNew,onProjects,onExample,onInfo}:Props){
  const [menu,setMenu]=useState(false),[model,setModel]=useState<ModelResult|null>(null),[example,setExample]=useState<CadDocument|null>(null),[error,setError]=useState<string|null>(null)
  const viewport=useRef<ViewportHandle>(null)
  useEffect(()=>{
    const client=new GeometryClient();let active=true
    const build=async()=>{
      let doc=applyCommand(applyCommand(createDocument('Example · filleted plate','mm'),{type:'set-sketch',plane:'XY',x:0,y:0,width:80,height:50}),{type:'extrude',distance:16})
      const initial=await client.build(doc)
      doc=applyCommand(doc,{type:'fillet',radius:3,references:initial.edges.map(e=>e.reference)})
      const result=await client.build(doc)
      if(active){setModel(result);setExample(doc)}
    }
    void build().catch(cause=>{if(active)setError(cause instanceof Error?cause.message:'The example could not load.')})
    return()=>{active=false;client.dispose()}
  },[])
  const jump=()=>setMenu(false)
  return <div className="landing">
    <header className="site-header"><a href="#" className="brand-link" aria-label="AnishapeGeometry home"><Brand/></a>
      <nav aria-label="Main navigation" className={menu?'site-nav open':'site-nav'}><a href="#workflow" onClick={jump}>Product <ChevronDown size={13}/></a><a href="#precision" onClick={jump}>Precision</a><a href="#local" onClick={jump}>Your data</a><button onClick={()=>{setMenu(false);onInfo('guide')}}>Resources <ArrowUpRight size={13}/></button></nav>
      <div className="header-actions"><ThemeToggle/><button className="text-button projects-link" onClick={onProjects}>My projects</button><button className="button button-dark button-small" onClick={onNew}>Open workspace <ArrowUpRight size={15}/></button><button className="icon-button mobile-menu" aria-expanded={menu} aria-label={menu?'Close navigation':'Open navigation'} onClick={()=>setMenu(!menu)}>{menu?<X/>:<Menu/>}</button></div>
    </header>
    <main>
      <section className="hero-section">
        <div className="hero-copy"><div className="eyebrow"><span className="status-dot"/> INTRODUCING ANISHAPEGEOMETRY <span className="release-badge">EARLY ACCESS</span></div>
          <h1>Serious geometry.<br/>A simpler place<br/>to <span>create.</span></h1>
          <p className="hero-description">Precision CAD. Directly in your browser.<br/>Turn a sketch into an editable solid, keep your dimensions in control, and make something real.</p>
          <div className="hero-actions"><button className="button button-accent" onClick={onNew}>Open AnishapeGeometry <ArrowUpRight size={18}/></button><button className="text-button" onClick={onNew}>Try without account <ArrowRight size={16}/></button></div>
          <div className="hero-trust"><ShieldCheck size={16}/><span>Computed on your device. Saved in your browser.</span></div>
        </div>
        <div className="hero-visual">
          <div className="technical-label"><span>DESIGN STUDY / 001</span><span>PARAMETRIC SOLID</span></div>
          <div className="product-preview">
            <div className="preview-title"><span className="preview-dots"><i/><i/><i/></span><span>Filleted plate <span className="muted">/ Part studio</span></span><span className="live-label"><span className="status-dot"/>LIVE MODEL</span></div>
            <div className="preview-body">
              <aside className="preview-tree"><span>FEATURES</span><div><Square size={13}/> Sketch 1 <Check size={10}/></div><div><Box size={13}/> Extrude 1 <Check size={10}/></div><div className="selected"><Layers3 size={13}/> Fillet 1 <Check size={10}/></div><div className="tree-line"/><small>1 solid body</small></aside>
              <div className="preview-stage"><Viewport model={model} ref={viewport} compact/><div className="preview-axis"><b>X</b><b>Y</b><b>Z</b></div><button className="preview-fit icon-button" aria-label="Fit example model" onClick={()=>viewport.current?.fit()}><Maximize2 size={15}/></button>{!model&&<div className="preview-loading" role="status">{error?<><span>Example unavailable</span><small>{error}</small></>:<><span className="spinner"/><span>Preparing the live solid</span><small>Loading the local geometry engine</small></>}</div>}<div className="dimension-tag"><span>R</span> 3.000 <small>mm</small></div></div>
            </div>
            <div className="preview-status"><span><span className="status-dot"/> {model?'B-Rep geometry · valid solid':'Initializing local kernel'}</span><span>MM <span className="muted">/</span> ISO</span></div>
          </div>
          <div className="model-caption"><span><span className="caption-line"/>80 × 50 × 16 mm</span><span>DRAG TO ORBIT <MoveUpRight size={12}/></span></div>
          <div className="floating-spec"><span className="spec-icon"><Ruler size={19}/></span><div><small>DESIGNED WITH INTENT</small><strong>Every dimension. Still editable.</strong></div></div>
        </div>
      </section>
      <section className="capability-band" aria-label="Core capabilities"><div><Box/>Real B-Rep solids</div><div><Ruler/>Parametric dimensions</div><div><Cpu/>Browser computation</div><div><FileBox/>Validated STL export</div></section>
      <section className="workflow-section section-wrap" id="workflow">
        <div className="section-heading"><div><span className="eyebrow">A CLEAR PATH FROM IDEA TO OBJECT</span><h2>Sketch. Shape. Make.</h2></div><p>A focused first workflow, built around the decisions<br className="desktop-break"/> that matter to your part.</p></div>
        <div className="workflow-grid">
          <article className="workflow-item"><div className="workflow-art sketch-art"><svg viewBox="0 0 300 155" aria-label="Dimensioned rectangle sketch"><defs><pattern id="dots" width="15" height="15" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".8" fill="var(--grid-major)"/></pattern></defs><rect width="300" height="155" fill="url(#dots)"/><path d="M65 45H235V115H65Z" fill="var(--active)" fillOpacity=".6" stroke="var(--sketch-blue)" strokeWidth="1.8"/><path d="M65 34V18M235 34V18M65 25H235M48 45H30M48 115H30M37 45V115" stroke="var(--text-muted)" fill="none"/><text x="150" y="20" textAnchor="middle">80.000</text><text x="24" y="83" textAnchor="middle" transform="rotate(-90 24 83)">50.000</text>{[[65,45],[235,45],[235,115],[65,115]].map(([x,y])=><rect key={x+':'+y} x={x-3} y={y-3} width="6" height="6" fill="var(--raised)" stroke="var(--sketch-blue)"/>)}</svg></div><div className="step-heading"><span>01</span><h3>Start with a sketch</h3></div><p>Choose an origin or reference plane. Draw a rectangle or circle with driving dimensions and a defined position.</p><button className="inline-link" onClick={onNew}>Create a sketch <ArrowUpRight size={15}/></button></article>
          <article className="workflow-item"><div className="workflow-art solid-art"><svg viewBox="0 0 300 155" aria-label="Extruded solid diagram"><path d="m70 62 95-36 74 40-96 40Z" fill="var(--body)" stroke="var(--text-muted)"/><path d="m70 62 73 44v29L70 91Z" fill="var(--grid-major)" stroke="var(--text-muted)"/><path d="m143 106 96-40v29l-96 40Z" fill="var(--body-preview)" stroke="var(--text-muted)"/><path d="M252 64v31m-7-31h14m-14 31h14" fill="none" stroke="var(--text-muted)"/><text x="263" y="85">16</text></svg><span className="mini-chip"><Layers3 size={12}/> Feature history</span></div><div className="step-heading"><span>02</span><h3>Build a real solid</h3></div><p>Extrude or revolve profiles. Add holes, edge finishes, shells, patterns, and Boolean operations. Edit earlier dimensions to rebuild.</p><button className="inline-link" onClick={()=>example?onExample(example):onNew()}>Explore the example <ArrowUpRight size={15}/></button></article>
          <article className="workflow-item"><div className="workflow-art file-art"><div className="file-drawing"><FileBox size={32} strokeWidth={1.2}/><span>filleted-plate.stl</span><small>BINARY STL <span>MM</span></small></div><div className="validation-tag"><Check size={13}/> Closed mesh validation</div></div><div className="step-heading"><span>03</span><h3>Take it into the world</h3></div><p>Export exact STEP bodies or a checked STL with controlled tolerance. Keep an editable project backup with undo history.</p><button className="inline-link" onClick={()=>onInfo('guide')}>See the workflow <ArrowUpRight size={15}/></button></article>
        </div>
      </section>
      <section className="precision-section section-wrap" id="precision"><div className="precision-visual"><div className="precision-number">25<span>.123456789012</span><small>mm</small></div><div className="precision-scale">{Array.from({length:41},(_,i)=><i key={i} className={i%5===0?'long':''}/>)}</div><span>DISPLAY PRECISION / UP TO 12 DECIMAL PLACES</span></div><div><span className="eyebrow">PRECISION YOU CAN WORK WITH</span><h2>Your dimensions.<br/>Your design intent.</h2><p>Model values retain double precision. Display settings stay separate, so changing how a dimension looks never changes the geometry behind it.</p><div className="precision-points"><span><Check size={15}/> Six engineering units</span><span><Check size={15}/> Kernel-derived measurements</span><span><Check size={15}/> Transaction-based undo & redo</span></div></div></section>
      <section className="local-section" id="local"><div className="local-copy"><span className="eyebrow">A WORKSPACE THAT STAYS CLOSE</span><h2>Your ideas belong<br/>on your device.</h2><p>Geometry runs in a browser worker. Your projects save to this browser’s local database, with recovery snapshots and downloadable backups. No account is needed to begin.</p><button className="inline-link light" onClick={()=>onInfo('privacy')}>Understand local storage <ArrowUpRight size={15}/></button></div><div className="local-diagram"><div className="device-outline"><div className="device-top"><span/><span/><span/></div><div className="local-node"><Cpu size={26}/><div><strong>Geometry engine</strong><small>OpenCascade · WebAssembly</small></div><Check size={18}/></div><div className="connection-line"/><div className="local-node"><HardDrive size={26}/><div><strong>Your local projects</strong><small>IndexedDB · Recovery snapshots</small></div><ShieldCheck size={18}/></div><div className="device-note">ALL INSIDE YOUR BROWSER</div></div></div></section>
      <section className="formats-section section-wrap" id="formats"><div><span className="eyebrow">KNOW WHAT YOUR FILES CAN DO</span><h2>Keep the source.<br/>Export the shape.</h2><p>Export STEP solids or STL meshes. Save your editable features, dimensions, and bounded undo history in .anishape documents.</p></div><div className="formats-list"><div><span className="format-extension">.anishape</span><span>Editable project · open & save</span><Check size={16}/></div><div><span className="format-extension">.stl</span><span>Binary & ASCII · export</span><Check size={16}/></div><div><span className="format-extension">.step</span><span>B-Rep solids · export</span><Check size={16}/></div><div className="planned-format"><span className="format-extension">IGES / DXF</span><span>Planned</span><span className="roadmap-dot"/></div></div></section>
      <section className="getting-started section-wrap"><div><span className="eyebrow">LESS SETUP. MORE MAKING.</span><h2>Your next part<br/>starts right here.</h2><p>Open a workspace, choose your units, and draw your first rectangle.</p><button className="button button-accent" onClick={onNew}>Create your first project <ArrowUpRight size={18}/></button></div><ol><li><span>01</span><div><strong>Open a local project</strong><p>Give it a name and choose your units.</p></div></li><li><span>02</span><div><strong>Sketch and extrude</strong><p>Set the dimensions. Add depth. Refine an edge.</p></div></li><li><span>03</span><div><strong>Save, return, and build on it</strong><p>Reopen locally or download an editable backup.</p></div></li></ol></section>
      <div className="release-note section-wrap"><span className="status-dot"/><p>Early access · Multiple bodies, solid features, editable spur gears, and STEP/STL export. General sketch solving, surface modeling, sheet metal, assemblies, and drawings remain planned.</p><a href="#workflow" aria-label="Back to workflow"><ArrowDown size={18}/></a></div>
    </main>
    <footer className="site-footer"><div><Brand/><p>Precision CAD. Directly in your browser.</p></div><div className="footer-links"><button onClick={()=>onInfo('guide')}>Modeling guide</button><button onClick={()=>onInfo('privacy')}>Privacy & local data</button><button onClick={onProjects}>Local projects</button></div><span>© {new Date().getFullYear()} AnishapeGeometry</span></footer>
    <span className="sr-only">{model?UnitService.format(model.volume,'mm',3,3):''}</span>
  </div>
}
