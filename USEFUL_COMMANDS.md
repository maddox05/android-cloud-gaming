docker kill $(docker ps -q)

docker container prune -f

docker volume rm $(docker volume ls -q)

docker compose -p worker0 -f docker-compose.worker.yml up --build -d && \
docker compose -p worker1 -f docker-compose.worker.yml up --build -d && \
docker compose -p worker2 -f docker-compose.worker.yml up --build -d && \
docker compose -p worker3 -f docker-compose.worker.yml up --build -d
