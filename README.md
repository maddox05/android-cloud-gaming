start a pod:
docker compose -p pod0 -f docker-compose.pod.yml up --build

clean docker state:
docker rm -f $(docker ps -aq)
