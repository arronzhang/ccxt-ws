const ExchangeWs = require('./exchange-ws')
const { huobipro } = require('ccxt')

module.exports = class huobiproWs extends ExchangeWs(huobipro) {
  constructor(...args) {
    super(...args)
  }

  describe() {
    return this.deepExtend(super.describe(), {
      urls: {
        ws: 'wss://{hostname}/ws'
      },
      wsOptions: {
        pingpong: true,
        json: true,
        hasResponse: true,
        perMessageDeflate: true
      }
    })
  }

  _wsHandleRequestData(id, data) {
    return this.deepExtend({}, data, { id: id })
  }

  _wsHandleResponseData(msg) {
    if (msg.id && msg.status) {
      if (msg.status == 'ok') return { id: msg.id, data: msg }
      let err = new Error(msg['err-msg'])
      err.code = msg['err-code']
      return { id: msg.id, error: err }
    }
  }

  _wsHandleSubscribeData(data) {
    const topic = this._wsTopics.get(data.ch)
    if (topic) {
      const [d, symbol, event] = topic
      const market = this.market(symbol)
      let result
      if (event == 'trade') {
        const tick = this.safeValue(data, 'tick', {})
        const ar = this.safeValue(tick, 'data', [])
        result = []
        for (let i = 0; i < ar.length; i++) {
          let trade = this.parseTrade(ar[i], market)
          trade.id = this.safeString(ar[i], 'tradeId')
          result.push(trade)
          this.wsEvent.emit(event, trade, market)
        }
        this.wsEvent.emit('trades', result, market)
      }
    }
  }

  subscribeTrades(symbol) {
    return this.getMarket(symbol).then(market => {
      const topic = `market.${market.id}.trade.detail`
      return this.subscribe(topic, { sub: topic }, symbol, 'trade')
    })
  }

  unsubscribeTrades(symbol) {
    return this.getMarket(symbol).then(market => {
      const topic = `market.${market.id}.trade.detail`
      return this.unsubscribe(topic, { unsub: topic })
    })
  }
}
