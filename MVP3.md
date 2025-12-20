**webrtc connection**
the worker and signaling server will have websocket messages they send

- signaling server will streamline the webrtc connection until the end, having custom messages for each, and only letting the worker and frontend talk for after all data is send and they can finally make a connection

**timeouts**

the client and worker will be connected to the signaling server via websocket
each will send pings and pongs back and forth.

if one fails, the signal server will shutdown both (if they were connected)

the singaling server will take special care to the client, where the client will now send all of its inputs to the singlaing server
the singlaing server discards them, but just resets some timeout number the client had

if the client does timeout, it kills the client connection and the worker it was connected to.

when one of the clients or workers times out, its removed from the set of workers or clients depending

so the signaling server will loop through all client once in a while, and say hey, has timeout expired? if so kill the client and the connected sever

**messages**
along with the webrtc messages, we will need messages that allow graceful shutdowns. (signaling server will send this to both client and sever and they will confirm or not if they succeeded.) we wont just forward message sanymore we should have one message for each tem

timeouts , server will shutdown and restart if client or timeouts
client needs to know if he timed out with a message, or if the server failed for example

**worker selection**
- first available worker gets assigned to connecting client
- if no workers available, reject client with error message

**connection failure**
- if WebRTC setup fails mid-handshake, disconnect both client and worker

**structs**
worker struct:
```
{
  id: string
  ws: WebSocket
  addr: string
  port: number
  status: 'available' | 'busy'
  clientId: string | null
  lastPing: number
  game: string  // sends "com.supercell.clashroyale" on register
}
```
created on websocket connection, added to a map

client struct:
```
{
  id: string
  ws: WebSocket
  workerId: string | null
  lastPing: number
  game: string  // defaults to "com.supercell.clashroyale"
  connectionState: 'waiting' | 'connecting' | 'connected'
}
```

**heartbeat**
- signaling server initiates all pings to clients and workers
- signaling server loops through all connections periodically and sends pings
- if lastPing exceeds timeout threshold, kill that connection (and paired connection if exists)

**worker registration**
- when worker connects, it sends a register message with game: "com.supercell.clashroyale"
- signaling server creates worker struct and adds to available workers map

**extras**
if the signaling server dies each worker should shutdown

all avaiable workers should always stay connected to the singaling server, that is thier job.

after a discconect/shutdown the worker will completely restart itself, going offline for a little, then when booting it will conect to signaling server.

if signaling server fails, workers will try to reconnect with exponential backoff

if signaling server fails, clients are not notified and just lose connection (acceptable for now)

**authentication**
- skipped for now, no auth on worker or client connections

**file structure**
the singaling server should now have 3 files a main, one for worker logic and one for client

singaling server should add a types file as well for its types

worker will just continue to use the main file for this
