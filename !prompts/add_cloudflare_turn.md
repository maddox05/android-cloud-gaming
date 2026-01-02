curl https://rtc.live.cloudflare.com/v1/turn/keys/$TURN_KEY_ID/credentials/generate-ice-servers \
--header "Authorization: Bearer $TURN_KEY_API_TOKEN" \
--header "Content-Type: application/json" \
--data '{"ttl": MAX_SESSION_TIME_MS}'

response:

{
"iceServers": [
{
"urls": [
"stun:stun.cloudflare.com:3478",
"stun:stun.cloudflare.com:53"
]
},
{
"urls": [
"turn:turn.cloudflare.com:3478?transport=udp",
"turn:turn.cloudflare.com:53?transport=udp",
"turn:turn.cloudflare.com:3478?transport=tcp",
"turn:turn.cloudflare.com:80?transport=tcp",
"turns:turn.cloudflare.com:5349?transport=tcp",
"turns:turn.cloudflare.com:443?transport=tcp"
],
"username": "bc91b63e2b5d759f8eb9f3b58062439e0a0e15893d76317d833265ad08d6631099ce7c7087caabb31ad3e1c386424e3e",
"credential": "ebd71f1d3edbc2b0edae3cd5a6d82284aeb5c3b8fdaa9b8e3bf9cec683e0d45fe9f5b44e5145db3300f06c250a15b4a0"
}
]
}

filter out alternative port 53 and sthe stun servers when adding to client class

we will be adding turn to our project

when the signal server now sends queue ready, it will also send turn info (the urls and crednetials so the 2 peers can use it.) singla sevrer will also attach the turn info to the clients class

when we go to send worker start from the signal server, we can now look at the connected client, and in that worker start message we can now append the turn info, and the worker can save that to its webrtc so it can use it

the cloudflare function which creates the turn data will be in helpers.ts in signal server

you will need to edit the reciecing messages in both worker and frontend
