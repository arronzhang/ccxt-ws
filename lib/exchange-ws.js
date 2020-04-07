const WebSocketClient = require('./ws-client')
const { NetworkError } = require('ccxt')
const EventEmitter = require('eventemitter3')

module.exports = function mixin(cls) {
  return class ExchangeWs extends cls {
    constructor(...args) {
      super(...args)
      this.wsEvent = new EventEmitter()
      this._wsTopics = new Map()
      this._wsRequestId = 0
      this._wsRequests = new Map()
    }

    on(...args) {
      return this.wsEvent.on(...args)
    }

    off(...args) {
      return this.wsEvent.off(...args)
    }

    describe() {
      return this.deepExtend(super.describe(), {
        urls: {
          ws: undefined
        },
        wsOptions: {
          heartbeatTimeout: 60 * 1000,
          handshakeTimeout: 10 * 1000,
          requestTimeout: 10 * 1000,
          retryTimeout: 5 * 1000,
          pingpong: false,
          json: false,
          hasResponse: true,
          perMessageDeflate: false
        }
      })
    }

    wsConnect() {
      return new Promise(resolve => {
        if (this.ws) return resolve()

        const agent = this.agent || this.httpsAgent
        const url = this.implodeParams(this.urls['ws'], { hostname: this.hostname })
        const ws = (this.ws = new WebSocketClient(url, { agent, ...this.wsOptions }))
        ws.once('connect', resolve)
        ws.on('connect', () => this._resubscribe())
        ws.on('message', msg => {
          this._wsHandleMessage(msg)
          //try{
          //}catch(e){
          //}
        })
        ws.connect()
      })
    }

    wsClose(...args) {
      const ws = this.ws
      if (ws) {
        this.ws = null
        return ws.close(...args)
      }
    }

    _generateRequestId() {
      this._wsRequestId++
      return 'req_' + this._wsRequestId
    }

    wsRequest(data) {
      return new Promise((resolve, reject) => {
        if (!this.ws) return reject(new NetworkError('ws has not initialized'))
        if (!this.ws.connected) return reject(new NetworkError('ws has not connected'))
        const id = this._generateRequestId()

        if (this.wsOptions.hasResponse) {
          const timer = setTimeout(() => {
            this._wsRequstCallback({ id, error: new NetworkError('ws request timeout') })
          }, this.wsOptions.requestTimeout)

          this._wsRequests.set(id, { resolve, reject, timer })
        }
        this.ws.send(this._wsHandleRequestData(id, data))
        if (!this.wsOptions.hasResponse) {
          // No longer wait response
          resolve()
        }
      })
    }

    _wsHandleMessage(msg) {
      if (this.wsOptions.hasResponse) {
        // Check is response
        let res = this._wsHandleResponseData(msg)
        if (res) {
          return this._wsRequstCallback(res)
        }
      }
      this._wsHandleSubscribeData(msg)
    }

    _wsRequstCallback({ id, data, error }) {
      let obj = this._wsRequests.get(id)
      if (obj) {
        this._wsRequests.delete(id)
        if (error) obj.reject(error)
        else obj.resolve(data)
        clearTimeout(obj.timer)
      }
    }

    /* istanbul ignore next */
    _wsHandleRequestData(id, data) {
      throw new Error('not implemented')
    }

    /* istanbul ignore next */
    _wsHandleResponseData(data) {
      throw new Error('not implemented')
    }

    subscribe(topic, data, ...other) {
      this._wsTopics.set(topic, [data, ...other])
      if (this.ws && this.ws.connected) return this.wsRequest(data)
      return Promise.resolve()
    }

    unsubscribe(topic, data) {
      this._wsTopics.delete(topic)
      if (this.ws && this.ws.connected) return this.wsRequest(data)
      return Promise.resolve()
    }

    _resubscribe() {
      for (let [topic, args] of this._wsTopics) {
        this.wsRequest(args[0])
      }
    }

    getMarket(symbol) {
      return this.loadMarkets().then(() => {
        return this.market(symbol)
      })
    }

    /* istanbul ignore next */
    _wsHandleSubscribeData(data) {
      throw new Error('not implemented')
    }

    /* istanbul ignore next */
    subscribeTrades() {
      throw new Error('not implemented')
    }

    /* istanbul ignore next */
    unsubscribeTrades() {
      throw new Error('not implemented')
    }
  }
}
