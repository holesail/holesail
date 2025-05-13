# blind-relay

Blind relay for [UDX](https://github.com/holepunchto/udx-native) over [Protomux](https://github.com/mafintosh/protomux) channels. By acting as a blind relay, a host may accept pairing requests from other hosts and relay UDX stream messages between them, similar to Traversal Using Relays around NAT (TURN).

```sh
npm i blind-relay
```

## Protocol

```mermaid
sequenceDiagram
    actor a as peer a
    actor r as relay
    actor b as peer b

    par
        a ->> r: pair { isInitiator: true, token, id, seq }
    and
        b ->> r: pair { isInitiator: false, token, id, seq }
    end

    note over r: The relay pairs peers a and b based on the token, allocates a new stream for both peers, and sends back the stream info

    par
        r -->> a: pair { isInitiator: true, token, id, seq }
    and
        r -->> b: pair { isInitiator: false, token, id, seq }
    end

    par
        a ->> r: unpair { token }

        note left of r: The relay deallocates the stream previously allocated to peer a
    and
        b ->> r: unpair { token }

        note right of r: The relay deallocates the stream previously allocated to peer b
    end
```

### Messages

All types are specified as their corresponding [compact-encoding](https://github.com/compact-encoding) codec.

#### `pair` (`0`)

1.  `bitfield(1)` Flags.
    1. `isInitiator`
2.  `fixed32` Preexchanged token.
3.  `uint` Stream ID of the sender.
4.  `uint` Initial stream sequence no. of the sender.

#### `unpair` (`1`)

1.  `bitfield(0)` Flags, reserved.
2.  `fixed32` Preexchanged token.

## License

Apache-2.0
