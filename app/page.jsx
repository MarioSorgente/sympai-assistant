"use client";
import { useState } from "react";

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  async function ask() {
    const text = q.trim();
    if (!text || loading) return;
    setQ("");
    setMessages(m => [...m, { role: "user", text }]);
    setLoading(true);
    try {
      const r = await fetch("/api/chat", { method: "POST", body: text });
      const data = await r.json();
      setMessages(m => [...m, { role: "assistant", text: data.answer, sources: data.sources }]);
    } catch {
      setMessages(m => [...m, { role: "assistant", text: "Error. Try again." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{maxWidth:720,margin:"40px auto",padding:"0 16px",fontFamily:"system-ui"}}>
      <h2>⚡ SympAI — TSE Copilot (PoC)</h2>
      <p style={{color:"#666"}}>Ask about setup, wiring, Modbus, controller ops. Answers come from Notion pages shared with the integration.</p>

      <div style={{margin:"24px 0",padding:12,border:"1px solid #eee",borderRadius:8,minHeight:180}}>
        {messages.length===0 && <p style={{color:"#888"}}>Try: “Guide me through RS-485 Modbus config step by step.”</p>}
        {messages.map((m,i)=>(
          <div key={i} style={{margin:"12px 0"}}>
            <b>{m.role==="user"?"You":"SympAI"}:</b> <span style={{whiteSpace:"pre-wrap"}}>{m.text}</span>
            {m.sources?.length>0 && (
              <div style={{marginTop:6,display:"flex",gap:8,flexWrap:"wrap"}}>
                {m.sources.map((s,j)=>(
                  <a key={j} href={s.url} target="_blank" rel="noreferrer" style={{fontSize:12,border:"1px solid #ddd",borderRadius:999,padding:"2px 8px"}}>
                    {s.title || "Notion Page"}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
        {loading && <p>Thinking…</p>}
      </div>

      <input
        value={q}
        onChange={e=>setQ(e.target.value)}
        onKeyDown={e=>e.key==="Enter"&&ask()}
        placeholder="Ask SympAI… (Enter to send)"
        style={{width:"100%",padding:10,border:"1px solid #ddd",borderRadius:8}}
      />
      <button onClick={ask} disabled={loading} style={{marginTop:8,padding:"8px 14px"}}>Send</button>
    </main>
  );
}
