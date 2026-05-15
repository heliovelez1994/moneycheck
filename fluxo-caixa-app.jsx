import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from "recharts";

// ─── Constants ────────────────────────────────────────────────────────────────
const STORAGE_KEY = "fluxo-caixa-v4";
const MONTHS      = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const MONTHS_FULL = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const CATS = {
  receita: ["Salário","Conta","13º Salário","PLR","Férias","Abono","Itaú","Nilce","Cláudio","Outros"],
  despesa: ["Apartamento","Nubank","Diarista","Celular","Itaú","Amortização","Viagem","Discos","Outros"],
};
const CAT_ICONS = {
  "Salário":"💼","Conta":"🏦","13º Salário":"🎁","PLR":"🏆","Férias":"🌴","Abono":"📋",
  "Nilce":"👤","Cláudio":"👤","Apartamento":"🏠","Nubank":"💳","Diarista":"🧹",
  "Celular":"📱","Amortização":"🏗️","Viagem":"✈️","Discos":"💿","Outros":"📦","Itaú":"🏛️",
  "Cartão de Crédito":"💳",
};

// ─── Data helpers ─────────────────────────────────────────────────────────────
const emptyMonth = () => ({ receitas: [], despesas: [] });
const emptyYear  = () => { const m={}; for(let i=0;i<12;i++) m[i]=emptyMonth(); return { months:m }; };
const uid  = () => Math.random().toString(36).slice(2);
const fmt  = v => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL",minimumFractionDigits:0,maximumFractionDigits:0}).format(v||0);
const fmtK = v => { const a=Math.abs(v); return (v<0?"-":"")+(a>=1000?`${(a/1000).toFixed(1)}k`:a.toFixed(0)); };
const catIcon = desc => CAT_ICONS[desc] || "📌";

function calcMonth(month) {
  const tPR = month.receitas.reduce((s,r)=>s+(r.planned||0),0);
  const tPE = month.despesas.reduce((s,r)=>s+(r.planned||0),0);
  const tAR = month.receitas.reduce((s,r)=>s+(r.actual!=null?r.actual:(r.planned||0)),0);
  const tAE = month.despesas.reduce((s,r)=>s+(r.actual!=null?r.actual:(r.planned||0)),0);
  return { tPR, tPE, tAR, tAE, planned:tPR-tPE, actual:tAR-tAE };
}

function calcCumulative(yearData, upToMonth) {
  let cumPlanned=0, cumActual=0;
  for(let i=0;i<=upToMonth;i++){
    const s=calcMonth(yearData.months[i]||emptyMonth());
    cumPlanned+=s.planned; cumActual+=s.actual;
  }
  return { cumPlanned, cumActual };
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg:"#030712", surface:"#080e1d", card:"#0c1422",
  border:"#1a2744", borderHover:"#2a4070",
  green:"#4ade80", greenDim:"#4ade8022", greenBorder:"#4ade8033",
  purple:"#a78bfa", purpleDim:"#a78bfa22",
  blue:"#60a5fa",  blueDim:"#60a5fa22",
  red:"#f87171",   redDim:"#f8717122",
  orange:"#fb923c",yellow:"#fbbf24",
  text:"#f8fafc",      // muito mais claro
  textMid:"#cbd5e1",   // médio claro
  textDim:"#94a3b8",   // subtítulos visíveis
  textFaint:"#64748b", // apenas detalhes
};

const inp = (extra={}) => ({
  background:C.surface, border:`1px solid ${C.border}`, borderRadius:10,
  color:C.text, padding:"11px 14px", fontSize:14, fontFamily:"inherit",
  outline:"none", transition:"border-color .2s", ...extra
});

const glassCard = (accent="#4ade80", extra={}) => ({
  background:`linear-gradient(145deg,${accent}14 0%,${C.card} 55%)`,
  border:`1px solid ${accent}28`, borderRadius:20,
  padding:"22px 24px", position:"relative", overflow:"hidden", ...extra
});

// ─── Global styles ────────────────────────────────────────────────────────────
const STYLES = `
  @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:.4} }
  @keyframes glow   { 0%,100%{box-shadow:0 0 8px #4ade8066} 50%{box-shadow:0 0 16px #4ade80aa} }
  .fade-up  { animation: fadeUp .3s ease both; }
  .row-hover:hover { background:#0d1a2d !important; transform:translateX(3px); transition:all .15s ease; }
  .btn-hover:hover { opacity:.82; transform:scale(.96); transition:all .15s; }
  input:focus, select:focus { border-color:#60a5fa !important; box-shadow:0 0 0 3px #60a5fa1a; }
  ::-webkit-scrollbar { width:4px; height:4px; }
  ::-webkit-scrollbar-track { background:#080e1d; }
  ::-webkit-scrollbar-thumb { background:#1a2744; border-radius:99px; }
`;

