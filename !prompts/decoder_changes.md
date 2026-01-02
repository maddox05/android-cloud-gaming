the decoder will now be able to talk back. it will now recieve on init a reset video function.
this function will be sent rhough send input, and will get p[assed to the workers input.ts, and use the control socket to reset video, sending new sps and pps frames.

this is so if the client decoder fails or is taking in frames while not configured, it can be fixed.

inout.ts on frontend will gain new reset video function and will use the new shared type reset video which is a input message

ingame.tsx will pass the reset video function that input.ts has to the decoder and now the decoder can call it whenever. ofc we dont want the decoder every error it has to reset as it may loop error, so have it call it max 1 time every 10 secs

after the message is sent through the socket input.ts ON THE BACKEND WORKER willl recieve it and send inpit will look for the message type reset video and on that reset the video using correct scrcpy stuff. (search web if needed)

overall think deeply plan well this is so important
