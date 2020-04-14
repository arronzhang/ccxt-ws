const EventEmitter = require('eventemitter3')
const pako = require('pako')
const WebSocket = require('ws')

/**
 * Auto reconnect websocket
 *
 * @event connect Fired upon a connection including a successful reconnection.
 * @event disconnect
 * @event reconnect
 * @event error
 * @event message
 */

module.exports = class WebSocketClient extends EventEmitter {
  /**
   * options.agent
   *
   */
  constructor(url, options = {}) {
    super()
    this._connected = false
    this.url = url
    this.options = {
      heartbeatTimeout: 60 * 1000,
      messageInflate: false,
      json: false,
      serverPing: false,
      retryTimeout: 5 * 1000,
      ...options
    }

    if (this.options.serverPing === true) {
      this.options.serverPing = data => {
        if (data.ping) {
          return { pong: data.ping }
        }
      }
    }
  }

  get connected() {
    return this._connected
  }

  connect() {
    if (this._closed) throw new Error('This client had been closed')
    if (this._start) throw new Error('This client had connected')
    this._start = true
    this._attemptConnect()
  }

  send(msg) {
    if (this._closed) throw new Error('This client had been closed')

    if (this._connected) {
      if (typeof msg !== 'string') msg = JSON.stringify(msg)
      this._ws.send(msg)
    }
  }

  close(...args) {
    const ws = this._ws
    //Closed by user
    //No longer emit events
    this._closed = true
    this._connected = false
    this._clearTimer()

    if (ws) {
      return ws.close(...args)
    }
  }

  _attemptConnect() {
    if (this._closed) return

    this._clearTimer()
    this._keepAlive()

    const ws = (this._ws = new WebSocket(this.url, undefined, {
      handshakeTimeout: 10 * 1000,
      ...this.options,
      messageInflate: false
    }))

    ws.onopen = () => {
      if (!this._closed) {
        this._connected = true
        this.emit('connect')
      }
    }

    ws.onclose = () => {
      if (!this._closed) this.emit('disconnect')

      this._retryConnect()
    }

    ws.onerror = err => {
      if (!this._closed) this.emit('error', err.error)
    }

    ws.onmessage = msg => {
      if (!this._closed) {
        this._hanldeMessage(msg.data)
      }
    }
  }

  _keepAlive() {
    if (this.options.heartbeatTimeout) {
      this._clearTimer()
      this._heartbeatTimer = setTimeout(() => {
        // maybe connect dead
        // close
        if (this._ws) {
          this._ws.close()
        }
        this._heartbeatTimer = null
        // reconnect
        this.emit('reconnect', 'heartbeat')
        this._attemptConnect()
      }, this.options.heartbeatTimeout)
    }
  }

  _clearTimer() {
    if (this._heartbeatTimer) {
      clearTimeout(this._heartbeatTimer)
      this._heartbeatTimer = null
    }

    if (this._retryTimer) {
      clearTimeout(this._retryTimer)
      this._retryTimer = null
    }
  }

  _hanldeMessage(data) {
    this._keepAlive()
    let ext = this.options.messageInflate
    if (ext) {
      let opts = {
        to: 'string'
      }
      if (typeof ext == 'object') {
        Object.assign(opts, ext)
      }
      try {
        data = pako.inflate(data, opts)
      } catch (err) {
        this.emit('error', err)
        return
      }
    } else {
      //buffer
      data = data.toString()
    }

    if (this.options.json) {
      try {
        data = JSON.parse(data)
      } catch (err) {
        this.emit('error', err)
        return
      }
    }

    if (this.options.serverPing) {
      //ping pong
      let pong = this.options.serverPing(data)
      if (pong) {
        this.send(pong)
        return
      }
    }
    this.emit('message', data)
  }

  _retryConnect() {
    if (this._closed) return

    this._connected = false
    this._clearTimer()
    this._retryTimer = setTimeout(() => {
      this._retryTimer = null
      this.emit('reconnect', 'close')
      this._attemptConnect()
    }, this.options.retryTimeout)
  }
}
