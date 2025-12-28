export const SERVER_PORT = (process.env.SIGNAL_PORT! || 8080);

export const PING_INTERVAL = 5000; // how often to ping client and server, if a ping ever fails, kick the connected pair
export const PING_TIMEOUT_THRESHOLD = 10000 // this is basically if they havent send a pong back in this amt of time kick them


export const INPUT_TIMEOUT_THRESHOLD = 180000; // if client doesnt send input in X amt of time, kick them