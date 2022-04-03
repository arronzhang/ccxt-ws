const ExchangeWs = require('./exchange-ws')
const { binance, ExchangeError } = require('ccxt')

class binanceWs extends ExchangeWs(binance) {
  constructor(...args) {
    super(...args)
  }

  describe() {
    return this.deepExtend(super.describe(), {
      has: {
        subscribeBidsAsks: true,
        subscribeTicker: false,
        subscribeTickers: false,
        subscribeOrderBook: false,
      },
      urls: {
        ws: 'wss://stream.binance.com:9443/stream',
        ws_future: 'wss://fstream.binance.com/stream',
      },
      options: {
        useAggTrades: false,
      },
      wsOptions: {
        serverPing: false,
        json: true,
        hasResponse: true,
        messageInflate: false,
      },
    })
  }

  wsHandleRequestData(id, data) {
    return this.deepExtend({}, data, { id: id })
  }

  wsHandleResponseData(msg) {
    if (msg.id || msg.error) {
      let id = msg.id || this.makeRequestId()
      if (!msg.error) return { id, data: msg }
      let err = new ExchangeError(msg.error['msg'])
      err.code = msg.error['code']
      // binance error has not request id.
      return { id, error: err }
    }
  }

  wsHandleSubscribeTopic(msg) {
    return msg.stream
  }

  makeRequestId() {
    return this._wsRequestId
  }

  wsHandleSubscribeBody(topic) {
    return { method: 'SUBSCRIBE', params: [topic] }
  }

  wsHandleUnsubscribeBody(topic) {
    return { method: 'UNSUBSCRIBE', params: [topic] }
  }
}

binanceWs.defineSubscriber(
  'trades',
  async function topicParser(symbol) {
    const market = await this.getMarket(symbol)
    let name = this.options.useAggTrades ? 'aggTrade' : 'trade'
    return `${market.id.toLowerCase()}@${name}`
  },
  function handler(data) {
    data = this.safeValue(data, 'data', {})
    const market = this.safeValue(this.markets_by_id, this.safeString(data, 's'))
    const result = this.parseTrade(data, market)
    if (!this.options.useAggTrades) {
      result.id = this.safeString(data, 't')
    }
    return [result]
  }
)

binanceWs.defineSubscriber(
  'OHLCV',
  async function topicParser(symbol, timeframe) {
    const market = await this.getMarket(symbol)
    const tf = this.timeframes[timeframe]
    return `${market.id.toLowerCase()}@kline_${tf}`
  },
  function handler(data) {
    data = this.safeValue(data, 'data', {})
    const k = this.safeValue(data, 'k', {})
    const result = [
      this.safeInteger(k, 't'),
      this.safeFloat(k, 'o'),
      this.safeFloat(k, 'h'),
      this.safeFloat(k, 'l'),
      this.safeFloat(k, 'c'),
      this.safeFloat(k, 'v'),
    ]
    return result
  }
)

binanceWs.defineSubscriber(
  'bidsAsks',
  async function topicParser(symbol) {
    const market = await this.getMarket(symbol)
    return `${market.id.toLowerCase()}@bookTicker`
  },
  function handler(data) {
    const tick = this.safeValue(data, 'data', {})
    const marketId = this.safeString(tick, 's')
    const market = this.safeValue(this.markets_by_id, marketId)
    if (market) {
      const result = {
        symbol: market.symbol,
        id: this.safeInteger(tick, 'u'),
        bid: this.safeFloat(tick, 'b'),
        bidVolume: this.safeFloat(tick, 'B'),
        ask: this.safeFloat(tick, 'a'),
        askVolume: this.safeFloat(tick, 'A'),
      }
      return result
    }
  }
)

module.exports = binanceWs
