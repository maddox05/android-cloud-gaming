// main will be the entry point for the pod node module
// main will talk to all 3 compoennts, that being input video and redroid runner.
//main on start will run the redroid runner
// call get video which takes in a webrtc socket to send that video too
// and wait for inputs from the webrtc socket
// main is basically a webrtc handler
// it will have 2 lines open
// one for the video where it can only send not recieve
// and one for the input where it can only receive and not send
// singaler will start the connection, and main will only get the finalized connection details.
// main.ts will also have 2 threads open.
// one for the video, and one for the inputs, so none of them block
// webrtc will be setup using media soup.

/**
 * PROMPT:
 * you will be finishing my android cloud gaming platform MVP
 * you will finish the singaling server first then the backend then the frontend (simple html file)
 * this allows users to play android games on cloud from browser.
 *
 * each file has comments on it on how its suppose to be made, and how they connect to the other componets.
 *
 * the video input and redroid runner should all be singletons, dont do anything complicated though, simplicitity is key.
 *
 *
 *
 * read through all files once and come back w questions and clarifications
 *
 * speed is of importance, but only really matters for the video, but since we are piping and forwarding it shouldnt be an issue
 *
 * use media soup for webrtc stuff, if im forfetting anything lmk
 */
