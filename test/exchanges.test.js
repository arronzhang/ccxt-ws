const exchanges = require('../index')
const config = require('config')
const dayjs = require('dayjs')
const { ExchangeError } = require('ccxt')

function cleanData() {}

describe.each([
  ['huobiproWs', 'BTC/USDT', 'spot'],
  ['binanceWs', 'BTC/USDT', 'spot'],
  ['binanceWs', 'BTC/USDT', 'future'],
  ['okexWs', 'BTC/USDT', 'spot'],
  ['okexWs', 'BTC-USDT-SWAP', 'swap']
])('%s api', (name, symbol, type) => {
  type = type || 'spot'
  const api = new exchanges[name]({
    ...config.exchange,
    options: {
      defaultType: type
    }
  })
  const prefix = `${name} ${type}`

  api.on('error', err => {
    console.log(err)
  })

  beforeAll(async () => {
    await api.wsConnect()
  })

  afterAll(() => {
    api.wsClose()
  })

  if (api.wsOptions.hasResponse)
    test(
      `${prefix} error data`,
      async () => {
        await expect(api.wsRequest({ err: 'err' })).rejects.toThrow(ExchangeError)
      },
      20 * 1000
    )

  if (api.has.subscribeTrades)
    test(
      `${prefix} subscribe trades`,
      done => {
        api.once('trades', (trades, s) => {
          expect(trades[0].symbol).toBe(s)
          api
            .unsubscribeTrades(symbol)
            .then(cleanData)
            .then(done)
        })
        api.subscribeTrades(symbol)
      },
      20 * 1000
    )

  if (api.has.wsFetchOHLCV)
    test(
      `${prefix} fetch OHLCV`,
      async () => {
        let end = dayjs()
          .startOf('day')
          .add(-1, 'day')
        let start = end.add(-1, 'day')
        let res = await api.wsFetchOHLCV(symbol, '1h', +start, null, { end: +end })
        expect(res.length).toBe(25)
        expect(res[0][0]).toBe(+start)
      },
      20 * 1000
    )

  if (api.has.subscribeOHLCV)
    test(
      `${prefix} subscribe OHLCV`,
      done => {
        api.once('OHLCV', candle => {
          expect(candle[0]).toBeDefined()
          api
            .unsubscribeOHLCV(symbol, '1h')
            .then(cleanData)
            .then(done)
        })
        api.subscribeOHLCV(symbol, '1h')
      },
      20 * 1000
    )

  if (api.has.subscribeBidsAsks)
    test(
      `${prefix} subscribe bids asks`,
      done => {
        api.once('bidsAsks', (ticker, s) => {
          expect(ticker.symbol).toBe(s)
          expect(ticker.ask).toBeDefined()
          expect(ticker.bid).toBeDefined()
          api
            .unsubscribeBidsAsks(symbol)
            .then(cleanData)
            .then(done)
        })
        api.subscribeBidsAsks(symbol)
      },
      20 * 1000
    )
})
