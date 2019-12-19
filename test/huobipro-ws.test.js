const Exchange = require('../lib/huobipro-ws')
const agent = require('./agent')

let api

beforeEach(() => {
  api = new Exchange({ agent })
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
    10 * 1000
  )
  test(
    'subscribe',
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
    10 * 1000
  )
})
