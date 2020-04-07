const exchanges = {
  huobiproWs: require('./lib/huobipro-ws.js')
}

module.exports = Object.assign(
  {
    ExchangeWs: require('./lib/exchange-ws.js'),
    exchanges: Object.keys(exchanges)
  },
  exchanges
)
