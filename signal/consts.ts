export const SERVER_PORT = process.env.SIGNAL_PORT! || 8080;

export const CHECK_LOOP_INTERVAL = 5000; // how often to ping client and worker, how often to do checks for client and workker
export const PING_TIMEOUT_THRESHOLD = 10000; // this is basically if they havent send a pong back in this amt of time kick them

export const INPUT_TIMEOUT_THRESHOLD = 180000; // if client doesnt send input in X amt of time, kick them

// Queue settings
export const QUEUE_PROCESS_INTERVAL = 5000; // how often to run FUNCA (process queue)
export const QUEUE_TIMEOUT_THRESHOLD = 20 * 60 * 1000; // 20 minutes max in queue
export const CONNECTING_TIMEOUT_THRESHOLD = 30 * 1000; // 30 seconds to send START after QUEUE_READY
