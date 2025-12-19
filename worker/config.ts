export const redroid_config = {
  host: process.env.REDROID_HOST || "localhost",
  port: 5555,
  width: parseInt(process.env.REDROID_WIDTH || "360"),
  height: parseInt(process.env.REDROID_HEIGHT || "640"),
};

export const scrcpy_config = {
  // Single port - scrcpy uses one abstract socket, we connect multiple times
  // First connection = video, second connection = control
  port: 6767,
};

export const pod_config = {
  pod_server_port: 6969,
};
