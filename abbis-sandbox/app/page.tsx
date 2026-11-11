"use client";

import {useCallback,useEffect,useState} from "react";
import source from "@/data/source.json";

type ConnectionStatus={connected:boolean;source_system?:string;facility_code?:string;error?:string};
type Ack={source_event_id:string;status:string;stored:boolean;case_reference:string|null};
type ReplayResult={success:boolean;items:Ack[];case_reference:string|null;error?:string};
type CaseItem={case_reference:string;investigation_status:string};
type CaseResponse={items:CaseItem[];clinical_clearance:null;delivery_mode:string};

async function request<T>(url:string,method:"GET"|"POST"="GET",body?:unknown):Promise<T>{
  const r=await fetch(url,{
    method,credentials:"same-origin",cache:"no-store",
    headers:body===undefined?undefined:{"Content-Type":"application/json"},
    body:body===undefined?undefined:JSON.stringify(body),
  });
  const data=await r.json() as T & {error?:string};
  if(!r.ok)throw new Error(data.error||"Request failed. HTTP "+r.status);
  return data;
}
const trustledger=process.env.NEXT_PUBLIC_TRUSTLEDGER_DASHBOARD_URL||"https://trustledger-bct-2026.vercel.app";

export default function Home(){
  const [connection,setConnection]=useState<ConnectionStatus|null>(null);
  const [key,setKey]=useState("");
  const [showKey,setShowKey]=useState(false);
  const [connecting,setConnecting]=useState(false);
  const [connectionError,setConnectionError]=useState("");
  const [replay,setReplay]=useState<ReplayResult|null>(null);
  const [replaying,setReplaying]=useState(false);
  const [replayError,setReplayError]=useState("");
  const [cases,setCases]=useState<CaseItem[]>([]);
  const [casesLoading,setCasesLoading]=useState(false);
  const [casesError,setCasesError]=useState("");
  const [activeCase,setActiveCase]=useState<string|null>(null);
  const [lastChecked,setLastChecked]=useState("");

  const refreshConnection=useCallback(async()=>{
    try{setConnection(await request<ConnectionStatus>("/api/connection"));}
    catch{setConnection({connected:false});}
  },[]);
  const refreshCases=useCallback(async()=>{
    setCasesLoading(true);setCasesError("");
    try{
      const data=await request<CaseResponse>("/api/cases");
      setCases(data.items);
      setLastChecked(new Date().toLocaleTimeString());
    }catch(err){setCasesError(err instanceof Error?err.message:"Could not retrieve updates.");}
    finally{setCasesLoading(false);}
  },[]);

  useEffect(()=>{void refreshConnection();},[refreshConnection]);
  useEffect(()=>{if(connection?.connected)void refreshCases();},[connection?.connected,refreshCases]);

  async function connect(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();setConnecting(true);setConnectionError("");
    try{
      const result=await request<ConnectionStatus>("/api/connect","POST",{api_key:key.trim()});
      setConnection(result);setKey("");setShowKey(false);
    }catch(err){setConnectionError(err instanceof Error?err.message:"Could not connect.");}
    finally{setConnecting(false);}
  }
  async function disconnect(){
    await request("/api/disconnect","POST");
    setConnection({connected:false});setReplay(null);setCases([]);setActiveCase(null);setKey("");
  }
  async function sendReadings(){
    setReplaying(true);setReplayError("");setReplay(null);
    try{
      const result=await request<ReplayResult>("/api/replay","POST");
      setReplay(result);
      if(!result.success)setReplayError(result.error||"Delivery was incomplete.");
      if(result.case_reference)setActiveCase(result.case_reference);
      await refreshCases();
    }catch(err){setReplayError(err instanceof Error?err.message:"Could not deliver readings.");}
    finally{setReplaying(false);}
  }
  const isConnected=connection?.connected===true;
  const selectedCase=activeCase||cases[0]?.case_reference||null;

  return <div className="app-shell">
    <header className="topbar">
      <div className="topbar-inner">
        <div className="brand"><div className="brand-mark">A</div><div><strong>ABBIS Source Sandbox</strong><span>Interoperability test environment</span></div></div>
        <div className="topbar-status"><span className={"status-dot "+(isConnected?"green":"")}></span>{isConnected?"TrustLedger connected":"Awaiting connection"}</div>
      </div>
    </header>

    <main className="main">
      <div className="eyebrow">BLOOD BANK INFORMATION SYSTEM · SYNTHETIC SOURCE</div>
      <h1>Send records to TrustLedger.</h1>
      <p className="lead">This independent sandbox represents a blood-bank system. Its data are synthetic, but the connection, delivery acknowledgements and returned case updates use TrustLedger&apos;s real APIs.</p>

      <section className="workflow" aria-label="Integration workflow">
        <div className="workflow-item"><span className="bubble">1</span><div><strong>Connect</strong><small>Authorize an external system</small></div></div>
        <div className="workflow-arrow">→</div>
        <div className="workflow-item"><span className="bubble">2</span><div><strong>Send</strong><small>Deliver actual API events</small></div></div>
        <div className="workflow-arrow">→</div>
        <div className="workflow-item"><span className="bubble">3</span><div><strong>Receive</strong><small>Read investigation updates</small></div></div>
      </section>

      <div className="two-col">
        <section className="panel">
          <div className="panel-head">
            <div><div className="section-label">01 · CONNECTION</div><h2>TrustLedger adapter</h2><p>Connect with a key issued by the TrustLedger Quality Supervisor.</p></div>
            <div className={"status-chip "+(isConnected?"success":"neutral")}>{isConnected?"Connected":"Not connected"}</div>
          </div>
          {connection===null?<p className="muted">Checking existing session…</p>:isConnected?
          <div className="connected-panel">
            <div className="check-icon">✓</div>
            <div><strong>Secure connection verified</strong><p>The credential was accepted by the TrustLedger API.</p></div>
            <dl>
              <div><dt>Source system</dt><dd>{connection.source_system}</dd></div>
              <div><dt>Allowed facility</dt><dd>{connection.facility_code}</dd></div>
            </dl>
            <button className="plain-button" onClick={()=>void disconnect()}>Disconnect this browser session</button>
          </div>:
          <form onSubmit={event=>void connect(event)} className="connect-form">
            <div className="hint">
              <span className="hint-icon">i</span>
              <p>In TrustLedger, sign in as <strong>Quality Supervisor → Connections → Connect system</strong>, then create a key using these exact identifiers.</p>
            </div>
            <div className="identity-grid">
              <div><small>Source identifier</small><strong>{source.source_system}</strong></div>
              <div><small>Facility code</small><strong>{source.facility_id}</strong></div>
            </div>
            <label htmlFor="api-key">TrustLedger API key</label>
            <div className="key-entry"><input id="api-key" autoComplete="off" spellCheck={false} type={showKey?"text":"password"} required
              placeholder="tlc_••••••••••••••••" value={key} onChange={event=>setKey(event.target.value)}/>
              <button type="button" aria-label={showKey?"Hide key":"Show key"} onClick={()=>setShowKey(x=>!x)}>{showKey?"Hide":"Show"}</button>
            </div>
            <p className="form-help">The key is sent over HTTPS and retained only in an encrypted, HttpOnly session cookie for this browser. It is never stored in the sandbox dataset.</p>
            {connectionError&&<p className="error" role="alert">{connectionError}</p>}
            <button className="primary-button" type="submit" disabled={connecting}>{connecting?"Verifying connection…":"Connect to TrustLedger"} <span>→</span></button>
            <a href={trustledger+"/connections"} target="_blank" rel="noreferrer" className="text-link">Open TrustLedger connector settings ↗</a>
          </form>}
        </section>

        <section className="panel">
          <div className="panel-head"><div><div className="section-label">02 · SOURCE DATA</div><h2>Facility monitoring</h2><p>Four consecutive historical source readings, extracted from the pinned hackathon dataset.</p></div></div>
          <div className="facility"><span className="facility-icon">⌂</span><div><small>Source facility</small><strong>{source.facility_id}</strong></div><div className="fixture-tag">Synthetic records</div></div>
          <div className="reading-grid">
            {source.items.map((item,index)=>{
              const delivered=replay?.items.some(ack=>ack.source_event_id===item.source_event_id);
              return <div className={"reading "+(delivered?"delivered":"")} key={item.source_event_id}>
                <small>HOUR {index+1}</small>
                <strong>{item.temperature_c.toFixed(1)}°</strong>
                <span>{delivered?"✓ Received":"Above 6°C"}</span>
              </div>;
            })}
          </div>
          <div className="send-footer">
            <p>TrustLedger evaluates the four hourly readings, records each observation and creates an investigation candidate when its configured rule is met.</p>
            <button className="primary-button" disabled={!isConnected||replaying} onClick={()=>void sendReadings()}>
              {replaying?"Sending to TrustLedger…":replay?"Send again (test deduplication)":"Send four readings"} <span>→</span>
            </button>
          </div>
          {replayError&&<p role="alert" className="error">{replayError}</p>}
          {replay&&<div className="receipt" role="status">
            <strong>{replay.items.length} of 4 requests acknowledged</strong>
            <p>{replay.items.filter(x=>x.stored).length} new observations · {replay.items.filter(x=>!x.stored).length} duplicates safely ignored.</p>
            {replay.case_reference&&<p>Investigation created or found: <code>{replay.case_reference}</code></p>}
          </div>}
          <details className="details"><summary>Source provenance and timestamp assumptions</summary>
            <p>The readings were extracted from the pinned synthetic source using the actual TrustLedger dataset pipeline. Original incident: {source.upstream_incident}; source revision: <code>{source.upstream_git_revision.slice(0,12)}</code>.</p>
            <p>{source.timezone_note}</p>
            <p>This source app does not represent an actual ABBIS installation or a live medical device.</p>
          </details>
        </section>
      </div>

      <section className="panel outcome" aria-label="Investigation updates returned from TrustLedger">
        <div className="panel-head compact"><div><div className="section-label">03 · RETURN PATH</div><h2>Investigation updates</h2><p>TrustLedger returns the case status to this source application through a separately authenticated API request.</p></div>
          <button className="secondary-button" disabled={!isConnected||casesLoading} onClick={()=>void refreshCases()}>{casesLoading?"Checking…":"↻ Refresh status"}</button>
        </div>
        {!isConnected?<div className="empty"><span>↗</span><strong>Connect an adapter to see case updates</strong><p>Once your key is verified, this sandbox will be able to read only the investigation cases belonging to its source and facility.</p></div>:
          casesError?<p role="alert" className="error">{casesError}</p>:
          cases.length===0?<div className="empty"><span>◎</span><strong>No cases returned yet</strong><p>Send the source readings, then refresh the status here.</p></div>:
          <div className="case-list">{cases.map(item=><div className={"case-row "+(selectedCase===item.case_reference?"selected":"")} key={item.case_reference}>
            <div><small>Case reference</small><code>{item.case_reference}</code></div>
            <span className="status-chip success">{item.investigation_status.replaceAll("_"," ")}</span>
            <a href={trustledger+"/incidents/"+encodeURIComponent(item.case_reference)} target="_blank" rel="noreferrer" className="text-link">Open investigation ↗</a>
          </div>)}</div>}
        {lastChecked&&<p className="last-checked">Last retrieved from TrustLedger at {lastChecked}</p>}
      </section>
      <footer><strong>ABBIS Source Sandbox</strong><span>Separate synthetic source application · Real authenticated HTTPS exchange · No clinical product disposition</span></footer>
    </main>
  </div>;
}
