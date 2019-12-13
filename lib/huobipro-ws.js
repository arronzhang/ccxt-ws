const ExchangeWs = require('./exchange-ws')
const { huobipro } = require('ccxt')

module.exports = class huobiproWs extends ExchangeWs(huobipro) {
  constructor(...args) {
    super(...args)
  }

  describe() {
    return this.deepExtend(super.describe(), {
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

  _wsHandleRequestData(id, data) {
    return this.deepExtend({}, data, { id: id })
  }

  _wsHandleResponseData(msg) {
    if (msg.id && msg.status) {
      if (msg.status == 'ok') return { id: msg.id, data: msg }
      let err = new Error(msg['err-msg'])
      err.code = msg['err-code']
      return { id: msg.id, error: err }
    }
  }
}
