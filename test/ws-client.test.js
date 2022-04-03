const Client = require('../lib/ws-client.js')
const config = require('config')
describe('websocket client', () => {
  test('connect', (done) => {
    const client = new Client('wss://stream.binance.com:9443/stream', {
      ...config.exchange,
      json: true,
      messageInflate: false,
    })

    client.connect()
    client.on('connect', () => {
      client.send({ method: 'SUBSCRIBE', params: ['btcusdt@aggTrade'], id: 1 })
    })

    client.on('message', (msg) => {
      expect(msg).toHaveProperty('id')
      client.close()
      done()
    })
  }, 10000)

  test('closed', () => {
    const client = new Client('wss://stream.binance.com:9443/stream')
    client.close()
    expect(() => client.connect()).toThrow()
    expect(() => client.send()).toThrow()
  })

  test('reconnect', (done) => {
    const client = new Client('wss://ggg.com', {
      handshakeTimeout: 2 * 1000,
      retryTimeout: 10,
    })

    client.connect()
    client.on('error', (err) => {
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
