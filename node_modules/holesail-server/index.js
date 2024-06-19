// Importing required modules
const HyperDHT = require('hyperdht')  // HyperDHT module for DHT functionality
const net = require('net')  // Node.js net module for creating network clients and servers
const libNet = require('@holesail/hyper-cmd-lib-net')  // Custom network library
const libKeys = require('hyper-cmd-lib-keys') // To generate a random preSeed for server seed.
const b4a = require('b4a')

class holesailServer {
  constructor () {
    this.dht = new HyperDHT()
    this.stats = {}
    this.server = null
    this.keyPair = null
    this.buffer = null
    this.seed = null
  }

  keyPairGenerator (buffer) {
    // Used to generate a seed
    // if buffer key is provided by the user, allows to keep the same keyPair everytime.
    if (buffer) {
      this.buffer = buffer
    } else {
      this.buffer = libKeys.randomBytes(32).toString('hex')
    }

    //generate a seed from the buffer key
    this.seed = Buffer.from(this.buffer, 'hex')
    //generate a keypair from the seed
    this.keyPair = HyperDHT.keyPair(this.seed)
    return this.keyPair
  }

  //start the client on port and the address specified
  serve (args, callback) {
    this.secure = args.secure === true

    //generate the keypair
    this.keyPairGenerator(args.buffSeed)
    //this is needed for the secure mode to work and is implemented by HyperDHT
      if(this.secure) {
        var privateFirewall = (remotePublicKey) => {
          return !b4a.equals(remotePublicKey, this.keyPair.publicKey);
        }
      }else{
        var privateFirewall = false;
      }

    this.server = this.dht.createServer({
      privateFirewall,
      reusableSocket: true
    }, c => {
      // Connection handling using custom connection piper function
      libNet.connPiper(c, () => {
        return net.connect(
          { port: +args.port, host: args.address, allowHalfOpen: true }
        )
      }, { isServer: true, compress: false }, this.stats)
    })

    //start listening on the keyPair
    this.server.listen(this.keyPair).then(() => {
      if (typeof callback === 'function') {
        callback() // Invoke the callback after the server has started
      }
    })
  }

  //destroy the dht instance
  //TODO: Fix issue with server not destroying but only DHT connection after destroy() is called.
  destroy () {
    this.dht.destroy()
    return 0
  }

  //Return the public/connection key
  getPublicKey () {

    if(this.secure){
      return b4a.toString(this.seed, 'hex')
    }else{
      return this.keyPair.publicKey.toString('hex')
    }

  }
} //end server Class

module.exports = holesailServer
