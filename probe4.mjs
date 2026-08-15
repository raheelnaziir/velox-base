const EMPTY = '0x000000000000000000000000000000000000dEaD'
const FRESH = '0x1111111111111111111111111111111111111112'
const TEST  = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'
async function get(u){ const r=await fetch(u,{headers:{accept:'application/json'}}); const t=await r.text(); let j;try{j=JSON.parse(t)}catch{}; return {status:r.status, j, t} }
console.log('=== native balance endpoint (addresses/{a}) ===')
const a = await get(`https://base.blockscout.com/api/v2/addresses/${TEST}`)
console.log('http', a.status, '| coin_balance:', a.j?.coin_balance, '| exchange_rate:', a.j?.exchange_rate)
console.log('=== fresh/never-used address token-balances ===')
const f = await get(`https://base.blockscout.com/api/v2/addresses/${FRESH}/token-balances`)
console.log('http', f.status, '| body:', JSON.stringify(f.j).slice(0,200))
console.log('=== fresh address native ===')
const fn = await get(`https://base.blockscout.com/api/v2/addresses/${FRESH}`)
console.log('http', fn.status, '| coin_balance:', fn.j?.coin_balance, '| body:', JSON.stringify(fn.j).slice(0,160))
console.log('=== dead address ===')
const d = await get(`https://base.blockscout.com/api/v2/addresses/${EMPTY}/token-balances`)
console.log('http', d.status, '| len:', Array.isArray(d.j)?d.j.length:'n/a')
console.log('=== invalid address ===')
const bad = await get(`https://base.blockscout.com/api/v2/addresses/notanaddress/token-balances`)
console.log('http', bad.status, '| body:', JSON.stringify(bad.j).slice(0,160))
