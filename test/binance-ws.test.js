const exchanges = require('../index')
const config = require('config')
//const dayjs = require('dayjs')

function cleanData() {}

describe.each([
  ['huobiproWs', 'BTC/USDT', 'spot'],
  ['binanceWs', 'BTC/USDT', 'spot']
])('%s api', (name, symbol, type) => {
  type = type || 'spot'
  const api = new exchanges[name]({
    ...config.exchange,
    options: {
      defaultType: type,
      useAggTrades: true
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
})
