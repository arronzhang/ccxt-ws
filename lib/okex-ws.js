const ExchangeWs = require('./exchange-ws')
const { okex, ExchangeError } = require('ccxt')

const exchange = class okexWs extends ExchangeWs(okex) {
  constructor(...args) {
    super(...args)
  }

  describe() {
    return this.deepExtend(super.describe(), {
      has: {
        subscribeBidsAsks: false,
        subscribeTicker: false,
        subscribeTickers: false,
        subscribeOrderBook: false
      },
      urls: {
        ws: 'wss://real.OKEx.com:8443/ws/v3'
      },
      options: {},
      wsOptions: {
        serverPing: false,
        json: false,
        hasResponse: true,
        messageInflate: {
          raw: true
        }
      }
    })
  }

  wsHandleRequestData(id, data) {
    return data
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
    if (msg.event) {
      //okex has not request id.
      let id = this.makeRequestId()
      if (msg.event != 'error') return { id, data: msg }
      let err = new ExchangeError(msg.message)
      err.code = msg.errorCode
      return { id, error: err }
    }
  }

  wsHandleSubscribeTopic(msg) {
    if (msg.table && Array.isArray(msg.data) && msg.data[0]) {
      let name = msg.table
      let id = msg.data[0].instrument_id
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
    const type = this.safeString(this.options, 'defaultType', 'spot')
    let res = type + '/' + name
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

exchange.defineSubscriber(
  'OHLCV',
  async function topicParser(symbol, timeframe) {
    const market = await this.getMarket(symbol)
    const tf = this.timeframes[timeframe]
    return this.composeTopic('candle' + tf + 's', market.id)
  },
  function handler(msg) {
    const data = msg.data && msg.data[0] && msg.data[0].candle
    if (data) return this.parseOHLCV(data)
  }
)

module.exports = exchange
