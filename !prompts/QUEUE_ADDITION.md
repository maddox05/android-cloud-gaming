__flow__
client opens queue/appId (Queue message should contain the appID (remove message for client selected game))

SIGNAL server auths client , and if success, adds client to the queue
every 5 secs signal server is running FUNCA
- FUNCA checks if avaiable worker? send to first client
if avaible worker, client gets a worker assigned , singal server is also sent the QUEUE_READY message which tells the client to go to the page app/appID which then triggers all of the webRTC shit in inGame.TSX

__FUNCA__
this will look atn all avaible workers, and if thier is an avaiable worker call, will assign the worker and call QUEUE_READY to the client


__EXTRAS__

Client on the QUEUE_READY msg will push itself to page /app/appID which calls all neccesary functions.

/app/appId or inGame.tsx will send a start message to the signal server, which if all checks out (client has a worker) it will then tell the worker to start

handle client start will be split into 2 functions 

handleClientWorkerAssign - called after FUNCA finds a match and right before QUEUE_READY is sent to client

HandleCLientWorker start - called after client sends back START (which means it on correct page and ready)




