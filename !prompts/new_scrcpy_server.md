the new scrcpy will connect to my server and send data to it.

video and input will pass themselves and the server will take them in. the first one it added gets the first connection and so on.

it will be very similar to base socket connection .ts file

it will now have a close function as well, that when the video for example calls close on it, it will check if all connectiosn closed then close server.
