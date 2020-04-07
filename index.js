const ccxt = (module.exports = require('ccxt'))

const exchanges = {
  huobiproWs: require('./lib/huobipro-ws.js')
}

Object.assign(
  ccxt,
  {
    ExchangeWs: require('./lib/exchange-ws.js'),
    exchanges: Object.keys(exchanges)
  },
  exchanges
)
