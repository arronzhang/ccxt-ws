const { huobiproWs } = require('../index')

describe('exchange ws', () => {
  test(
    'wsRequest',
    async () => {
      const api = new huobiproWs()
      expect(api.wsRequest()).rejects.toThrow()
    },
    20 * 1000
  )
})
