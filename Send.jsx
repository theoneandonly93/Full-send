import * as React from 'react'
const { useMemo, useState } = React;
import { useNavigate } from 'react-router-dom'
import fairbrix from '../services/fairbrix.js'
import { sendFairbrixTransaction } from '../utils/sendTransaction.js'
import NodeStatus from '../components/NodeStatus.jsx'
import BottomNav from '../components/BottomNav.jsx'
import '../styles/home.css'
import { decryptWifFromStorage } from '../utils/unifiedWallet.js'


export default function Send(){
  const navigate = useNavigate()
  const [to,setTo]=useState('')
  const [amt,setAmt]=useState('')
  // WIF is loaded from localStorage automatically in client-signed mode
  const [txid,setTxid]=useState('')
  const [err,setErr]=useState('')
  const walletMode = useMemo(() => (import.meta.env.VITE_NODE_WALLET_MODE || 'false') === 'true', [])

  const getLocalWif = async () => {
    // Prefer encrypted WIF (requires PIN/pass hash); fallback to plaintext keys if present
    const dec = await decryptWifFromStorage()
    if (dec && dec.trim()) return dec.trim()
    try {
      const candidates = ['fbx_wif','fbrx_wif','dope_wif','wallet_wif','priv_wif']
      for (const key of candidates) {
        const v = localStorage.getItem(key)
        if (v && v.trim()) return v.trim()
      }
    } catch {}
    return ''
  }

  async function onSend(){
    setErr(''); setTxid('')
    try{
      const v = await fairbrix.validateAddress(to)
      if (!v?.isvalid) throw new Error('Invalid address')
      const feePct = Math.max(0, Number(import.meta.env.VITE_PLATFORM_FEE_PCT || 1))
      const devAddr = (import.meta.env.VITE_DEV_FEE_ADDRESS || '').trim()
      if (walletMode) {
        const id = await fairbrix.sendToAddress(to, amt)
        setTxid(id)
      } else {
        const wif = await getLocalWif()
        if (!wif) throw new Error('No local key found. Add your WIF in Settings › Advanced.')
        const numAmt = parseFloat(amt)
        if (!Number.isFinite(numAmt) || numAmt <= 0) throw new Error('Enter a valid amount')
        const id = await sendFairbrixTransaction({ wif, to, amount: numAmt })
        setTxid(id)
      }
      if (devAddr) {
        const baseAmt = parseFloat(amt)
        if (Number.isFinite(baseAmt) && baseAmt > 0 && feePct > 0) {
          const fee = +(baseAmt * (feePct/100)).toFixed(8)
          console.info(`Platform fee applied: ${fee} FBX to ${devAddr}`)
        }
      }
    }catch(e){
      let msg = e?.message || 'send_failed';
      if (e?.stack) msg += '\n' + e.stack;
      if (e?.response && e.response.data) {
        msg += '\nRPC Response: ' + JSON.stringify(e.response.data);
      }
      setErr(msg);
    }
  }

  return (
    <div className="home-container">
      <div className="home-header">
        <div className="left-side">
          <button className="icon-btn" onClick={()=>navigate(-1)} aria-label="Back">←</button>
          <NodeStatus />
        </div>
        <div className="right-icons">
          <button className="icon-btn" title="Copy">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          </button>
          <button className="icon-btn" title="Search" onClick={()=>navigate('/search')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </button>
          <button className="icon-btn" title="Refresh" onClick={()=>window.location.reload()}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6"></path><path d="M3 22v-6h6"></path><path d="M21 2a16 16 0 0 0-16 16"></path><path d="M3 22a16 16 0 0 0 16-16"></path></svg>
          </button>
        </div>
      </div>

      <div className="home-main">
        <div className="card" style={{width:'100%', maxWidth:480}}>
          <div style={{fontWeight:900, fontSize:24, marginBottom:8}}>Send</div>
          <div className="row-2">
            <input className="input" placeholder="To address" value={to} onChange={e=>setTo(e.target.value)} />
            <input className="input" placeholder="Amount (FBX)" value={amt} onChange={e=>setAmt(e.target.value)} />
          </div>
          {!walletMode && (
            <div style={{marginTop:12}}>
              <div className="muted" style={{fontSize:12}}>
                Client-signed mode uses your private key from local storage. Manage it in Settings › Advanced.
              </div>
            </div>
          )}
          <div style={{marginTop:12, display:'flex', gap:10}}>
            <button className="btn btn-primary" onClick={onSend}>Send FBX</button>
            <button className="btn" onClick={()=>{setTo(''); setAmt(''); setErr(''); setTxid('')}}>Clear</button>
          </div>
          {(import.meta.env.VITE_DEV_FEE_ADDRESS || '').trim() && (
            <div style={{marginTop:8, fontSize:12}} className="muted">
              Platform fee: {Math.max(0, Number(import.meta.env.VITE_PLATFORM_FEE_PCT || 1))}% will also be sent to the fee address.
            </div>
          )}
          {txid && <div style={{marginTop:10}}>✅ TXID: <span className="muted">{txid}</span></div>}
          {err && (
            <div style={{marginTop:10, color:'#f87171'}}>
              ❌ {err} {!walletMode && err?.toLowerCase?.().includes('no local key') && (
                <button className="pill" style={{marginLeft:8}} onClick={()=>navigate('/settings')}>Open Settings</button>
              )}
            </div>
          )}
        </div>

        {walletMode ? (
          <div className="muted" style={{marginTop:10, fontSize:12, width:'100%', maxWidth:480}}>
            Node wallet mode enabled (sendtoaddress).
          </div>
        ) : (
          <div className="muted" style={{marginTop:10, fontSize:12, width:'100%', maxWidth:480}}>
            Client-signed mode via PSBT (bitcoinjs-lib). Ensure your address has UTXOs.
          </div>
        )}

        <BottomNav />
      </div>
    </div>
  )
}
