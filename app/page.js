"use client";
import { useState, useEffect, useRef } from "react";

const FIELDS = ["Status","VIP Status","Loyalty Tier","Table Size","Guest Name","Payment","Stock Level"];
const EVENTS = ["Changes","Created","Deleted"];
const OPERATORS = ["=","!=",">","<","contains","is empty"];
const ACTIONS = ["Create Task","Send Notification","Update Field","Add Tag","Move Record","Trigger Automation"];

const SAMPLE_RECORDS = [
  { id:1, record:"Amelia Rivera", owner:"MS", guest_name:"Amelia Rivera", table_size:92, reservation_time:"May 21", status:"Pending", vip:false },
  { id:2, record:"Leo Chen", owner:"NO", guest_name:"Leo Chen", table_size:76, reservation_time:"May 24", status:"Pending", vip:false },
  { id:3, record:"Parker & Co Events", owner:"JL", guest_name:"Parker & Co Events", table_size:48, reservation_time:"Jun 02", status:"Confirmed", vip:true },
  { id:4, record:"Mendoza Party", owner:"KA", guest_name:"Mendoza Party", table_size:18, reservation_time:"7:30 PM", status:"Pending", vip:false },
];

const STATUS_COLORS = { Pending:"#f59e0b", Confirmed:"#10b981", Cancelled:"#ef4444", Delayed:"#8b5cf6" };

