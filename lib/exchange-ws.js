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

    once(...args) {
      return this.wsEvent.once(...args)
    }

    emit(...args) {
      return this.wsEvent.emit(...args)
    }

    off(...args) {
      return this.wsEvent.off(...args)
    }

    describe() {
      return this.deepExtend(super.describe(), {
        has: {
          ws: true,
          subscribeTrades: true,
          subscribeOHLCV: true,
          subscribeTicker: true,
          subscribeTickers: true,
          subscribeOrderBook: true,
          subscribeBidsAsks: false
        },
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
          perMessageDeflate: false,
          hasResponse: true
        }
      })
    }

    wsGetUrl() {
      const type = this.safeString(this.options, 'defaultType', 'spot')
      let url = this.urls['ws_' + type] || this.urls['ws']
      return this.implodeParams(url, { hostname: this.hostname })
    }

    wsConnect() {
      return new Promise(resolve => {
        if (this.ws) return resolve()

        const agent = this.agent || this.httpsAgent
        const url = this.wsGetUrl()
        const ws = (this.ws = new WebSocketClient(url, { agent, ...this.wsOptions }))
        ws.once('connect', resolve)
        ws.on('connect', () => this._resubscribe())
        ws.on('message', msg => {
          //TODO: catch error
          this.wsHandleMessage(msg)
          //try{
          //}catch(err){
          //	this.emit('error', err)
          //}
        })
        ws.on('error', err => {
          this.emit('error', err)
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
      return this.makeRequestId()
    }

    makeRequestId() {
      return 'req_' + this._wsRequestId
    }

    wsRequest(data, forceReturn) {
      return new Promise((resolve, reject) => {
        if (!this.ws) return reject(new NetworkError('ws has not initialized'))
        if (!this.ws.connected) return reject(new NetworkError('ws has not connected'))
        const id = this._generateRequestId()
        let hasResponse = !forceReturn && this.wsOptions.hasResponse
        if (hasResponse) {
          const timer = setTimeout(() => {
            this._wsRequestCallback({ id, error: new NetworkError('ws request timeout') })
          }, this.wsOptions.requestTimeout)

          this._wsRequests.set(id, { resolve, reject, timer })
        }
        this.ws.send(this.wsHandleRequestData(id, data, forceReturn))
        if (!hasResponse) {
          // No longer wait response
          resolve()
        }
      })
    }

    async wsHandleMessage(msg) {
      if (this.wsOptions.hasResponse) {
        // Check is response
        let res = this.wsHandleResponseData(msg)
        if (res) {
          return this._wsRequestCallback(res)
        }
      }
      return this.wsHandleSubscribeData(msg)
    }

    _wsRequestCallback({ id, data, error }) {
      let obj = this._wsRequests.get(id)
      if (obj) {
        this._wsRequests.delete(id)
        if (error) obj.reject(error)
        else obj.resolve(data)
        clearTimeout(obj.timer)
      }
    }

    wsHandleSubscribeData(msg) {
      const name = this.wsHandleSubscribeTopic(msg)
      const topic = name && this._wsTopics.get(name)
      if (topic) {
        const event = topic[1]
        if (typeof event == 'string') {
          const handler = this['subscribeHandler' + uppercaseFirst(event)]
          if (handler) {
            let args = topic.slice(2)
            let res = handler.call(this, msg, ...args)
            return Promise.resolve(res).then(d => {
              if (d) {
                this.emit(event, d, ...args)
              }
            })
          }
        }
      }
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
      /* eslint-disable-next-line no-unused-vars */
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
    /* eslint-disable-next-line no-unused-vars */
    wsHandleRequestData(id, data) {
      return data
    }

    /* istanbul ignore next */
    /* eslint-disable-next-line no-unused-vars */
    wsHandleResponseData(data) {
      throw new Error('not implemented')
    }

    /* istanbul ignore next */
    /* eslint-disable-next-line no-unused-vars */
    wsHandleSubscribeTopic(msg) {
      throw new Error('not implemented')
    }

    /* istanbul ignore next */
    /* eslint-disable-next-line no-unused-vars */
    wsHandleSubscribeBody(topic) {
      throw new Error('not implemented')
    }

    /* istanbul ignore next */
    /* eslint-disable-next-line no-unused-vars */
    wsHandleUnsubscribeBody(topic) {
      throw new Error('not implemented')
    }

    static defineSubscriber(event, topicParser, eventHandler) {
      let up = uppercaseFirst(event)
      this.prototype['subscribeHandler' + up] = eventHandler
      this.prototype['subscribe' + up] = function(...args) {
        return Promise.resolve(topicParser.call(this, ...args)).then(topic => {
          return this.subscribe(topic, this.wsHandleSubscribeBody(topic), event, ...args)
        })
      }
      this.prototype['unsubscribe' + up] = function(...args) {
        return Promise.resolve(topicParser.call(this, ...args)).then(topic => {
          return this.unsubscribe(topic, this.wsHandleUnsubscribeBody(topic))
        })
      }
    }
  }
}

function uppercaseFirst(name) {
  return name.slice(0, 1).toUpperCase() + name.slice(1)
}
