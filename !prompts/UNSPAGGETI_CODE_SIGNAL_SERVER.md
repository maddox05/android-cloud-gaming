signal server has some serious bad code. lets fix it.

lets have main.ts handle routes, inital connectipon/ setup
and the interval calls.

functions like handle worker connection and handle client connection should be in the respective client and worker files

items that affect the client like timeouts should go into the client.

the client and worker files both should become classes. this will make more clear and simplify the code.


__errors__
all errors should be sent the same to client and wokrer

message will contain the type (error) the code (a constant) and a message we want whoever recieveing to know or possibly display.

if the code is not like this, change it to be like this


__disconnects__ 
client and server disconnects at any point and time are important.
client and sever should both have a disconnect function and should disconnect them from any point in thier lifecyclce.

we may already have the code for this, just make sure it works and is clear and simple.

__queue__ 
we can pack more of the functions into queue.ts like proccess queue.