// ─── Status pill ──────────────────────────────────────────────────────────────
function StatusPill({ actual, planned, isReceita=false }) {
  if (!planned) return null;
  const v = (actual/planned)*100;
  let bg,tx,label,ico;
  if(isReceita){
    // receita: mais é melhor
    [bg,tx,label,ico] =
      v>=100 ? [C.greenDim, C.green,  "Ótimo",   "🚀"] :
      v>=50  ? ["#fbbf2422",C.yellow, "Parcial", "🔔"] :
               [C.redDim,   C.red,    "Baixo",   "⚠️"];
  } else {
    // despesa: menos é melhor
    [bg,tx,label,ico] =
      v>=100 ? [C.redDim,    C.red,    "Excedido","🚨"] :
      v>=90  ? ["#fb923c22", C.orange, "Crítico", "⚠️"] :
      v>=75  ? ["#fbbf2422", C.yellow, "Atenção", "🔔"] :
               [C.greenDim,  C.green,  "OK",      "✅"];
  }
  return (
    <span style={{display:"inline-flex",alignItems:"center",gap:5,background:bg,color:tx,
      border:`1px solid ${tx}44`,borderRadius:99,padding:"4px 11px",
      fontSize:12,fontWeight:700,whiteSpace:"nowrap",letterSpacing:0.3}}>
      <span>{ico}</span>{label} · {v.toFixed(0)}%
    </span>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ actual, planned, label, ico, isReceita=false }) {
  if (!planned) return null;
  const pct = Math.min((actual/planned)*100,100);
  const rawPct = (actual/planned)*100;
  let color;
  if(isReceita){
    color = rawPct>=100?C.green:rawPct>=50?C.yellow:C.red;
  } else {
    color = rawPct>100?C.red:rawPct>=90?C.orange:rawPct>=75?C.yellow:C.green;
  }
  return (
    <div style={{marginBottom:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}>
        <span style={{color:C.textMid,fontSize:14,display:"flex",alignItems:"center",gap:7,fontWeight:600}}>
          {ico && <span style={{fontSize:16}}>{ico}</span>}{label}
        </span>
        <span style={{fontSize:14,fontWeight:800,color}}>
          {fmt(actual)}
          <span style={{color:C.textDim,fontWeight:500,fontSize:13}}> / {fmt(planned)}</span>
        </span>
      </div>
      <div style={{background:"#050a12",borderRadius:99,height:8,overflow:"hidden"}}>
        <div style={{width:`${pct}%`,
          background:`linear-gradient(90deg,${color}77,${color})`,
          height:"100%",borderRadius:99,
          transition:"width .65s cubic-bezier(.4,0,.2,1)",
          boxShadow:`0 0 10px ${color}55`}}/>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
        <span style={{fontSize:11,color:C.textFaint}}>{isReceita?"Realizado":"Gasto"}</span>
        <span style={{fontSize:12,color,fontWeight:700}}>{rawPct.toFixed(0)}%</span>
      </div>
    </div>
  );
}

// ─── Hero Cards ───────────────────────────────────────────────────────────────
function BalanceHero({ planned, actual, cumPlanned, cumActual, monthLabel }) {
  const delta    = actual - planned;
  const cumDelta = cumActual - cumPlanned;

  const Card = ({ title, ico, mainVal, subLabel, subVal, dv, accent }) => (
    <div style={glassCard(accent,{flex:1,minWidth:0})}>
      <div style={{position:"absolute",top:-50,right:-50,width:160,height:160,borderRadius:"50%",
        background:`radial-gradient(circle,${accent}1a,transparent 70%)`,pointerEvents:"none"}}/>
      <div style={{position:"absolute",bottom:-30,left:-30,width:100,height:100,borderRadius:"50%",
        background:`radial-gradient(circle,${accent}0d,transparent 70%)`,pointerEvents:"none"}}/>

      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
        <div style={{width:36,height:36,borderRadius:11,background:`${accent}25`,
          display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,
          boxShadow:`0 2px 8px ${accent}33`}}>{ico}</div>
        <span style={{fontSize:12,color:accent,fontWeight:800,letterSpacing:1,textTransform:"uppercase"}}>{title}</span>
      </div>

      <div style={{fontSize:36,fontWeight:900,lineHeight:1,marginBottom:10,
        color:mainVal>=0?accent:C.red,
        textShadow:`0 0 24px ${mainVal>=0?accent:C.red}55`}}>
        {fmt(mainVal)}
      </div>

      <div style={{fontSize:15,color:C.textMid,marginBottom:18,fontWeight:600}}>
        {subLabel}:{" "}
        <span style={{color:C.textDim,fontWeight:800}}>{fmt(subVal)}</span>
      </div>

      <div style={{display:"inline-flex",alignItems:"center",gap:7,
        background:`${dv>=0?accent:C.red}18`,border:`1px solid ${dv>=0?accent:C.red}38`,
        borderRadius:11,padding:"8px 16px",fontSize:14,fontWeight:800,color:dv>=0?accent:C.red}}>
        <span style={{fontSize:16}}>{dv>=0?"📈":"📉"}</span>
        {fmt(Math.abs(dv))} {dv>=0?"acima":"abaixo"} do plano
      </div>
    </div>
  );

  return (
    <div style={{display:"flex",gap:16,marginBottom:22,flexWrap:"wrap"}} className="fade-up">
      <Card title={`Saldo · ${monthLabel}`} ico="📅"
        mainVal={actual} subLabel="Planejado" subVal={planned} dv={delta} accent={C.blue}/>
      <Card title={`Acumulado Jan–${monthLabel}`} ico="📊"
        mainVal={cumActual} subLabel="Planejado acum." subVal={cumPlanned} dv={cumDelta} accent={C.purple}/>
    </div>
  );
}

// ─── Entry Row ────────────────────────────────────────────────────────────────
function EntryRow({ entry, type, onUpdate, onDelete }) {
  const [editing,setEditing] = useState(false);
  const [ld,setLd] = useState(entry.desc);
  const [lp,setLp] = useState(entry.planned||"");
  const [la,setLa] = useState(entry.actual!=null?entry.actual:"");

  const save = () => {
    onUpdate(entry.id,{desc:ld,planned:parseFloat(lp)||0,actual:la!==""?parseFloat(la):null});
    setEditing(false);
  };

  const isRec  = type==="receita";
  const col    = isRec?C.green:C.red;
  const actVal = entry.actual!=null?entry.actual:entry.planned;
  const diff   = entry.actual!=null?entry.actual-entry.planned:0;

  if(editing) return (
    <tr style={{background:"#091220",borderBottom:`1px solid ${C.border}`}}>
      <td style={{padding:"10px 12px"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:20}}>{catIcon(ld)}</span>
          <input list={`ec-${type}-${entry.id}`} value={ld} onChange={e=>setLd(e.target.value)}
            style={inp({flex:1})}/>
          <datalist id={`ec-${type}-${entry.id}`}>
            {CATS[isRec?"receita":"despesa"].map(c=><option key={c} value={c}/>)}
          </datalist>
        </div>
      </td>
      <td style={{padding:"10px 12px"}}>
        <input type="number" value={lp} onChange={e=>setLp(e.target.value)}
          style={inp({width:120})} placeholder="Planejado"/>
      </td>
      <td style={{padding:"10px 12px"}}>
        <input type="number" value={la} onChange={e=>setLa(e.target.value)}
          style={inp({width:120})} placeholder="Realizado"/>
      </td>
      <td style={{padding:"10px 12px"}}>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          <button onClick={save} className="btn-hover"
            style={{background:C.greenDim,border:`1px solid ${C.green}55`,borderRadius:9,
            color:C.green,padding:"7px 14px",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:800}}>
            ✓ Salvar
          </button>
          <button onClick={()=>setEditing(false)} className="btn-hover"
            style={{background:"#1e293b",border:`1px solid ${C.border}`,borderRadius:9,
            color:C.textMid,padding:"7px 12px",cursor:"pointer",fontFamily:"inherit",fontSize:13}}>✕</button>
        </div>
      </td>
    </tr>
  );

  return (
    <tr className="row-hover" style={{borderBottom:`1px solid ${C.border}18`}}>
      <td style={{padding:"12px 12px"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:34,height:34,borderRadius:10,background:`${col}18`,
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>
            {catIcon(entry.desc)}
          </div>
          <div>
            <div style={{color:C.text,fontSize:14,fontWeight:600}}>{entry.desc}</div>
            {entry.recurrent && (
              <div style={{fontSize:11,color:C.purple,fontWeight:700,display:"flex",alignItems:"center",gap:3}}>
                🔁 Recorrente
              </div>
            )}
          </div>
        </div>
      </td>
      <td style={{padding:"12px 12px",color:C.textDim,fontSize:14,fontWeight:800}}>{fmt(entry.planned)}</td>
      <td style={{padding:"12px 12px",fontSize:14}}>
        {entry.actual!=null
          ? <div style={{display:"flex",flexDirection:"column",gap:2}}>
              <span style={{color:isRec?C.green:C.red,fontWeight:800}}>{fmt(entry.actual)}</span>
              {diff!==0 && (
                <span style={{fontSize:11,fontWeight:700,
                  color:isRec?(diff>0?C.green:C.red):(diff>0?C.red:C.green),
                  display:"flex",alignItems:"center",gap:3}}>
                  {isRec?(diff>0?"▲":"▼"):(diff>0?"▲":"▼")} {fmt(Math.abs(diff))}
                </span>
              )}
            </div>
          : <span style={{color:C.textFaint,fontStyle:"italic",fontSize:13,display:"flex",alignItems:"center",gap:4}}>
              🔄 = planejado
            </span>}
      </td>
      <td style={{padding:"12px 12px"}}>
        <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
          {!isRec && entry.planned>0 && <StatusPill actual={actVal} planned={entry.planned} isReceita={false}/>}
          {isRec  && entry.planned>0 && <StatusPill actual={actVal} planned={entry.planned} isReceita={true}/>}
          <button onClick={()=>setEditing(true)} className="btn-hover"
            style={{background:C.blueDim,border:`1px solid ${C.blue}44`,borderRadius:8,
            color:C.blue,padding:"5px 11px",cursor:"pointer",fontSize:13,fontWeight:700}}>✎</button>
          <button onClick={()=>onDelete(entry.id)} className="btn-hover"
            style={{background:C.redDim,border:`1px solid ${C.red}44`,borderRadius:8,
            color:C.red,padding:"5px 11px",cursor:"pointer",fontSize:13,fontWeight:700}}>✕</button>
        </div>
      </td>
    </tr>
  );
}

// ─── Credit Card Widget ───────────────────────────────────────────────────────
function CreditCardWidget({ monthData, onUpdateMonth }) {
  const [newCharge,setNewCharge] = useState("");
  const [newCat,setNewCat]       = useState("");
  const [editPlan,setEditPlan]   = useState(false);
  const [planInput,setPlanInput] = useState("");
  const [collapsed,setCollapsed] = useState(true);

  const charges    = monthData.ccCharges||[];
  const totalCharges = charges.reduce((s,c)=>s+c.value,0);
  const cartaoEntry  = monthData.despesas.find(e=>e.desc==="Cartão de Crédito");
  const planned      = cartaoEntry?.planned||0;
  const pctRaw       = planned>0?(totalCharges/planned)*100:0;
  const pct          = Math.min(pctRaw,100);
  const barColor     = pctRaw>100?C.red:pctRaw>=90?C.orange:pctRaw>=75?C.yellow:C.green;

  const syncDespesas = (newCharges, newPlanned) => {
    const total = newCharges.reduce((s,c)=>s+c.value,0);
    let newDesp = [...monthData.despesas];
    const idx   = newDesp.findIndex(e=>e.desc==="Cartão de Crédito");
    const entry = {
      id: idx>=0?newDesp[idx].id:uid(),
      desc:"Cartão de Crédito",
      planned: newPlanned!=null?newPlanned:(idx>=0?newDesp[idx].planned:0),
      actual:  newCharges.length>0?total:null,
      recurrent:false,
    };
    if(idx>=0) newDesp[idx]=entry; else newDesp.push(entry);
    onUpdateMonth({...monthData, ccCharges:newCharges, despesas:newDesp});
  };

  const addCharge = () => {
    const v=parseFloat(newCharge);
    if(!v||v<=0) return;
    const cat = newCat.trim()||"Sem categoria";
    const newCharges=[...charges,{id:uid(),value:v,date:new Date().toLocaleDateString("pt-BR"),category:cat}];
    syncDespesas(newCharges,null);
    setNewCharge(""); setNewCat("");
  };

  const removeCharge = (cid) => {
    const newCharges=charges.filter(c=>c.id!==cid);
    syncDespesas(newCharges,null);
  };

  const savePlan = () => {
    const v=parseFloat(planInput)||0;
    syncDespesas(charges,v);
    setEditPlan(false);
  };

  // categorias distintas já usadas para sugestão
  const usedCats = [...new Set(charges.map(c=>c.category).filter(Boolean))];

  return (
    <div style={{background:`linear-gradient(145deg,#1e3a5f1a,${C.card})`,
      border:`1px solid #3b82f644`,borderRadius:16,padding:"18px 20px",marginBottom:18}}>

      {/* Header row */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
        marginBottom:collapsed?0:14,flexWrap:"wrap",gap:10}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:38,height:38,borderRadius:11,
            background:"linear-gradient(135deg,#3b82f633,#1e3a5f66)",
            border:"1px solid #3b82f644",
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>💳</div>
          <div>
            <div style={{fontSize:15,color:C.text,fontWeight:800}}>Cartão de Crédito</div>
            <div style={{fontSize:12,color:C.textDim}}>
              {charges.length} gasto{charges.length!==1?"s":""} · <span style={{color:C.red,fontWeight:700}}>{fmt(totalCharges)}</span>
            </div>
          </div>
        </div>
        <div style={{display:"flex",gap:14,alignItems:"center",flexWrap:"wrap"}}>
          {/* Planned value */}
          <div>
            <div style={{fontSize:11,color:C.textDim,fontWeight:600,marginBottom:2}}>PREVISTO NO MÊS</div>
            {editPlan?(
              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                <input type="number" value={planInput} onChange={e=>setPlanInput(e.target.value)}
                  autoFocus onKeyDown={e=>{if(e.key==="Enter")savePlan();if(e.key==="Escape")setEditPlan(false);}}
                  style={inp({width:130,padding:"6px 10px",fontSize:13})} placeholder="R$ 0"/>
                <button onClick={savePlan} className="btn-hover"
                  style={{background:C.greenDim,border:`1px solid ${C.green}44`,borderRadius:7,
                  color:C.green,padding:"6px 10px",cursor:"pointer",fontSize:13,fontWeight:800}}>✓</button>
              </div>
            ):(
              <div style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}
                onClick={()=>{setPlanInput(planned||"");setEditPlan(true);}}>
                <span style={{fontSize:18,fontWeight:900,color:C.textDim}}>
                  {planned?fmt(planned):"Definir →"}
                </span>
                <span style={{fontSize:11,color:C.textFaint}}>✎</span>
              </div>
            )}
          </div>
          {/* Total charged */}
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:11,color:C.textDim,fontWeight:600,marginBottom:2}}>TOTAL GASTO</div>
            <div style={{fontSize:22,fontWeight:900,color:C.red}}>{fmt(totalCharges)}</div>
          </div>
          {/* Toggle collapse */}
          <button onClick={()=>setCollapsed(c=>!c)} className="btn-hover"
            style={{background:C.blueDim,border:`1px solid ${C.blue}44`,borderRadius:9,
            color:C.blue,padding:"7px 13px",cursor:"pointer",fontSize:13,fontWeight:800,
            display:"flex",alignItems:"center",gap:5}}>
            {collapsed?"▼ Ver gastos":"▲ Recolher"}
          </button>
        </div>
      </div>

      {!collapsed && (<>
        {/* Progress */}
        {planned>0&&(
          <div style={{marginBottom:14}}>
            <div style={{background:"#050a12",borderRadius:99,height:8,overflow:"hidden",marginBottom:5}}>
              <div style={{width:`${pct}%`,
                background:`linear-gradient(90deg,${barColor}77,${barColor})`,
                height:"100%",borderRadius:99,transition:"width .5s ease",
                boxShadow:`0 0 10px ${barColor}55`}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
              <span style={{color:C.textDim}}>{charges.length} gasto{charges.length!==1?"s":""} registrado{charges.length!==1?"s":""}</span>
              <span style={{color:barColor,fontWeight:700}}>{pctRaw.toFixed(0)}% do previsto</span>
            </div>
          </div>
        )}

        {/* Quick-add */}
        <div style={{display:"flex",gap:10,alignItems:"stretch",flexWrap:"wrap",marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",gap:8,flex:"1 1 140px",minWidth:140,
            background:C.surface,border:`1px solid #3b82f655`,borderRadius:10,padding:"0 14px"}}>
            <span style={{fontSize:15,color:C.textDim,fontWeight:700}}>R$</span>
            <input type="number" value={newCharge} onChange={e=>setNewCharge(e.target.value)}
              placeholder="Valor"
              style={{background:"transparent",border:"none",outline:"none",color:C.text,
                fontSize:15,fontFamily:"inherit",padding:"12px 0",flex:1,fontWeight:600}}
              onKeyDown={e=>e.key==="Enter"&&addCharge()}/>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,flex:"1 1 160px",minWidth:160,
            background:C.surface,border:`1px solid #3b82f655`,borderRadius:10,padding:"0 14px"}}>
            <span style={{fontSize:14,color:C.textDim}}>🏷️</span>
            <input list="cc-cats" value={newCat} onChange={e=>setNewCat(e.target.value)}
              placeholder="Categoria (ex: Restaurante)"
              style={{background:"transparent",border:"none",outline:"none",color:C.text,
                fontSize:14,fontFamily:"inherit",padding:"12px 0",flex:1}}
              onKeyDown={e=>e.key==="Enter"&&addCharge()}/>
            <datalist id="cc-cats">
              {usedCats.map(c=><option key={c} value={c}/>)}
            </datalist>
          </div>
          <button onClick={addCharge} className="btn-hover"
            style={{background:"#3b82f622",border:"1px solid #3b82f655",borderRadius:10,
            color:C.blue,padding:"0 20px",cursor:"pointer",fontFamily:"inherit",
            fontSize:14,fontWeight:800,display:"flex",alignItems:"center",gap:7,whiteSpace:"nowrap"}}>
            <span style={{fontSize:18}}>＋</span> Adicionar
          </button>
        </div>

        {/* Charges list */}
        {charges.length>0&&(
          <div style={{background:"#050a12",borderRadius:10,overflow:"hidden",border:`1px solid ${C.border}`}}>
            <div style={{padding:"8px 14px",borderBottom:`1px solid ${C.border}`,
              display:"grid",gridTemplateColumns:"110px 1fr 1fr 40px",
              fontSize:11,color:C.textDim,fontWeight:700,letterSpacing:0.6,gap:8}}>
              <span>DATA</span><span>CATEGORIA</span><span style={{textAlign:"right"}}>VALOR</span><span/>
            </div>
            {charges.map((c,i)=>(
              <div key={c.id} className="row-hover"
                style={{display:"grid",gridTemplateColumns:"110px 1fr 1fr 40px",alignItems:"center",gap:8,
                padding:"10px 14px",borderBottom:i<charges.length-1?`1px solid ${C.border}18`:"none"}}>
                <span style={{fontSize:12,color:C.textDim,fontWeight:600}}>{c.date}</span>
                <span style={{fontSize:13,color:C.textMid,fontWeight:600,
                  background:`${C.blue}12`,border:`1px solid ${C.blue}22`,
                  borderRadius:6,padding:"2px 8px",display:"inline-block",maxWidth:"100%",
                  overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                  🏷️ {c.category||"Sem categoria"}
                </span>
                <div style={{textAlign:"right",fontSize:15,fontWeight:800,color:C.red}}>{fmt(c.value)}</div>
                <button onClick={()=>removeCharge(c.id)} className="btn-hover"
                  style={{background:C.redDim,border:`1px solid ${C.red}33`,borderRadius:7,
                  color:C.red,padding:"4px 8px",cursor:"pointer",fontSize:12,fontWeight:700,
                  justifySelf:"end"}}>✕</button>
              </div>
            ))}
            <div style={{padding:"10px 14px",background:`${C.red}0a`,borderTop:`1px solid ${C.border}`,
              display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:12,color:C.textDim,fontWeight:700}}>TOTAL CARTÃO</span>
              <span style={{fontSize:17,fontWeight:900,color:C.red}}>{fmt(totalCharges)}</span>
            </div>
          </div>
        )}
      </>)}
    </div>
  );
}

// ─── Month Panel ──────────────────────────────────────────────────────────────
function MonthPanel({ monthData, monthIdx, year, onUpdateMonth, cumPlanned, cumActual, allYearData, onUpdateYear }) {
  const [desc,setDesc]       = useState("");
  const [val,setVal]         = useState("");
  const [addType,setAddType] = useState("receita");
  const [showAdd,setShowAdd] = useState(false);
  const [repeat,setRepeat]   = useState(false);
  const [repeatMode,setRepeatMode] = useState("months"); // "months" | "forever"
  const [repeatCount,setRepeatCount] = useState(3);

  const stats    = calcMonth(monthData);
  const expPct   = stats.tPE>0?(stats.tAE/stats.tPE)*100:0;
  const alertColor = expPct>=100?C.red:expPct>=90?C.orange:expPct>=75?C.yellow:C.green;

  const add = () => {
    if(!desc||!val) return;
    const newEntry = {id:uid(),desc,planned:parseFloat(val),actual:null,recurrent:repeat};

    // Build updated year to apply repetition
    const updatedYear = { months: {...allYearData.months} };

    // Always add to current month
    const curMonth = {...(updatedYear.months[monthIdx]||emptyMonth())};
    curMonth[addType==="receita"?"receitas":"despesas"] = [
      ...curMonth[addType==="receita"?"receitas":"despesas"],
      newEntry
    ];
    updatedYear.months[monthIdx] = curMonth;

    // Apply to future months if repeat
    if(repeat) {
      const maxMonth = repeatMode==="forever" ? 11 : Math.min(monthIdx + repeatCount, 11);
      for(let m = monthIdx+1; m <= maxMonth; m++){
        const futureMonth = {...(updatedYear.months[m]||emptyMonth())};
        const key = addType==="receita"?"receitas":"despesas";
        futureMonth[key] = [...futureMonth[key], {...newEntry,id:uid()}];
        updatedYear.months[m] = futureMonth;
      }
    }

    onUpdateYear(updatedYear);
    setDesc(""); setVal(""); setRepeat(false); setRepeatCount(3); setShowAdd(false);
  };

  const updEntry=(type,id,ch)=>{
    const k=type==="receita"?"receitas":"despesas";
    onUpdateMonth({...monthData,[k]:monthData[k].map(e=>e.id===id?{...e,...ch}:e)});
  };
  const delEntry=(type,id)=>{
    const k=type==="receita"?"receitas":"despesas";
    onUpdateMonth({...monthData,[k]:monthData[k].filter(e=>e.id!==id)});
  };

  const barData = monthData.despesas.map(d=>({
    name:d.desc.length>10?d.desc.slice(0,9)+"…":d.desc,
    Planejado:d.planned, Realizado:d.actual!=null?d.actual:d.planned,
  }));

  const remainingMonths = 11 - monthIdx;

  return (
    <div className="fade-up">
      {/* Credit Card Widget - always at the top */}
      <CreditCardWidget monthData={monthData} onUpdateMonth={onUpdateMonth}/>

      <BalanceHero planned={stats.planned} actual={stats.actual}
        cumPlanned={cumPlanned} cumActual={cumActual} monthLabel={MONTHS[monthIdx]}/>

      {/* Control card */}
      <div style={{...glassCard(alertColor,{marginBottom:18})}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:40,height:40,borderRadius:12,background:`${alertColor}22`,
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,
              boxShadow:`0 2px 10px ${alertColor}33`}}>
              {expPct>=100?"🚨":expPct>=90?"⚠️":expPct>=75?"🔔":"✅"}
            </div>
            <div>
              <div style={{fontSize:15,color:C.text,fontWeight:800}}>Controle de Gastos</div>
              <div style={{fontSize:13,color:C.textDim}}>{MONTHS_FULL[monthIdx]}</div>
            </div>
          </div>
          <StatusPill actual={stats.tAE} planned={stats.tPE} isReceita={false}/>
        </div>
        <ProgressBar actual={stats.tAR} planned={stats.tPR} label="Receitas realizadas" ico="💰" isReceita={true}/>
        <ProgressBar actual={stats.tAE} planned={stats.tPE} label="Despesas realizadas" ico="💸" isReceita={false}/>

        <div style={{display:"flex",gap:28,marginTop:12,paddingTop:14,
          borderTop:`1px solid ${C.border}`,flexWrap:"wrap"}}>
          {[
            {label:"Saldo do mês",val:stats.actual,color:C.blue},
            {label:"Acumulado",   val:cumActual,   color:C.purple},
            {label:"Receitas",    val:stats.tAR,   color:C.green},
            {label:"Despesas",    val:stats.tAE,   color:C.red},
          ].map(({label,val,color})=>(
            <div key={label}>
              <div style={{fontSize:12,color:C.textDim,marginBottom:3,fontWeight:600}}>{label}</div>
              <div style={{fontSize:17,fontWeight:900,color}}>{fmt(val)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tables */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
        {[
          {type:"receita",label:"Receitas",ico:"💰",items:monthData.receitas,color:C.green,tp:stats.tPR,ta:stats.tAR},
          {type:"despesa",label:"Despesas",ico:"💸",items:monthData.despesas,color:C.red,  tp:stats.tPE,ta:stats.tAE},
        ].map(({type,label,ico,items,color,tp,ta})=>(
          <div key={type} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,overflow:"hidden",minWidth:0}}>
            <div style={{background:`${color}0d`,padding:"14px 16px",borderBottom:`1px solid ${C.border}`,
              display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:20}}>{ico}</span>
                <span style={{color,fontSize:13,fontWeight:900,letterSpacing:0.5}}>{label.toUpperCase()}</span>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{color,fontSize:16,fontWeight:900}}>{fmt(ta)}</div>
                <div style={{fontSize:12,color:C.textDim}}>plan. <span style={{color:C.textDim,fontWeight:700}}>{fmt(tp)}</span></div>
              </div>
            </div>
            <table style={{width:"100%",borderCollapse:"collapse",tableLayout:"fixed"}}>
              <colgroup>
                <col style={{width:"36%"}}/><col style={{width:"20%"}}/>
                <col style={{width:"25%"}}/><col style={{width:"19%"}}/>
              </colgroup>
              <thead>
                <tr style={{background:"#05080f"}}>
                  {["Item","Planejado","Realizado","Status"].map(h=>(
                    <th key={h} style={{padding:"9px 12px",textAlign:"left",fontSize:11,
                      color:C.textDim,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.length===0 && (
                  <tr><td colSpan={4} style={{padding:"28px 12px",textAlign:"center"}}>
                    <div style={{fontSize:32,marginBottom:8}}>📭</div>
                    <div style={{color:C.textFaint,fontSize:13,fontStyle:"italic"}}>Nenhum lançamento</div>
                  </td></tr>
                )}
                {items.map(entry=>(
                  <EntryRow key={entry.id} entry={entry} type={type}
                    onUpdate={(id,ch)=>updEntry(type,id,ch)}
                    onDelete={id=>delEntry(type,id)}/>
                ))}
              </tbody>
              <tfoot>
                <tr style={{background:`${color}0a`,borderTop:`1px solid ${C.border}`}}>
                  <td style={{padding:"10px 12px",fontSize:12,color:C.textMid,fontWeight:800}}>TOTAL</td>
                  <td style={{padding:"10px 12px",color:C.textDim,fontSize:14,fontWeight:900}}>{fmt(tp)}</td>
                  <td style={{padding:"10px 12px",color,fontSize:14,fontWeight:900}}>{fmt(ta)}</td>
                  <td/>
                </tr>
              </tfoot>
            </table>
          </div>
        ))}
      </div>

      {/* Add entry */}
      {!showAdd ? (
        <button onClick={()=>setShowAdd(true)} className="btn-hover"
          style={{width:"100%",padding:"16px",background:C.card,
          border:`2px dashed ${C.border}`,borderRadius:14,
          color:C.textMid,fontSize:15,fontWeight:700,cursor:"pointer",
          fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:10,
          marginBottom:14,transition:"all .2s"}}>
          <span style={{fontSize:22,lineHeight:1}}>＋</span> Adicionar Lançamento
        </button>
      ) : (
        <div style={{background:C.card,border:`1px solid ${C.blue}44`,
          borderRadius:16,padding:"20px",marginBottom:14}} className="fade-up">

          {/* Header */}
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18}}>
            <span style={{fontSize:20}}>✏️</span>
            <span style={{fontSize:15,color:C.text,fontWeight:800}}>Novo Lançamento</span>
          </div>

          {/* Row 1: tipo + descrição + valor */}
          <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:14}}>
            <div style={{display:"flex",flexDirection:"column",gap:5}}>
              <label style={{fontSize:12,color:C.textDim,fontWeight:700,letterSpacing:0.5}}>TIPO</label>
              <select value={addType} onChange={e=>setAddType(e.target.value)} style={inp({cursor:"pointer",minWidth:140})}>
                <option value="receita">💰 Receita</option>
                <option value="despesa">💸 Despesa</option>
              </select>
            </div>

            <div style={{display:"flex",flexDirection:"column",gap:5,flex:1,minWidth:140}}>
              <label style={{fontSize:12,color:C.textDim,fontWeight:700,letterSpacing:0.5}}>DESCRIÇÃO</label>
              <div style={{display:"flex",alignItems:"center",gap:8,
                background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"0 12px"}}>
                <span style={{fontSize:20,flexShrink:0}}>{catIcon(desc)}</span>
                <input list={`nc-${addType}`} value={desc} onChange={e=>setDesc(e.target.value)}
                  placeholder="Ex: Salário, Nubank..."
                  style={{background:"transparent",border:"none",outline:"none",color:C.text,
                    fontSize:14,fontFamily:"inherit",padding:"11px 0",flex:1}}/>
                <datalist id={`nc-${addType}`}>
                  {CATS[addType==="receita"?"receita":"despesa"].map(c=><option key={c} value={c}/>)}
                </datalist>
              </div>
            </div>

            <div style={{display:"flex",flexDirection:"column",gap:5}}>
              <label style={{fontSize:12,color:C.textDim,fontWeight:700,letterSpacing:0.5}}>VALOR PLANEJADO</label>
              <input type="number" value={val} onChange={e=>setVal(e.target.value)}
                placeholder="R$ 0,00" style={inp({width:160})}
                onKeyDown={e=>e.key==="Enter"&&!repeat&&add()}/>
            </div>
          </div>

          {/* Row 2: repeat toggle */}
          <div style={{background:C.surface,border:`1px solid ${repeat?C.purple+"55":C.border}`,
            borderRadius:12,padding:"14px 16px",marginBottom:16,transition:"border-color .2s"}}>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:repeat?14:0}}>
              {/* Toggle */}
              <div onClick={()=>setRepeat(r=>!r)}
                style={{width:44,height:24,borderRadius:99,cursor:"pointer",
                  background:repeat?C.purple:"#1e2d3d",transition:"background .2s",
                  position:"relative",flexShrink:0}}>
                <div style={{position:"absolute",top:3,left:repeat?22:3,width:18,height:18,
                  borderRadius:99,background:"white",transition:"left .2s",
                  boxShadow:"0 1px 4px #0008"}}/>
              </div>
              <div>
                <div style={{fontSize:14,color:repeat?C.purple:C.textMid,fontWeight:700,display:"flex",alignItems:"center",gap:6}}>
                  🔁 Repetir lançamento
                </div>
                <div style={{fontSize:12,color:C.textFaint}}>
                  Propagar este {addType} para os próximos meses
                </div>
              </div>
            </div>

            {repeat && (
              <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"flex-end"}} className="fade-up">
                {/* Radio: N meses ou todos */}
                <div style={{display:"flex",gap:10}}>
                  {[
                    {val:"months", label:"Próximos meses", ico:"📆"},
                    {val:"forever",label:"Todos os meses restantes",ico:"♾️"},
                  ].map(opt=>(
                    <div key={opt.val} onClick={()=>setRepeatMode(opt.val)}
                      style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",
                        background:repeatMode===opt.val?`${C.purple}18`:C.card,
                        border:`1px solid ${repeatMode===opt.val?C.purple:C.border}`,
                        borderRadius:10,padding:"10px 14px",transition:"all .15s"}}>
                      <div style={{width:16,height:16,borderRadius:99,
                        border:`2px solid ${repeatMode===opt.val?C.purple:C.textDim}`,
                        display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                        {repeatMode===opt.val && (
                          <div style={{width:8,height:8,borderRadius:99,background:C.purple}}/>
                        )}
                      </div>
                      <span style={{fontSize:13,color:repeatMode===opt.val?C.purple:C.textMid,fontWeight:600}}>
                        {opt.ico} {opt.label}
                      </span>
                    </div>
                  ))}
                </div>

                {repeatMode==="months" && (
                  <div style={{display:"flex",flexDirection:"column",gap:5}}>
                    <label style={{fontSize:12,color:C.textDim,fontWeight:700}}>QUANTOS MESES</label>
                    <div style={{display:"flex",gap:6}}>
                      {[1,2,3,4,5,6].filter(n=>n<=remainingMonths).map(n=>(
                        <div key={n} onClick={()=>setRepeatCount(n)}
                          style={{width:36,height:36,borderRadius:9,cursor:"pointer",
                            display:"flex",alignItems:"center",justifyContent:"center",
                            fontSize:13,fontWeight:800,transition:"all .15s",
                            background:repeatCount===n?C.purple:C.card,
                            color:repeatCount===n?"white":C.textMid,
                            border:`1px solid ${repeatCount===n?C.purple:C.border}`}}>
                          {n}
                        </div>
                      ))}
                      {remainingMonths>6 && (
                        <input type="number" value={repeatCount}
                          onChange={e=>setRepeatCount(Math.min(parseInt(e.target.value)||1,remainingMonths))}
                          style={inp({width:64,padding:"6px 10px",fontSize:13})}
                          min={1} max={remainingMonths}/>
                      )}
                    </div>
                    <div style={{fontSize:11,color:C.textFaint}}>
                      Será adicionado em: {MONTHS.slice(monthIdx+1,monthIdx+1+repeatCount).join(", ")||"—"}
                    </div>
                  </div>
                )}

                {repeatMode==="forever" && remainingMonths>0 && (
                  <div style={{fontSize:13,color:C.purple,fontWeight:700,
                    background:C.purpleDim,border:`1px solid ${C.purple}33`,
                    borderRadius:9,padding:"8px 14px",display:"flex",alignItems:"center",gap:6}}>
                    ♾️ Será adicionado em todos os meses: {MONTHS.slice(monthIdx+1).join(", ")}
                  </div>
                )}

                {remainingMonths===0 && (
                  <div style={{fontSize:13,color:C.textDim,fontStyle:"italic"}}>
                    Dezembro é o último mês — sem meses seguintes para repetir.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{display:"flex",gap:10}}>
            <button onClick={add} className="btn-hover"
              style={{background:C.greenDim,border:`1px solid ${C.green}55`,borderRadius:11,
              color:C.green,padding:"11px 22px",cursor:"pointer",fontFamily:"inherit",
              fontSize:14,fontWeight:900,display:"flex",alignItems:"center",gap:8}}>
              ✓ {repeat?"Adicionar e Repetir":"Adicionar"}
            </button>
            <button onClick={()=>{setShowAdd(false);setRepeat(false);}} className="btn-hover"
              style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:11,
              color:C.textMid,padding:"11px 16px",cursor:"pointer",fontFamily:"inherit",fontSize:14}}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Chart */}
      {monthData.despesas.length>0 && (
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:"18px 20px"}} className="fade-up">
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
            <span style={{fontSize:20}}>📊</span>
            <span style={{fontSize:13,color:C.textMid,fontWeight:800,letterSpacing:0.6,textTransform:"uppercase"}}>
              Distribuição de Despesas
            </span>
          </div>
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={barData} margin={{top:4,right:4,left:0,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#0a1628"/>
              <XAxis dataKey="name" tick={{fill:C.textDim,fontSize:12}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:C.textDim,fontSize:11}} tickFormatter={fmtK} axisLine={false} tickLine={false}/>
              <Tooltip formatter={v=>fmt(v)} cursor={{fill:"#1e3a5f22"}}
                contentStyle={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,fontSize:13}}/>
              <Bar dataKey="Planejado" fill="#1e3a5f" radius={[5,5,0,0]}/>
              <Bar dataKey="Realizado" fill={C.red} radius={[5,5,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ─── Annual View ──────────────────────────────────────────────────────────────
function AnnualView({ yearData }) {
  let cumP=0, cumA=0;
  const rows = MONTHS.map((m,i)=>{
    const s=calcMonth(yearData.months[i]||emptyMonth());
    cumP+=s.planned; cumA+=s.actual;
    return {...s,m,i,cumP,cumA};
  });
  const totalPR=rows.reduce((s,r)=>s+r.tPR,0), totalPE=rows.reduce((s,r)=>s+r.tPE,0);
  const totalAR=rows.reduce((s,r)=>s+r.tAR,0), totalAE=rows.reduce((s,r)=>s+r.tAE,0);
  const annPlan=totalPR-totalPE, annAct=totalAR-totalAE, annDev=annAct-annPlan;
  const areaData=rows.map(r=>({name:r.m,"Acum. Plan.":Math.round(r.cumP),"Acum. Real.":Math.round(r.cumA)}));
  const barData =rows.map(r=>({name:r.m,Planejado:r.planned,Realizado:r.actual}));

  // ── Acumulado de categorias do cartão de crédito ──
  const ccByCategory={};
  for(let i=0;i<12;i++){
    const charges=(yearData.months[i]||emptyMonth()).ccCharges||[];
    charges.forEach(c=>{
      const cat=c.category||"Sem categoria";
      ccByCategory[cat]=(ccByCategory[cat]||0)+c.value;
    });
  }
  const ccTotal=Object.values(ccByCategory).reduce((s,v)=>s+v,0);
  const ccCats=Object.entries(ccByCategory)
    .sort((a,b)=>b[1]-a[1])
    .map(([cat,val])=>({cat,val,pct:ccTotal>0?((val/ccTotal)*100):0}));
  const catColors=[C.blue,C.purple,"#fb923c","#fbbf24","#e879f9","#34d399","#f472b6","#a78bfa","#60a5fa","#4ade80"];

  return (
    <div className="fade-up">
      <div style={{display:"flex",gap:16,marginBottom:22,flexWrap:"wrap"}}>
        {[
          {title:"Saldo Anual Planejado",ico:"🗓️",val:annPlan,acc:C.green,
            sub:`💰 ${fmt(totalPR)}   💸 ${fmt(totalPE)}`},
          {title:"Saldo Anual Realizado",ico:"📈",val:annAct,acc:C.purple,
            sub:`Desvio: ${annDev>=0?"▲":"▼"} ${fmt(Math.abs(annDev))}`},
        ].map(({title,ico,val,acc,sub})=>(
          <div key={title} style={{...glassCard(acc,{flex:1,minWidth:0})}}>
            <div style={{position:"absolute",top:-50,right:-50,width:180,height:180,borderRadius:"50%",
              background:`radial-gradient(circle,${acc}18,transparent 70%)`,pointerEvents:"none"}}/>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
              <div style={{width:36,height:36,borderRadius:11,background:`${acc}25`,
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{ico}</div>
              <span style={{fontSize:12,color:acc,fontWeight:800,letterSpacing:1,textTransform:"uppercase"}}>{title}</span>
            </div>
            <div style={{fontSize:40,fontWeight:900,lineHeight:1,marginBottom:10,
              color:val>=0?acc:C.red,textShadow:`0 0 28px ${val>=0?acc:C.red}55`}}>{fmt(val)}</div>
            <div style={{fontSize:14,color:C.textMid,fontWeight:600}}>{sub}</div>
          </div>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:18}}>
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:"18px 20px"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
            <span style={{fontSize:20}}>📈</span>
            <span style={{fontSize:12,color:C.textMid,fontWeight:800,letterSpacing:0.6,textTransform:"uppercase"}}>Saldo Acumulado</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={areaData} margin={{top:4,right:4,left:0,bottom:0}}>
              <defs>
                <linearGradient id="gP" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.blue} stopOpacity={0.3}/><stop offset="95%" stopColor={C.blue} stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.purple} stopOpacity={0.3}/><stop offset="95%" stopColor={C.purple} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#0a1628"/>
              <XAxis dataKey="name" tick={{fill:C.textDim,fontSize:12}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:C.textDim,fontSize:11}} tickFormatter={fmtK} axisLine={false} tickLine={false}/>
              <ReferenceLine y={0} stroke={C.border} strokeDasharray="3 3"/>
              <Tooltip formatter={v=>fmt(v)} contentStyle={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,fontSize:13}}/>
              <Legend iconType="circle" wrapperStyle={{fontSize:12,color:C.textMid}}/>
              <Area type="monotone" dataKey="Acum. Plan." stroke={C.blue} fill="url(#gP)" strokeWidth={2} strokeDasharray="5 5" dot={false}/>
              <Area type="monotone" dataKey="Acum. Real." stroke={C.purple} fill="url(#gA)" strokeWidth={2} dot={{r:3,fill:C.purple}}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:"18px 20px"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
            <span style={{fontSize:20}}>📊</span>
            <span style={{fontSize:12,color:C.textMid,fontWeight:800,letterSpacing:0.6,textTransform:"uppercase"}}>Saldo Mensal</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData} margin={{top:4,right:4,left:0,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#0a1628"/>
              <XAxis dataKey="name" tick={{fill:C.textDim,fontSize:12}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:C.textDim,fontSize:11}} tickFormatter={fmtK} axisLine={false} tickLine={false}/>
              <ReferenceLine y={0} stroke={C.border}/>
              <Tooltip formatter={(v,n)=>[fmt(v),n]} contentStyle={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,fontSize:13}}/>
              <Legend iconType="circle" wrapperStyle={{fontSize:12,color:C.textMid}}/>
              <Bar dataKey="Planejado" fill="#1e3a5f" radius={[5,5,0,0]}/>
              <Bar dataKey="Realizado" fill={C.green} radius={[5,5,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,overflow:"hidden"}}>
        <div style={{padding:"14px 20px",borderBottom:`1px solid ${C.border}`,
          display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:20}}>📋</span>
          <span style={{fontSize:12,color:C.textMid,fontWeight:800,letterSpacing:0.6,textTransform:"uppercase"}}>
            Resumo Mensal com Saldo Acumulado
          </span>
        </div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:660}}>
            <thead>
              <tr style={{background:"#05080f"}}>
                {["📅 Mês","Saldo Plan.","Saldo Real.","Acum. Plan.","Acum. Real.","Desvio Acum.","💸 Gastos"].map(h=>(
                  <th key={h} style={{padding:"11px 14px",textAlign:"left",fontSize:11,
                    color:C.textDim,fontWeight:700,letterSpacing:0.6,whiteSpace:"nowrap"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r,i)=>{
                const dev=r.cumA-r.cumP;
                return (
                  <tr key={i} className="row-hover" style={{borderBottom:`1px solid ${C.border}1a`}}>
                    <td style={{padding:"12px 14px",color:C.text,fontWeight:700,fontSize:14}}>{MONTHS_FULL[i]}</td>
                    <td style={{padding:"12px 14px",fontSize:14,fontWeight:700,color:C.textDim}}>{fmt(r.planned)}</td>
                    <td style={{padding:"12px 14px",fontSize:14,fontWeight:700,color:C.blue}}>{fmt(r.actual)}</td>
                    <td style={{padding:"12px 14px",fontSize:14,fontWeight:700,color:C.textDim}}>{fmt(r.cumP)}</td>
                    <td style={{padding:"12px 14px",fontSize:14,fontWeight:800,color:C.purple}}>{fmt(r.cumA)}</td>
                    <td style={{padding:"12px 14px",fontSize:14,fontWeight:800,color:dev>=0?C.green:C.red}}>
                      <span style={{display:"inline-flex",alignItems:"center",gap:5}}>
                        <span>{dev>=0?"📈":"📉"}</span>{fmt(Math.abs(dev))}
                      </span>
                    </td>
                    <td style={{padding:"12px 14px"}}>
                      {r.tPE>0?<StatusPill actual={r.tAE} planned={r.tPE} isReceita={false}/>:
                        <span style={{color:C.border,fontSize:12}}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{background:`${C.green}08`,borderTop:`2px solid ${C.border}`}}>
                <td style={{padding:"13px 14px",fontWeight:900,color:C.text,fontSize:14}}>🏆 TOTAL ANUAL</td>
                <td style={{padding:"13px 14px",fontWeight:900,fontSize:14,color:C.textDim}}>{fmt(annPlan)}</td>
                <td style={{padding:"13px 14px",fontWeight:900,fontSize:14,color:C.blue}}>{fmt(annAct)}</td>
                <td style={{padding:"13px 14px",fontWeight:900,fontSize:14,color:C.textDim}}>{fmt(annPlan)}</td>
                <td style={{padding:"13px 14px",fontWeight:900,fontSize:14,color:C.purple}}>{fmt(annAct)}</td>
                <td style={{padding:"13px 14px",fontWeight:900,fontSize:14,color:annDev>=0?C.green:C.red}}>
                  <span style={{display:"inline-flex",alignItems:"center",gap:5}}>
                    <span>{annDev>=0?"📈":"📉"}</span>{fmt(Math.abs(annDev))}
                  </span>
                </td>
                <td style={{padding:"13px 14px"}}><StatusPill actual={totalAE} planned={totalPE} isReceita={false}/></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── Acumulado por Categoria — Cartão de Crédito ── */}
      {ccCats.length>0&&(
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,overflow:"hidden",marginTop:18}}>
          <div style={{padding:"14px 20px",borderBottom:`1px solid ${C.border}`,
            display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:20}}>💳</span>
              <span style={{fontSize:12,color:C.textMid,fontWeight:800,letterSpacing:0.6,textTransform:"uppercase"}}>
                Cartão de Crédito — Gastos por Categoria no Ano
              </span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:12,color:C.textDim,fontWeight:600}}>Total:</span>
              <span style={{fontSize:18,fontWeight:900,color:C.red}}>{fmt(ccTotal)}</span>
            </div>
          </div>
          <div style={{padding:"18px 20px",display:"flex",flexDirection:"column",gap:14}}>
            {ccCats.map(({cat,val,pct},idx)=>{
              const color=catColors[idx%catColors.length];
              return (
                <div key={cat}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{width:10,height:10,borderRadius:99,background:color,flexShrink:0}}/>
                      <span style={{fontSize:14,color:C.textMid,fontWeight:600}}>{cat}</span>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:14}}>
                      <span style={{fontSize:13,color:C.textDim,fontWeight:700,
                        background:`${color}18`,border:`1px solid ${color}33`,
                        borderRadius:99,padding:"2px 10px"}}>
                        {pct.toFixed(0)}%
                      </span>
                      <span style={{fontSize:15,fontWeight:900,color:C.red,minWidth:90,textAlign:"right"}}>
                        {fmt(val)}
                      </span>
                    </div>
                  </div>
                  <div style={{background:"#050a12",borderRadius:99,height:7,overflow:"hidden"}}>
                    <div style={{width:`${pct}%`,
                      background:`linear-gradient(90deg,${color}88,${color})`,
                      height:"100%",borderRadius:99,
                      transition:"width .65s cubic-bezier(.4,0,.2,1)",
                      boxShadow:`0 0 8px ${color}44`}}/>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Mini tabela resumo */}
          <div style={{borderTop:`1px solid ${C.border}`,overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",minWidth:380}}>
              <thead>
                <tr style={{background:"#05080f"}}>
                  {["Categoria","Gasto no Ano","%"].map(h=>(
                    <th key={h} style={{padding:"9px 16px",textAlign:"left",fontSize:11,
                      color:C.textDim,fontWeight:700,letterSpacing:0.6}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ccCats.map(({cat,val,pct},idx)=>(
                  <tr key={cat} className="row-hover" style={{borderBottom:`1px solid ${C.border}1a`}}>
                    <td style={{padding:"10px 16px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{width:8,height:8,borderRadius:99,
                          background:catColors[idx%catColors.length],flexShrink:0}}/>
                        <span style={{fontSize:14,color:C.textMid,fontWeight:600}}>{cat}</span>
                      </div>
                    </td>
                    <td style={{padding:"10px 16px",fontSize:14,fontWeight:800,color:C.red}}>{fmt(val)}</td>
                    <td style={{padding:"10px 16px"}}>
                      <span style={{fontSize:13,fontWeight:700,
                        color:catColors[idx%catColors.length],
                        background:`${catColors[idx%catColors.length]}18`,
                        border:`1px solid ${catColors[idx%catColors.length]}33`,
                        borderRadius:99,padding:"3px 11px"}}>
                        {pct.toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{background:`${C.red}08`,borderTop:`2px solid ${C.border}`}}>
                  <td style={{padding:"11px 16px",fontWeight:900,color:C.text,fontSize:14}}>TOTAL</td>
                  <td style={{padding:"11px 16px",fontWeight:900,fontSize:14,color:C.red}}>{fmt(ccTotal)}</td>
                  <td style={{padding:"11px 16px",fontWeight:900,fontSize:14,color:C.textDim}}>100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  const today = new Date();
  const [view,setView]     = useState("month");
  const [year,setYear]     = useState(today.getFullYear());
  const [month,setMonth]   = useState(today.getMonth());
  const [data,setData]     = useState({});
  const [loaded,setLoaded] = useState(false);

  useEffect(()=>{
    try{ const raw=localStorage.getItem(STORAGE_KEY); if(raw) setData(JSON.parse(raw)); }catch{}
    setLoaded(true);
  },[]);

  useEffect(()=>{
    if(!loaded) return;
    try{ localStorage.setItem(STORAGE_KEY,JSON.stringify(data)); }catch{}
  },[data,loaded]);

  const yd = data[year] || emptyYear();
  const md = yd.months[month] || emptyMonth();

  // Update a single month
  const updMonth = useCallback((m,md)=>{
    setData(prev=>{
      const yd=prev[year]?{...prev[year]}:emptyYear();
      yd.months={...yd.months,[m]:md};
      return {...prev,[year]:yd};
    });
  },[year]);

  // Update entire year (for repeat feature)
  const updYear = useCallback((newYearData)=>{
    setData(prev=>({...prev,[year]:newYearData}));
  },[year]);

  const {cumPlanned,cumActual} = calcCumulative(yd,month);

  if(!loaded) return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
      height:"100vh",background:C.bg,gap:16}}>
      <div style={{fontSize:52,animation:"pulse 1.5s infinite"}}>💰</div>
      <div style={{color:C.textDim,fontFamily:"monospace",fontSize:16,letterSpacing:2,fontWeight:700}}>CARREGANDO…</div>
    </div>
  );

  return (
    <>
      <style>{STYLES}</style>
      <div style={{minHeight:"100vh",background:C.bg,
        fontFamily:"'DM Mono','IBM Plex Mono','Courier New',monospace",
        color:C.text,boxSizing:"border-box"}}>

        {/* ── Header ── */}
        <div style={{background:`${C.surface}f2`,borderBottom:`1px solid ${C.border}`,
          padding:"0 20px",position:"sticky",top:0,zIndex:200,
          display:"flex",alignItems:"center",gap:14,height:60,backdropFilter:"blur(14px)"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:36,height:36,borderRadius:11,
              background:"linear-gradient(135deg,#4ade80,#3b82f6)",
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:19,boxShadow:"0 4px 14px #4ade8055"}}>💰</div>
            <div>
              <div style={{fontWeight:900,fontSize:16,color:C.text,letterSpacing:-0.5,lineHeight:1.1}}>FLUXO</div>
              <div style={{fontSize:10,color:C.textFaint,fontWeight:800,letterSpacing:1.5}}>CAIXA PESSOAL</div>
            </div>
          </div>
          <div style={{flex:1}}/>
          {/* Year */}
          <div style={{display:"flex",alignItems:"center",gap:8,background:C.card,
            border:`1px solid ${C.border}`,borderRadius:12,padding:"5px 12px"}}>
            <button onClick={()=>setYear(y=>y-1)} className="btn-hover"
              style={{background:"none",border:"none",color:C.textMid,cursor:"pointer",fontSize:20,padding:"0 2px"}}>‹</button>
            <span style={{color:C.text,fontWeight:900,fontSize:16,minWidth:42,textAlign:"center"}}>{year}</span>
            <button onClick={()=>setYear(y=>y+1)} className="btn-hover"
              style={{background:"none",border:"none",color:C.textMid,cursor:"pointer",fontSize:20,padding:"0 2px"}}>›</button>
          </div>
          {/* View toggle */}
          <div style={{display:"flex",background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:3}}>
            {[["month","📅 Mensal"],["annual","📊 Anual"]].map(([v,l])=>(
              <button key={v} onClick={()=>setView(v)} className="btn-hover" style={{
                background:view===v?`${C.green}20`:"transparent",
                border:view===v?`1px solid ${C.green}44`:"1px solid transparent",
                color:view===v?C.green:C.textDim,
                borderRadius:9,padding:"7px 18px",cursor:"pointer",
                fontFamily:"inherit",fontSize:12,fontWeight:800,letterSpacing:0.3,transition:"all .2s"
              }}>{l}</button>
            ))}
          </div>
        </div>

        {/* ── Month tabs ── */}
        {view==="month" && (
          <div style={{background:`${C.surface}dd`,borderBottom:`1px solid ${C.border}`,
            display:"flex",overflowX:"auto",padding:"0 20px",scrollbarWidth:"none"}}>
            {MONTHS.map((m,i)=>{
              const s=calcMonth(yd.months[i]||emptyMonth());
              const hasData=(yd.months[i]?.receitas?.length||0)+(yd.months[i]?.despesas?.length||0)>0;
              const isActive=month===i;
              const isToday=i===today.getMonth()&&year===today.getFullYear();
              return (
                <button key={i} onClick={()=>setMonth(i)} className="btn-hover" style={{
                  background:isActive?`${C.green}0e`:"transparent",border:"none",
                  borderBottom:isActive?`2px solid ${C.green}`:"2px solid transparent",
                  color:isActive?C.green:C.textFaint,
                  padding:"10px 14px",cursor:"pointer",fontFamily:"inherit",
                  fontSize:11,fontWeight:isActive?900:600,letterSpacing:0.5,
                  display:"flex",flexDirection:"column",alignItems:"center",gap:3,
                  transition:"all .2s",minWidth:54,flexShrink:0,position:"relative"
                }}>
                  {isToday&&<span style={{position:"absolute",top:5,right:5,width:5,height:5,
                    borderRadius:99,background:C.green,animation:"glow 2s infinite"}}/>}
                  {m}
                  {hasData&&(
                    <span style={{fontSize:10,fontWeight:800,
                      color:s.actual>=0?C.green:C.red,
                      background:s.actual>=0?C.greenDim:C.redDim,
                      borderRadius:99,padding:"1px 6px"}}>
                      {s.actual>=0?"+":""}{fmtK(s.actual)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* ── Content ── */}
        <div style={{padding:"24px 20px",maxWidth:1100,margin:"0 auto"}}>
          {view==="month" ? (
            <>
              <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:22}}>
                <div style={{width:44,height:44,borderRadius:13,
                  background:`linear-gradient(135deg,${C.green}30,${C.blue}20)`,
                  border:`1px solid ${C.green}30`,
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>📅</div>
                <div>
                  <h2 style={{margin:0,fontSize:22,fontWeight:900,color:C.text,letterSpacing:-0.5}}>
                    {MONTHS_FULL[month]} {year}
                  </h2>
                  <span style={{fontSize:12,color:C.textDim,fontWeight:700,letterSpacing:0.8}}>
                    PLANEJADO & REALIZADO
                  </span>
                </div>
              </div>
              <MonthPanel
                key={`${year}-${month}`}
                monthData={md} monthIdx={month} year={year}
                cumPlanned={cumPlanned} cumActual={cumActual}
                onUpdateMonth={updated=>updMonth(month,updated)}
                onUpdateYear={updYear}
                allYearData={yd}
              />
            </>
          ) : (
            <>
              <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:22}}>
                <div style={{width:44,height:44,borderRadius:13,
                  background:`linear-gradient(135deg,${C.purple}30,${C.blue}20)`,
                  border:`1px solid ${C.purple}30`,
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>📊</div>
                <div>
                  <h2 style={{margin:0,fontSize:22,fontWeight:900,color:C.text,letterSpacing:-0.5}}>
                    Visão Anual — {year}
                  </h2>
                  <span style={{fontSize:12,color:C.textDim,fontWeight:700,letterSpacing:0.8}}>
                    RESUMO & PROJEÇÕES
                  </span>
                </div>
              </div>
              <AnnualView yearData={yd}/>
            </>
          )}
        </div>
      </div>
    </>
  );
}