export default function Home() {
  const [tab, setTab] = useState("workspace");
  const [automations, setAutomations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [records, setRecords] = useState(SAMPLE_RECORDS);
  const [logs, setLogs] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [running, setRunning] = useState(null);
  const [form, setForm] = useState({
    name:"", workspace:"Reservations", field:"Status", event:"Changes",
    ifEnabled:false, ifField:"Status", operator:"=", ifValue:"Confirmed",
    action1:"Send Notification", action2:"Create Task"
  });
  const logRef = useRef(null);

  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const showToast = (msg, color="#10b981") => { setToast({msg,color}); setTimeout(()=>setToast(null),2800); };

  useEffect(()=>{
    if(tab==="manage"||tab==="simulate"){
      setLoading(true);
      fetch("/api/automations").then(r=>r.json()).then(d=>{ setAutomations(Array.isArray(d)?d:[]); setLoading(false); }).catch(()=>setLoading(false));
    }
  },[tab]);

  useEffect(()=>{ if(logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; },[logs]);

  const addLog = (msg, type="info") => {
    const colors = { info:"#aaa", success:"#10b981", trigger:"#f59e0b", action:"#3b82f6", error:"#ef4444" };
    setLogs(prev=>[...prev, { msg, color: colors[type]||"#aaa", time: new Date().toLocaleTimeString() }]);
  };

  const delay = ms => new Promise(res=>setTimeout(res,ms));

  const checkCondition = (val, op, target) => {
    if(op==="=") return String(val)===String(target);
    if(op==="!=") return String(val)!==String(target);
    if(op===">") return Number(val)>Number(target);
    if(op==="<") return Number(val)<Number(target);
    if(op==="contains") return String(val).includes(target);
    if(op==="is empty") return !val;
    return false;
  };

  const executeAction = async (action, recordId, newVal, autoName, currentRecords) => {
    const rec = currentRecords.find(r=>r.id===recordId) || {record:`Record #${recordId}`};
    const time = new Date().toLocaleTimeString();
    if(action === "Create Task"){
      const task = { id: Date.now(), title: `Follow up: ${rec.record} — Status changed to ${newVal}`, automation: autoName, status:"Open", created: time };
      setTasks(prev=>[task,...prev]);
      addLog(`   ✅ Create Task → "${task.title}"`, "action");
    } else if(action === "Send Notification"){
      const notif = { id: Date.now(), msg: `🔔 ${autoName}: ${rec.record} Status → ${newVal}`, time };
      setNotifications(prev=>[notif,...prev]);
      addLog(`   ✅ Send Notification → "${notif.msg}"`, "action");
    } else if(action === "Update Field"){
      addLog(`   ✅ Update Field → VIP Status set to Active`, "action");
    } else if(action === "Add Tag"){
      addLog(`   ✅ Add Tag → "${newVal}" tag added to ${rec.record}`, "action");
    } else if(action === "Move Record"){
      addLog(`   ✅ Move Record → ${rec.record} moved to ${newVal} board`, "action");
    } else {
      addLog(`   ✅ ${action} → executed`, "action");
    }
  };

  const simulateChange = async (recordId, field, oldVal, newVal) => {
    let updatedRecords;
    setRecords(prev => {
      updatedRecords = prev.map(r => r.id===recordId ? {...r, [field.toLowerCase()]: newVal, vip: newVal==="Confirmed"||r.vip} : r);
      return updatedRecords;
    });
    setRunning(recordId);

    addLog(`▶ Step 1: Record #${recordId} updated — ${field}: "${oldVal}" → "${newVal}"`, "info");
    await delay(600);
    addLog(`⚡ Step 2: Automation Engine detected change on field "${field}"`, "trigger");
    await delay(600);

    const matched = automations.filter(a =>
      a.active &&
      a.field?.toLowerCase() === field.toLowerCase() &&
      a.event === "Changes"
    );

    if(matched.length === 0){
      addLog(`⚠ Step 3: No active automation rules matched for "${field}" change`, "error");
      setRunning(null);
      return;
    }

    for(const auto of matched){
      addLog(`✓ Step 3: Rule matched — "${auto.name}"`, "success");
      await delay(500);

      if(auto.if_enabled){
        const pass = checkCondition(newVal, auto.operator, auto.if_value);
        addLog(`   IF ${auto.if_field} ${auto.operator} "${auto.if_value}" → ${pass ? "TRUE ✓" : "FALSE ✗"}`, pass?"success":"error");
        await delay(500);
        if(!pass){ addLog(`   ↳ Condition failed. Automation skipped.`, "error"); continue; }
      } else {
        addLog(`   IF: No condition — proceeding`, "info");
        await delay(300);
      }

      addLog(`🚀 Step 4: Executing actions...`, "trigger");
      await delay(500);

      if(auto.action1){ await executeAction(auto.action1, recordId, newVal, auto.name, updatedRecords); await delay(600); }
      if(auto.action2){ await executeAction(auto.action2, recordId, newVal, auto.name, updatedRecords); await delay(600); }
      addLog(`✅ Complete — automation "${auto.name}" finished`, "success");
    }
    setRunning(null);
  };

  const handleSave = async () => {
    if(!form.name.trim()) return showToast("Add a name first!","#ef4444");
    setSaving(true);
    const res = await fetch("/api/automations",{ method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(form) });
    const saved = await res.json();
    if(saved.error){ showToast("Error: "+saved.error,"#ef4444"); setSaving(false); return; }
    setAutomations(prev=>[saved,...prev]);
    showToast("✓ Automation saved to Supabase!");
    setForm({name:"",workspace:"Reservations",field:"Status",event:"Changes",ifEnabled:false,ifField:"Status",operator:"=",ifValue:"Confirmed",action1:"Send Notification",action2:"Create Task"});
    setSaving(false);
  };

  const toggle = async (a) => {
    const res = await fetch("/api/automations",{ method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({id:a.id,active:!a.active}) });
    const updated = await res.json();
    setAutomations(prev=>prev.map(x=>x.id===a.id?updated:x));
  };

  const remove = async (id) => {
    await fetch("/api/automations",{ method:"DELETE", headers:{"Content-Type":"application/json"}, body:JSON.stringify({id}) });
    setAutomations(prev=>prev.filter(a=>a.id!==id));
    showToast("Deleted.");
  };

  const sel = (val,onChange,opts,color) => (
    <select value={val} onChange={e=>onChange(e.target.value)}
      style={{background:"#0d0d1a",border:`1px solid ${color}`,borderRadius:8,padding:"8px 12px",color:"#fff",fontSize:14}}>
      {opts.map(o=><option key={o}>{o}</option>)}
    </select>
  );

  // Reusable Tasks + Notifications panels
  const TasksAndNotifications = () => (
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginTop:20}}>
      {/* Tasks */}
      <div style={{background:"#fff",borderRadius:12,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <h4 style={{margin:0,fontSize:14,fontWeight:800}}>
            ✅ Created Tasks
            {tasks.length>0 && <span style={{marginLeft:8,background:"#7c3aed",color:"#fff",borderRadius:20,padding:"1px 9px",fontSize:11,fontWeight:700}}>{tasks.length}</span>}
          </h4>
          {tasks.length>0 && <button onClick={()=>setTasks([])} style={{background:"none",border:"1px solid #e5e5e5",borderRadius:6,padding:"3px 10px",fontSize:12,cursor:"pointer",color:"#888"}}>Clear</button>}
        </div>
        {tasks.length===0
          ? <div style={{color:"#ccc",fontSize:13,textAlign:"center",padding:"24px 0"}}>No tasks yet — trigger a "Create Task" automation</div>
          : tasks.map(t=>(
            <div key={t.id} style={{border:"1px solid #f0f0f0",borderRadius:8,padding:"10px 14px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div>
                <div style={{fontWeight:600,fontSize:13,marginBottom:3}}>{t.title}</div>
                <div style={{fontSize:11,color:"#aaa"}}>From: <span style={{color:"#7c3aed"}}>{t.automation}</span> · {t.created}</div>
              </div>
              <span style={{background:"#d1fae5",color:"#059669",borderRadius:20,padding:"2px 9px",fontSize:11,fontWeight:700,whiteSpace:"nowrap",marginLeft:8}}>{t.status}</span>
            </div>
          ))
        }
      </div>

      {/* Notifications */}
      <div style={{background:"#fff",borderRadius:12,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <h4 style={{margin:0,fontSize:14,fontWeight:800}}>
            🔔 Notifications
            {notifications.length>0 && <span style={{marginLeft:8,background:"#3b82f6",color:"#fff",borderRadius:20,padding:"1px 9px",fontSize:11,fontWeight:700}}>{notifications.length}</span>}
          </h4>
          {notifications.length>0 && <button onClick={()=>setNotifications([])} style={{background:"none",border:"1px solid #e5e5e5",borderRadius:6,padding:"3px 10px",fontSize:12,cursor:"pointer",color:"#888"}}>Clear</button>}
        </div>
        {notifications.length===0
          ? <div style={{color:"#ccc",fontSize:13,textAlign:"center",padding:"24px 0"}}>No notifications yet — trigger a "Send Notification" automation</div>
          : notifications.map(n=>(
            <div key={n.id} style={{border:"1px solid #eff6ff",borderRadius:8,padding:"10px 14px",marginBottom:8,background:"#f8faff"}}>
              <div style={{fontSize:13,fontWeight:600,marginBottom:3}}>{n.msg}</div>
              <div style={{fontSize:11,color:"#aaa"}}>{n.time}</div>
            </div>
          ))
        }
      </div>
    </div>
  );

  const tabs = [
    {id:"workspace", label:"🗂 Workspace"},
    {id:"builder", label:"⚡ New Automation"},
    {id:"simulate", label:"🧪 Test / Simulate"},
    {id:"manage", label:"📋 Manage"},
  ];

  return (
    <div style={{minHeight:"100vh",background:"#f5f5f7",fontFamily:"sans-serif"}}>
      {toast && <div style={{position:"fixed",top:20,right:20,background:toast.color,color:"#fff",padding:"12px 24px",borderRadius:10,fontWeight:700,zIndex:999,boxShadow:"0 4px 20px rgba(0,0,0,0.3)"}}>{toast.msg}</div>}

      {/* Nav */}
      <div style={{background:"#fff",borderBottom:"1px solid #e5e5e5",padding:"0 24px",display:"flex",alignItems:"center",height:52,gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginRight:24}}>
          <div style={{width:28,height:28,background:"linear-gradient(135deg,#7c3aed,#3b82f6)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:900,fontSize:14}}>L</div>
          <span style={{fontWeight:700,fontSize:14}}>LUMIX CRM</span>
          <span style={{background:"#f0f0f0",borderRadius:4,padding:"2px 8px",fontSize:11,color:"#666"}}>Enterprise OS</span>
        </div>
        <div style={{marginLeft:"auto",display:"flex",gap:4}}>
          {tabs.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{background:tab===t.id?"linear-gradient(135deg,#7c3aed,#3b82f6)":"transparent",border:"none",borderRadius:8,padding:"6px 14px",color:tab===t.id?"#fff":"#555",fontWeight:600,fontSize:13,cursor:"pointer"}}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* WORKSPACE */}
      {tab==="workspace" && (
        <div style={{padding:24}}>
          <div style={{background:"#fff",borderRadius:12,padding:"20px 24px",marginBottom:16,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
            <div style={{fontSize:11,color:"#f59e0b",fontWeight:700,letterSpacing:2,marginBottom:4}}>RECORDS & BOARDS</div>
            <h2 style={{margin:"0 0 4px",fontSize:22,fontWeight:800}}>Operational data workspace</h2>
            <p style={{margin:0,color:"#888",fontSize:13}}>Boards, records, views, and AI context in one data-first workspace.</p>
            <div style={{display:"flex",gap:10,marginTop:14,flexWrap:"wrap"}}>
              <button onClick={()=>setTab("builder")} style={{background:"#fff",border:"1px solid #e5e5e5",borderRadius:8,padding:"7px 16px",fontSize:13,cursor:"pointer",fontWeight:600}}>⚡ Automations</button>
              <button onClick={()=>setTab("simulate")} style={{background:"linear-gradient(135deg,#7c3aed,#3b82f6)",border:"none",borderRadius:8,padding:"7px 16px",fontSize:13,cursor:"pointer",fontWeight:600,color:"#fff"}}>🧪 Test Automations</button>
              <button style={{background:"#fff",border:"1px solid #e5e5e5",borderRadius:8,padding:"7px 16px",fontSize:13,cursor:"pointer"}}>📊 Reports</button>
            </div>
          </div>
          <div style={{background:"#fff",borderRadius:12,boxShadow:"0 1px 4px rgba(0,0,0,0.06)",overflow:"hidden"}}>
            <div style={{display:"flex",gap:0,borderBottom:"1px solid #f0f0f0",padding:"0 16px"}}>
              {["Reservations 128","Guests 842","Suppliers 36","Orders 214"].map(t=>(
                <button key={t} style={{background:"none",border:"none",borderBottom:"2px solid #f59e0b",padding:"12px 16px",fontSize:13,fontWeight:700,color:"#f59e0b",cursor:"pointer"}}>{t}</button>
              ))}
              <button style={{background:"none",border:"none",padding:"12px 16px",fontSize:13,color:"#3b82f6",cursor:"pointer"}}>+ New Board</button>
            </div>
            <div style={{display:"flex",gap:8,padding:"10px 16px",borderBottom:"1px solid #f0f0f0"}}>
              <button style={{background:"linear-gradient(135deg,#f59e0b,#f97316)",border:"none",borderRadius:8,padding:"7px 16px",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer"}}>+ Add Record</button>
              {["Filter","Sort","Group","Hide Fields"].map(b=>(
                <button key={b} style={{background:"none",border:"1px solid #e5e5e5",borderRadius:8,padding:"6px 12px",fontSize:12,cursor:"pointer",color:"#555"}}>{b}</button>
              ))}
            </div>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead>
                <tr style={{background:"#fafafa"}}>
                  <th style={{width:32,padding:"10px 12px"}}><input type="checkbox"/></th>
                  <th style={{padding:"10px 12px",textAlign:"left",color:"#888",fontWeight:600,fontSize:11,letterSpacing:1}}>RECORD</th>
                  <th style={{padding:"10px 12px",textAlign:"left",color:"#888",fontWeight:600,fontSize:11}}>Guest Name</th>
                  <th style={{padding:"10px 12px",textAlign:"left",color:"#888",fontWeight:600,fontSize:11}}>Table Size</th>
                  <th style={{padding:"10px 12px",textAlign:"left",color:"#888",fontWeight:600,fontSize:11}}>Reservation Time</th>
                  <th style={{padding:"10px 12px",textAlign:"left",color:"#888",fontWeight:600,fontSize:11}}>Status</th>
                  <th style={{padding:"10px 12px",textAlign:"left",color:"#888",fontWeight:600,fontSize:11}}>VIP</th>
                </tr>
              </thead>
              <tbody>
                <tr><td colSpan={7} style={{padding:"6px 12px",fontSize:12,color:"#aaa",background:"#fafafa"}}>▾ Ungrouped &nbsp; {records.length} records</td></tr>
                {records.map(r=>(
                  <tr key={r.id} style={{borderTop:"1px solid #f0f0f0",background:running===r.id?"#fffbf0":""}}>
                    <td style={{padding:"10px 12px"}}><input type="checkbox"/></td>
                    <td style={{padding:"10px 12px"}}><div style={{fontWeight:600}}>{r.record}</div><div style={{fontSize:11,color:"#aaa"}}>Owner {r.owner}</div></td>
                    <td style={{padding:"10px 12px"}}>{r.guest_name}</td>
                    <td style={{padding:"10px 12px"}}>{r.table_size}</td>
                    <td style={{padding:"10px 12px",color:"#3b82f6"}}>{r.reservation_time}</td>
                    <td style={{padding:"10px 12px"}}>
                      <span style={{background:STATUS_COLORS[r.status]+"22",color:STATUS_COLORS[r.status],borderRadius:20,padding:"3px 10px",fontSize:12,fontWeight:700}}>{r.status}</span>
                    </td>
                    <td style={{padding:"10px 12px"}}>{r.vip ? "⭐" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tasks & Notifications below the table */}
          <TasksAndNotifications />
        </div>
      )}

      {/* BUILDER */}
      {tab==="builder" && (
        <div style={{padding:24,maxWidth:800,margin:"0 auto"}}>
          <div style={{background:"#13132a",border:"1px solid #2a2a4a",borderRadius:16,padding:28,color:"#fff"}}>
            <div style={{fontSize:12,color:"#7c5cbf",letterSpacing:2,marginBottom:8}}>LUMIX CRM • AUTOMATION ENGINE</div>
            <h2 style={{fontSize:28,fontWeight:900,margin:"0 0 4px"}}>Create Automation</h2>
            <p style={{color:"#aaa",marginTop:4,marginBottom:24}}>Complete the sentence. Saved to Supabase.</p>
            <div style={{marginBottom:20}}>
              <label style={{fontSize:12,color:"#aaa",display:"block",marginBottom:6}}>AUTOMATION NAME</label>
              <input value={form.name} onChange={e=>set("name",e.target.value)} placeholder="e.g. Confirm Reservation Alert"
                style={{width:"100%",background:"#1e1e3a",border:"1px solid #7c5cbf",borderRadius:8,padding:"10px 14px",color:"#fff",fontSize:15,boxSizing:"border-box"}}/>
            </div>
            <div style={{background:"#0d1a2e",borderRadius:12,padding:20,marginBottom:12,borderLeft:"4px solid #3b82f6"}}>
              <div style={{fontSize:13,fontWeight:700,color:"#3b82f6",marginBottom:12,letterSpacing:2}}>WHEN THIS HAPPENS</div>
              <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>
                <span style={{color:"#aaa",fontSize:13}}>Field</span>
                {sel(form.field,v=>set("field",v),FIELDS,"#3b82f6")}
                {sel(form.event,v=>set("event",v),EVENTS,"#3b82f6")}
              </div>
            </div>
            <div style={{background:"#1a1000",borderRadius:12,padding:20,marginBottom:12,borderLeft:"4px solid #f59e0b"}}>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
                <div style={{fontSize:13,fontWeight:700,color:"#f59e0b",letterSpacing:2}}>ONLY IF</div>
                <label style={{fontSize:12,color:"#aaa",display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>
                  <input type="checkbox" checked={form.ifEnabled} onChange={e=>set("ifEnabled",e.target.checked)}/> Add condition
                </label>
              </div>
              {form.ifEnabled
                ? <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                    {sel(form.ifField,v=>set("ifField",v),FIELDS,"#f59e0b")}
                    {sel(form.operator,v=>set("operator",v),OPERATORS,"#f59e0b")}
                    <input value={form.ifValue} onChange={e=>set("ifValue",e.target.value)} placeholder="value..."
                      style={{background:"#0d0d0d",border:"1px solid #f59e0b",borderRadius:8,padding:"8px 12px",color:"#fff",fontSize:14,width:120}}/>
                  </div>
                : <div style={{color:"#555",fontSize:13}}>No condition — runs on every trigger</div>
              }
            </div>
            <div style={{background:"#001a0d",borderRadius:12,padding:20,marginBottom:24,borderLeft:"4px solid #10b981"}}>
              <div style={{fontSize:13,fontWeight:700,color:"#10b981",marginBottom:12,letterSpacing:2}}>THEN DO THIS</div>
              <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                <div><div style={{fontSize:11,color:"#aaa",marginBottom:4}}>ACTION 1</div>{sel(form.action1,v=>set("action1",v),ACTIONS,"#10b981")}</div>
                <div>
                  <div style={{fontSize:11,color:"#aaa",marginBottom:4}}>ACTION 2 (optional)</div>
                  <select value={form.action2} onChange={e=>set("action2",e.target.value)}
                    style={{background:"#0d0d0d",border:"1px solid #10b981",borderRadius:8,padding:"8px 12px",color:"#fff",fontSize:14}}>
                    <option value="">— none —</option>
                    {ACTIONS.map(a=><option key={a}>{a}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <button onClick={handleSave} disabled={saving}
              style={{background:"linear-gradient(135deg,#7c3aed,#3b82f6)",border:"none",borderRadius:10,padding:"12px 32px",color:"#fff",fontWeight:700,fontSize:15,cursor:saving?"not-allowed":"pointer",opacity:saving?0.7:1}}>
              {saving?"Saving to Supabase...":"⚡ Create Automation"}
            </button>
          </div>
        </div>
      )}

      {/* SIMULATE */}
      {tab==="simulate" && (
        <div style={{padding:24,maxWidth:1300,margin:"0 auto"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:20}}>
            <div>
              <div style={{background:"#fff",borderRadius:12,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,0.06)",marginBottom:16}}>
                <h3 style={{margin:"0 0 4px",fontSize:16,fontWeight:800}}>🧪 Simulate Record Changes</h3>
                <p style={{margin:"0 0 16px",color:"#888",fontSize:13}}>Change a record status — watch the automation execute step by step.</p>
                {loading && <div style={{color:"#aaa"}}>Loading automations...</div>}
                {!loading && automations.filter(a=>a.active).length===0 && (
                  <div style={{background:"#fff8f0",border:"1px solid #f59e0b",borderRadius:8,padding:12,fontSize:13,color:"#92400e",marginBottom:12}}>
                    ⚠ No active automations found. <button onClick={()=>setTab("builder")} style={{background:"none",border:"none",color:"#7c3aed",cursor:"pointer",fontWeight:700,fontSize:13}}>Create one first →</button>
                  </div>
                )}
                {records.map(r=>(
                  <div key={r.id} style={{border:"1px solid #f0f0f0",borderRadius:10,padding:14,marginBottom:10,background:running===r.id?"#fffbf0":"#fafafa"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                      <div>
                        <div style={{fontWeight:700,fontSize:14}}>{r.record}</div>
                        <div style={{fontSize:12,color:"#aaa"}}>Table size: {r.table_size}</div>
                      </div>
                      <span style={{background:STATUS_COLORS[r.status]+"22",color:STATUS_COLORS[r.status],borderRadius:20,padding:"3px 10px",fontSize:12,fontWeight:700}}>{r.status}</span>
                    </div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                      {["Pending","Confirmed","Cancelled","Delayed"].filter(s=>s!==r.status).map(s=>(
                        <button key={s} onClick={()=>{ setLogs([]); simulateChange(r.id,"Status",r.status,s); }}
                          disabled={running!==null}
                          style={{background:STATUS_COLORS[s]+"22",border:`1px solid ${STATUS_COLORS[s]}`,borderRadius:8,padding:"5px 12px",color:STATUS_COLORS[s],fontSize:12,fontWeight:700,cursor:running?"not-allowed":"pointer",opacity:running?0.5:1}}>
                          → {s}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{background:"#fff",borderRadius:12,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
                <h4 style={{margin:"0 0 12px",fontSize:14,fontWeight:700}}>Active Automations ({automations.filter(a=>a.active).length})</h4>
                {automations.filter(a=>a.active).map(a=>(
                  <div key={a.id} style={{fontSize:12,color:"#555",padding:"6px 0",borderBottom:"1px solid #f5f5f5"}}>
                    <span style={{color:"#3b82f6",fontWeight:600}}>{a.name}</span><br/>
                    When {a.field} Changes {a.if_enabled?`· If ${a.if_field} ${a.operator} ${a.if_value}`:""} → {a.action1}
                  </div>
                ))}
                {automations.filter(a=>a.active).length===0 && <div style={{color:"#ccc",fontSize:13}}>None yet</div>}
              </div>
            </div>
            <div style={{background:"#0d0d1a",borderRadius:12,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,0.1)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <h3 style={{margin:0,fontSize:16,fontWeight:800,color:"#fff"}}>📋 Execution Log</h3>
                <button onClick={()=>setLogs([])} style={{background:"#1e1e3a",border:"1px solid #2a2a4a",borderRadius:6,padding:"4px 10px",color:"#aaa",fontSize:12,cursor:"pointer"}}>Clear</button>
              </div>
              <div ref={logRef} style={{height:480,overflowY:"auto",fontFamily:"monospace",fontSize:13}}>
                {logs.length===0 && <div style={{color:"#333",textAlign:"center",marginTop:80}}>Change a record status<br/>to see execution here...</div>}
                {logs.map((l,i)=>(
                  <div key={i} style={{color:l.color,marginBottom:6,lineHeight:1.5}}>
                    <span style={{color:"#444",fontSize:11}}>{l.time} </span>{l.msg}
                  </div>
                ))}
                {running && <div style={{color:"#7c5cbf",marginTop:8}}>● running...</div>}
              </div>
            </div>
          </div>
          <TasksAndNotifications />
        </div>
      )}

      {/* MANAGE */}
      {tab==="manage" && (
        <div style={{padding:24,maxWidth:800,margin:"0 auto"}}>
          <div style={{background:"#fff",borderRadius:16,padding:28,boxShadow:"0 1px 4px rgba(0,0,0,0.08)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <div>
                <h2 style={{margin:0,fontSize:22,fontWeight:800}}>Manage Automations</h2>
                <p style={{margin:"4px 0 0",color:"#888",fontSize:13}}>View and control your active workflow automations.</p>
              </div>
              <button onClick={()=>setTab("builder")} style={{background:"linear-gradient(135deg,#7c3aed,#3b82f6)",border:"none",borderRadius:10,padding:"10px 20px",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer"}}>+ Create Automation</button>
            </div>
            {loading && <div style={{color:"#aaa",textAlign:"center",padding:40}}>Loading from Supabase...</div>}
            {!loading && automations.length===0 && <div style={{color:"#aaa",textAlign:"center",padding:40}}>No automations yet.</div>}
            {automations.map(a=>(
              <div key={a.id} style={{border:"1px solid #f0f0f0",borderRadius:12,padding:16,marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
                <div>
                  <div style={{fontWeight:700,marginBottom:4}}>{a.name}</div>
                  <div style={{fontSize:13,color:"#888"}}>
                    When <span style={{color:"#3b82f6",fontWeight:600}}>{a.field}</span> {a.event}
                    {a.if_enabled && <> · If {a.if_field} {a.operator} <span style={{color:"#f59e0b"}}>{a.if_value}</span></>}
                    {" · "}<span style={{color:"#10b981",fontWeight:600}}>{a.action1}{a.action2?` + ${a.action2}`:""}</span>
                  </div>
                  <div style={{display:"flex",gap:8,marginTop:6}}>
                    <span style={{background:a.active?"#d1fae5":"#f3f4f6",color:a.active?"#059669":"#666",borderRadius:20,padding:"2px 10px",fontSize:12,fontWeight:700}}>{a.active?"Active":"Paused"}</span>
                  </div>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>toggle(a)} style={{background:"#f3f4f6",border:"1px solid #e5e5e5",borderRadius:8,padding:"6px 14px",fontSize:13,cursor:"pointer",fontWeight:600}}>{a.active?"Pause":"Activate"}</button>
                  <button onClick={()=>remove(a.id)} style={{background:"#fff",border:"1px solid #ef4444",borderRadius:8,padding:"6px 14px",color:"#ef4444",fontSize:13,cursor:"pointer",fontWeight:600}}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}