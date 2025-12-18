// this file will handle the singaling operations.
// this is a standalone server which wil need to handle ultiple events at the same time.
// the event it will handle is a new connection one
// this will be played when the client wants to start a new android session
// this signal server will choose a free node, and handle the webrtc signaling between the client and the node, finally resulting in the client being connected to the node, and the signaing server is no longer needed.

// this will have a hardcoded ip where the server is located for now, as this is a MVP
