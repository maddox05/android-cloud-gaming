export const redroid_config = {
  // Container settings
  redroid_docker_container_name: "redroid-worker",
  redroid_docker_port: 5555,

  // Docker image
  redroid_docker_image_name: "redroid/redroid",
  redroid_docker_image_tag: "12.0.0_64only-latest",

  // Volume mount
  redroid_data_volume: "~/data:/data",

  // Android boot parameters
  redroid_width: 360,
  redroid_height: 640,
  redroid_dpi: 120,
  redroid_fps: 20,
};

export const scrcpy_config = {
  video_port: 6767,
  input_port: 6868,
};

export const pod_config = {
  pod_server_port: 6969,
};
