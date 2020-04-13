const exchanges = require('../index')
const config = require('config')
const dayjs = require('dayjs')

function cleanData() {}

describe.each([['huobiproWs', 'BTC/USDT']])('%s api', (name, symbol) => {
  const api = new exchanges[name](config.exchange)
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
      `${name} error data`,
      async () => {
        await expect(api.wsRequest({ err: 'err' })).rejects.toThrow()
      },
      20 * 1000
    )

  if (api.has.subscribeTrades)
    test(
      `${name} subscribe trades`,
      done => {
        api.once('trades', (trades, market) => {
          expect(trades[0].symbol).toBe(market.symbol)
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
      `${name} fetch OHLCV`,
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
      `${name} subscribe OHLCV`,
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
      `${name} subscribe bids asks`,
      done => {
        api.once('bidsAsks', (ticker, market) => {
          expect(ticker.symbol).toBe(market.symbol)
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
