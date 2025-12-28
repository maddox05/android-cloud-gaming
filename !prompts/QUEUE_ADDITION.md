clients will now after authentication always join a queue (client queue const in global state)

every 5 secs a function (FUNCA) will run that gives all workers out to all clients that we can based on the queue FIFO

so thier will be a new message the signaling server and frontend do. will be QUEUE
- signal server will send queue to client. and when singal sever is ready for client it will send start
- when client recieves start this means the signal server has assigned a worker to the client, and the client will start sending over its WEBRTC info.

so now thier will be 2 functions handle client queue and handle client start

handle client start will now be called by the FUNCA with the worker id we want to pair with and the client ofc.

handle client queue will just take in the client.

the logic for the frontend will be as follows

we will have a new compoennt queue, which will show general information about the queue, this is the component that would have started the queue.
/queue/appId

it starts the queue and again shows info like your place in queue and estimated time (3 mins * users infront of me)
this component will only ever know how many users are in front of me (TODO HOW WILL THIS DATA GET SENT)

on server sending start, we will slap the client over to /app/appId to get started with the worker it now has.


notes:
client no longer sends start, server sends it , client just sends queue message (starts the proccess)


