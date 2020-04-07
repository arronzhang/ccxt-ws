const { huobiproWs } = require('../index')
const config = require('config')
const dayjs = require('dayjs')

let api

beforeEach(() => {
  api = new huobiproWs(config.exchange)
})

afterEach(() => {
  api.wsClose()
})

describe('huobipro ws api', () => {
  test(
    'wsRequest',
    async () => {
      expect(api.wsRequest()).rejects.toThrow()
      await api.wsConnect()
      await expect(api.wsRequest({ sub: 'market.btcusdt.trade.detailerr' })).rejects.toThrow()
      await expect(api.wsRequest({ sub: 'market.btcusdt.trade.detail' })).resolves.toHaveProperty(
        'subbed'
      )
    },
    20 * 1000
  )
  test(
    'subscribe trades',
    async done => {
      await api.wsConnect()
      api.on('trade', (trade, market) => {
        expect(trade.symbol).toBe('BTC/USDT')
      })
      api.on('trades', () => {
        done()
      })
      await api.subscribeTrades('BTC/USDT')
    },
    20 * 1000
  )

  test(
    'fetch ohlcv',
    async () => {
      await api.wsConnect()
      let end = dayjs()
        .startOf('day')
        .add(-1, 'day')
      let start = end.add(-9, 'day')
      let res = await api.wsFetchOHLCV('BTC/USDT', '1d', +start, null, { to: +end })
      expect(res.length).toBe(10)
      expect(res[0][0]).toBe(+start)
    },
    20 * 1000
  )
})
