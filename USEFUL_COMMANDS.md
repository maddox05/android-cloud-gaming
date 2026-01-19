docker kill $(docker ps -q)

docker container prune -f

docker volume rm $(docker volume ls -q)

docker compose -p pod0 -f docker-compose.pod.yml up --build -d && \
docker compose -p pod1 -f docker-compose.pod.yml up --build -d && \
docker compose -p pod2 -f docker-compose.pod.yml up --build -d && \
docker compose -p pod3 -f docker-compose.pod.yml up --build -d
