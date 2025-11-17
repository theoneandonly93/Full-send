function parseEnvByte(v, def) {
  try {
    if (v === undefined || v === null || v === '') return def
    const s = String(v).trim()
    if (/^0x/i.test(s)) return Number.parseInt(s, 16)
    if (/^[0-9]+$/.test(s)) return Number.parseInt(s, 10)
    return def
  } catch { return def }
}

export const fairbrixNetwork = {
  messagePrefix: '\x18FairBrix Signed Message:\n',
  bech32: 'fbx',
  bip32: { public: 0x0488b21e, private: 0x0488ade4 },
  pubKeyHash: parseEnvByte(import.meta.env.VITE_FAIRBRIX_PKH, 0x5f),
  scriptHash: parseEnvByte(import.meta.env.VITE_FAIRBRIX_SH, 0x05),
  // Canonical Fairbrix SECRET_KEY is 0xDF (223); allow env override
  wif: parseEnvByte(import.meta.env.VITE_FAIRBRIX_WIF, 0xdf),
};
