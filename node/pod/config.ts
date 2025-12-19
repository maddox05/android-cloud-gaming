export const redroid_config = {
  // Container settings
  redroid_docker_container_name: "redroid-worker",
  redroid_docker_port: 9999,

  // Docker image (configurable via environment variables)
  redroid_docker_image_name: process.env.REDROID_IMAGE,
  redroid_docker_image_tag: process.env.REDROID_TAG,

  // Volume mount
  redroid_data_volume: "~/data:/data",

  // Android boot parameters
  redroid_width: 360,
  redroid_height: 640,
  redroid_dpi: 120,
  redroid_fps: 20,
};

export const scrcpy_config = {
  // Single port - scrcpy uses one abstract socket, we connect multiple times
  // First connection = video, second connection = control
  port: 6767,
};

export const pod_config = {
  pod_server_port: 6969,
};
