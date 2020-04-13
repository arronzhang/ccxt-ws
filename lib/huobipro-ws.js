const ExchangeWs = require('./exchange-ws')
const { huobipro } = require('ccxt')

class huobiproWs extends ExchangeWs(huobipro) {
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
        wsFetchOHLCV: true
      },
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

  wsHandleRequestData(id, data) {
    return this.deepExtend({}, data, { id: id })
  }

  wsHandleResponseData(msg) {
    if (msg.id && msg.status) {
      if (msg.status == 'ok') return { id: msg.id, data: msg }
      let err = new Error(msg['err-msg'])
      err.code = msg['err-code']
      return { id: msg.id, error: err }
    }
  }

  wsHandleSubscribeTopic(data) {
    return this.getTopic(data.ch)
  }

  async wsFetchOHLCV(symbol, timeframe = '1m', since = undefined, limit = 300, params = {}) {
    const market = await this.getMarket(symbol)
    const tf = this.timeframes[timeframe]
    const topic = `market.${market.id}.kline.${tf}`
    if (since && String(since).length == 13) {
      since = parseInt(parseInt(since) / 1000)
    }
    let to = params.to || params.end
    if (to && String(to).length == 13) {
      to = parseInt(parseInt(to) / 1000)
    }
    let data = { req: topic, from: since, to: to }
    let res = await this.wsRequest(data)
    return this.parseOHLCVs(res['data'], market, timeframe, since, limit)
  }
}

huobiproWs.defineSubscriber(
  'trades',
  async function topicParser(symbol) {
    const market = await this.getMarket(symbol)
    const topic = `market.${market.id}.trade.detail`
    return [topic, [{ sub: topic }, symbol], [{ unsub: topic }]]
  },
  function handler(data, symbol, event) {
    const market = this.market(symbol)
    const tick = this.safeValue(data, 'tick', {})
    const ar = this.safeValue(tick, 'data', [])
    const result = []
    for (let i = 0; i < ar.length; i++) {
      let trade = this.parseTrade(ar[i], market)
      trade.id = this.safeString(ar[i], 'tradeId')
      result.push(trade)
    }
    this.emit(event, result, market)
  }
)

huobiproWs.defineSubscriber(
  'OHLCV',
  async function topicParser(symbol, timeframe) {
    const market = await this.getMarket(symbol)
    const tf = this.timeframes[timeframe]
    const topic = `market.${market.id}.kline.${tf}`
    return [topic, [{ sub: topic }, symbol, timeframe], [{ unsub: topic }]]
  },
  function handler(data, symbol, timeframe, event) {
    const market = this.market(symbol)
    const tick = this.safeValue(data, 'tick', {})
    const result = this.parseOHLCV(tick)
    this.emit(event, result, market, timeframe)
  }
)

huobiproWs.defineSubscriber(
  'bidsAsks',
  async function topicParser(symbol) {
    const market = await this.getMarket(symbol)
    const topic = `market.${market.id}.bbo`
    return [topic, [{ sub: topic }, symbol], [{ unsub: topic }]]
  },
  function handler(data, symbol, event) {
    const tick = this.safeValue(data, 'tick', {})
    const marketId = this.safeString(tick, 'symbol')
    const market = this.safeValue(this.markets_by_id, marketId)
    if (market) {
      const result = {
        symbol: market.symbol,
        timestamp: this.safeInteger(tick, 'quoteTime'),
        bid: this.safeFloat(tick, 'bid'),
        bidVolume: this.safeFloat(tick, 'bidSize'),
        ask: this.safeFloat(tick, 'ask'),
        askVolume: this.safeFloat(tick, 'askSize')
      }
      this.emit(event, result, market)
    }
  }
)

module.exports = huobiproWs
