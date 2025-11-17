import '../shims/node-globals.js'
import '../shims/node-globals.js'
import * as bitcoin from 'bitcoinjs-lib'
import * as ecc from '@bitcoinerlab/secp256k1'
import { ECPairFactory } from 'ecpair'
import axios from 'axios'
import { fairbrixNetwork } from './fairbrixNetwork.js'

bitcoin.initEccLib(ecc)
const ECPair = ECPairFactory(ecc)

// Force all RPC requests to use production proxy endpoint
const RPC_URL = 'https://www.dopelganga.com/api/rpc';

export async function sendFairbrixTransaction({ wif, to, amount, feeSats = 1000 }) {
  if (!wif) throw new Error('Missing WIF')
  if (!to) throw new Error('Missing destination')
  const sendValue = Math.floor(Number(amount) * 1e8)
  if (!Number.isFinite(sendValue) || sendValue <= 0) throw new Error('Invalid amount')

  const keyPair = ECPair.fromWIF(wif, fairbrixNetwork)
  const { address } = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey, network: fairbrixNetwork })

  const utxos = await axios.post(RPC_URL, {
    jsonrpc: '1.0', id: 'listunspent', method: 'listunspent', params: [1, 9999999, [address]]
  }, USE_PROXY ? {} : (import.meta.env.VITE_ALLOW_DIRECT === 'true' && import.meta.env.VITE_RPC_USER && import.meta.env.VITE_RPC_PASS ? { auth: { username: import.meta.env.VITE_RPC_USER, password: import.meta.env.VITE_RPC_PASS } } : {})).then(r => r.data.result)

  if (!Array.isArray(utxos) || utxos.length === 0) throw new Error('No UTXOs available')

  const DEV_FEE_ADDR = (import.meta.env.VITE_DEV_FEE_ADDRESS || '').trim()
  const FEE_PCT = Math.max(0, Number(import.meta.env.VITE_PLATFORM_FEE_PCT || 1))
  const feeValue = DEV_FEE_ADDR && FEE_PCT > 0 ? Math.floor(sendValue * (FEE_PCT / 100)) : 0

  // Simple coin selection: pick the first utxo sufficient to cover amount + platform fee + miner fee
  const needed = sendValue + feeValue + feeSats
  let picked = null
  for (const u of utxos) {
    const v = Math.floor(Number(u.amount) * 1e8)
    if (v >= needed) { picked = { ...u, value: v }; break }
  }
  if (!picked) throw new Error('Insufficient funds')

  const psbt = new bitcoin.Psbt({ network: fairbrixNetwork })

  const rawHex = await getRawTransaction(picked.txid)
  psbt.addInput({ hash: picked.txid, index: picked.vout, nonWitnessUtxo: Buffer.from(rawHex, 'hex') })

  const changeValue = picked.value - sendValue - feeValue - feeSats
  if (changeValue < 0) throw new Error('Negative change (fee too high)')

  psbt.addOutput({ address: to, value: sendValue })
  if (feeValue > 0 && DEV_FEE_ADDR) psbt.addOutput({ address: DEV_FEE_ADDR, value: feeValue })
  if (changeValue > 0) psbt.addOutput({ address, value: changeValue })

  psbt.signAllInputs(keyPair)
  psbt.finalizeAllInputs()

  const txHex = psbt.extractTransaction().toHex()

  const result = await axios.post(RPC_URL, {
    jsonrpc: '1.0', id: 'broadcast', method: 'sendrawtransaction', params: [txHex]
  }, USE_PROXY ? {} : (import.meta.env.VITE_ALLOW_DIRECT === 'true' && import.meta.env.VITE_RPC_USER && import.meta.env.VITE_RPC_PASS ? { auth: { username: import.meta.env.VITE_RPC_USER, password: import.meta.env.VITE_RPC_PASS } } : {})).then(r => r.data.result)

  return result
}

async function getRawTransaction(txid) {
  const res = await axios.post(RPC_URL, {
    jsonrpc: '1.0', id: 'raw', method: 'getrawtransaction', params: [txid]
  }, USE_PROXY ? {} : (import.meta.env.VITE_ALLOW_DIRECT === 'true' && import.meta.env.VITE_RPC_USER && import.meta.env.VITE_RPC_PASS ? { auth: { username: import.meta.env.VITE_RPC_USER, password: import.meta.env.VITE_RPC_PASS } } : {}))
  return res.data.result
}
