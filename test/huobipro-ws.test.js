const Exchange = require('../lib/huobipro-ws')
const agent = require('./agent')

describe('huobipro ws api', () => {
  test(
    'wsRequest',
    async () => {
      const api = new Exchange({ agent })
      expect(api.wsRequest()).rejects.toThrow()
      await api.wsConnect()
      await expect(api.wsRequest({ sub: 'market.btcusdt.trade.detailerr' })).rejects.toThrow()
      await expect(api.wsRequest({ sub: 'market.btcusdt.trade.detail' })).resolves.toHaveProperty(
        'subbed'
      )
      api.wsClose()
    },
    10 * 1000
  )
})
