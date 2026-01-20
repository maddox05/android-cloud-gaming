import net from "net";

/**
 * Abstract handler for a connection received from ScrcpyServer.
 * Subclasses (VideoHandler, InputHandler) implement onData/onConnect/onClose.
 */
export abstract class BaseConnectionHandler {
  protected socket: net.Socket | null = null;
  protected connected = false;
  public readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  /** Called by ScrcpyServer when a connection is assigned to this handler */
  _assignSocket(socket: net.Socket): void {
    this.socket = socket;
    this.connected = true;

    console.log(`${this.name} socket assigned`);

    socket.setNoDelay(true);

    socket.on("data", (data) => this.onData(data));

    socket.on("error", (err) => {
      console.error(`${this.name} socket error:`, err);
    });

    socket.on("close", () => {
      console.log(`${this.name} socket closed`);
      this.connected = false;
      this.socket = null;
      this.onClose();
    });

    this.onConnect();
  }

  isConnected(): boolean {
    return this.connected && this.socket !== null;
  }

  protected write(data: Buffer): void {
    this.socket.write(data);
  }

  close(): void {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
      this.connected = false;
    }
  }

  // Hooks for subclasses to override
  protected onConnect(): void {}
  protected abstract onData(data: Buffer): void;
  protected onClose(): void {}
}

/**
 * Server that listens for scrcpy connections and assigns them to handlers in order.
 * First registered handler gets first connection, second gets second, etc.
 */
export class ScrcpyServer {
  private server: net.Server | null = null;
  private handlers: BaseConnectionHandler[] = [];
  private nextHandlerIndex = 0;
  private port: number;
  private host: string;

  constructor(port: number, host: string = "127.0.0.1") {
    this.port = port;
    this.host = host;
  }

  /** Register a handler. First registered = first connection */
  addHandler(handler: BaseConnectionHandler): void {
    this.handlers.push(handler);
    console.log(
      `ScrcpyServer: registered handler "${handler.name}" (index ${this.handlers.length - 1})`,
    );
  }

  /** Start listening for connections */
  listen(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => {
        const handlerIndex = this.nextHandlerIndex;

        if (handlerIndex < this.handlers.length) {
          const handler = this.handlers[handlerIndex];
          this.nextHandlerIndex++;
          console.log(
            `ScrcpyServer: assigning connection ${handlerIndex} to "${handler.name}"`,
          );
          handler._assignSocket(socket);
        } else {
          console.warn(
            `ScrcpyServer: unexpected connection (no handler at index ${handlerIndex}), closing`,
          );
          socket.destroy();
        }
      });

      this.server.on("error", (err) => {
        console.error("ScrcpyServer error:", err);
        reject(err);
      });

      this.server.listen(this.port, this.host, () => {
        console.log(`ScrcpyServer listening on ${this.host}:${this.port}`);
        resolve();
      });
    });
  }

  /** Close the server and all connections */
  close(): void {
    for (const handler of this.handlers) {
      handler.close();
    }
    if (this.server) {
      this.server.close();
      this.server = null;
    }
    this.nextHandlerIndex = 0;
    console.log("ScrcpyServer closed");
  }

  /** Reset for reuse - close and clear handlers */
  reset(): void {
    this.close();
    this.handlers = [];
  }
}
