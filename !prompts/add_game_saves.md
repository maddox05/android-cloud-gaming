given ../GAME_SAVES.md id like to add game saves using r2

game saves will be stored in the r2 bucket like ${r2bucketname}/game_saves/${user*id}*${phone_image_version}.some_ending

- create 1 shared types that being phone image version and for now just set it to one and say change it every time a new base image created
- worker/install has the r2 bucket location, so if you can extract that into a shared type as well thx

create a new function in the redriod runner -> stop. so now its no longer reytsarted and started, its stopped then started. so while it stopped we can do the volumne changes

im not sure what file type you should make it but i think a tar.gz would be good,

you can copy whats in /worker/install.sh for looking at how we recieve the redriod golden image

youll need to install the s3 api in typsectipt for the worker now, and it will need to be passed the correct env vars now in the docker compose

- please have worker crash if it doesnt have its needed env vars

CLOUDFLARE_R2_TOKEN=
CLOUDFLARE_R2_ACCESS_KEY_ID=
CLOUDFLARE_R2_SECRET_ACCESS_KEY=

worker also now has all this state (user id etc) turn it into a singleton

signal server on worker start will now need to send the user id of the client, so worker can get correct game save
