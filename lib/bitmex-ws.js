const ExchangeWs = require('./exchange-ws')
const { bitmex, ExchangeError } = require('ccxt')

const exchange = class bitmexWs extends ExchangeWs(bitmex) {
  constructor(...args) {
    super(...args)
  }

  describe() {
    return this.deepExtend(super.describe(), {
      has: {
        subscribeBidsAsks: false,
        subscribeTicker: false,
        subscribeOHLCV: false,
        subscribeTickers: false,
        subscribeOrderBook: false,
      },
      urls: {
        ws: 'wss://www.bitmex.com/realtime',
      },
      options: {},
      wsOptions: {
        serverPing: false,
        json: false,
        hasResponse: true,
        messageInflate: false,
      },
    })
  }

  wsHandleRequestData(id, data) {
    return this.deepExtend({}, data, { id: id })
  }

  async wsHandleMessage(msg) {
    if (msg == 'pong') return
    try {
      msg = JSON.parse(msg)
    } catch (err) {
      this.emit('error', err)
      return
    }
    return super.wsHandleMessage(msg)
  }

  wsHandleResponseData(msg) {
    if (msg.request) {
      //bitmex has not request id.
      let id = msg.request.id || this.makeRequestId()
      if (!msg.error) return { id, data: msg }
      let err = new ExchangeError(msg.error)
      err.code = msg.status
      return { id, error: err }
    }
  }

  wsHandleSubscribeTopic(msg) {
    if (msg.table && Array.isArray(msg.data) && msg.data[0]) {
      let name = msg.table
      let id = msg.data[0].symbol
      if (id) name += ':' + id
      return name
    }
  }

  makeRequestId() {
    return this._wsRequestId
  }

  wsHandleSubscribeBody(topic) {
    return { op: 'subscribe', args: [topic] }
  }

  wsHandleUnsubscribeBody(topic) {
    return { op: 'unsubscribe', args: [topic] }
  }

  composeTopic(name, symbol) {
    let res = name
    if (symbol) res += ':' + symbol
    return res
  }
}

exchange.defineSubscriber(
  'trades',
  async function topicParser(symbol) {
    const market = await this.getMarket(symbol)
    return this.composeTopic('trade', market.id)
  },
  function handler(msg) {
    return this.parseTrades(msg.data)
  }
)

module.exports = exchange
