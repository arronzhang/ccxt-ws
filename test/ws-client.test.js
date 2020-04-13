const Client = require('../lib/ws-client.js')

describe('websocket client', () => {
  test('connect', done => {
    const client = new Client('wss://ws.biki.com/kline-api/ws', {
      pingpong: true,
      json: true,
      perMessageDeflate: true
    })

    client.connect()
    client.on('connect', () => {
      client.send({
        event: 'sub',
        params: {
          channel: 'market_btcusdt_trade_ticker',
          cb_id: 'cccc'
        }
      })
    })

    client.on('message', msg => {
      expect(msg).toHaveProperty('ts')
      client.close()
      done()
    })
  }, 10000)

  test('closed', () => {
    const client = new Client('wss://ws.biki.com/kline-api/ws')
    client.close()
    expect(() => client.connect()).toThrow()
    expect(() => client.send()).toThrow()
  })

  test('reconnect', done => {
    const client = new Client('wss://ggg.com', {
      handshakeTimeout: 2 * 1000,
      retryTimeout: 10
    })

    client.connect()
    client.on('error', err => {
      expect(err).toHaveProperty('message')
    })

    let times = 0
    client.on('reconnect', () => {
      times++
      if (times > 2) {
        client.close()
        done()
      }
    })
  }, 15000)
})
