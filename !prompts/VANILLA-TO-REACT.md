we are going from our vanilla js frontend to now react x typescript for max fun.

we will have components and files.

so first well have a decoder file which takes in whatever the frontend decoder file took and it similar to the other decoder will be able to take in what canvas its given


WEBRTC:
video_and_input_webrtc.ts file which handles the web rtc connection similar to the current. it will handle the entire connection proccess such as talking to the signaling server, and then to the worker as needed.
- it will have a simple function connect, which somebody will call, and they pass it a error callback so if it errors, the whoever called it can show the user. (they being ingame.tsx)
- currently webrtc is doing to little. it should orchestrate the entire connection.  its only job is webrtc bullshit. it again should have a connect function, and the user of this function will pass it callbacks for what happens when we get video (we passed a callback) and what happens when we send input (it retuned a func we should run ). (callbacks) and webrtc will call those for us. 
- it will also have a close function. (which ingame.tsx would run if smth goes wrong. as webrtc only using websocket_api to connect to the other peer)

websocket_API.ts
is a singleton
now we will have a file which is dedicated to handlaing talking with out signaling server
of course webrtc will have to use web socket api.ts to send its initial connectiosn until it doesnt need the signaling server
- this should be a lot simplier than it currently is. but how signal.js (old) is, is fine .
- so it will just have functions the main IN-GAME component can watch (disconnects, which can be done by in-game.tsx adding itself to the list of api.ts callbacks. ) and will have functions that WEBRTC will use for connection.

__how will ingame.tsx webrtc and websocket_api work together?__
websocket api simply gives functions for what the actual signaling server allows, and it gives the frontend easy functions to call which talk to the signaling server, letting the websocket_api make any slight changes as needed. its on disconnect on X on Y will be arrays of functions which it will call, as it may have many watchers.
webrtc and websocket_api will talk during connection, and when disconnections happens, basically alerting the signaling server of whats going on.

in game will use both websocket_api and webrtc. it will start the webrtc connection by calling connect, and setup callbacks on websocket_api so it knows when disconnects happen, when connects happen, as this will be the frontfacing to the user.



Supabase.ts
this handles all of supabase, the connection, auth, and any future calls we may need to do. it will give the user of these easy functions like login logout maybe check subscription in future.
itll create the global supabase client then have functions that use it (not a class based file)

for the visual / JSX compoentns NOW:

/src
    /home
        home.tsx (the home page exactly same as frontend old)
        home.css
        game-card.tsx (the game card that lives in the home page (currently only clahs royale))
    /pricing
        pricing.tsx (same as old frontend)
    /in_game
        /canvas
            canvas.tsx (the actual canvas, which handles getting input from itself kinda like input.js, but it will get the input and call funcs in input.ts)
            canvas.css
            input.ts (has functions that take the raw inpit and turn it into the types needed.) (and has a function sendInput which returns the correct input that should be sent through webrtc and does send it to webrtc as it should be passed as a callback by ingame.tsx)
        InGame.tsx
        InGame.css
        helpers.ts (helpers for in game only)
        - in game will handle a lot. frist it will look exactly the samne as old frontend
        - will initate the web rtc connection on load with the given game (helpers.ts)
        - it should not need access to the signaling server code as webrtc only needs it, other than watching for errors (TODO think ab more)
    /utils
        all other .ts only files will go here (webrtc, api.ts decoder.ts)

    /components
        navbar.tsx

    Router.tsx (react router has nav bar at top and renders whatever below it)
    main.tsx (setup file)

dependensies:
use react router-dom for routing
react helmet for seo
supabase for well supabase



always use ASYNC AWAIT no promises
all of the frontend worker and signaling server should  all share types using /shared/types.ts
any messages they send, or types they shared (input video etc) should be correctly typed.

all react compoents should be like
```
export default function ComponentName(){

}
```

simplicity is key!
if you dont understand anything or need confirmation just ask me!

Notes:
- webrtc will know about the functions in the signaling server and call them as needed when connecting to it, as the websocket_api is a single ton it can just import it.
- thier should be an error message type which has a msg and a CODE which should also be a type (const like NO_SUBSCRPTION)
- webrtcs connect function should return a send input func.






