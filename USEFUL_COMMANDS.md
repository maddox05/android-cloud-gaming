docker kill $(docker ps -q)

docker container prune -f

# remove all volumes

docker volume rm $(docker volume ls -q)

# good start command for server with many phones

git pull && docker kill $(docker ps -q) && docker container prune -f && docker compose -p worker0 -f docker-compose.worker.yml up --build -d && \
docker compose -p worker1 -f docker-compose.worker.yml up --build -d && \
docker compose -p worker2 -f docker-compose.worker.yml up --build -d && \
docker compose -p worker3 -f docker-compose.worker.yml up --build -d

# to look into andriods phone data

docker run --rm -it -v redroid-base:/data alpine sh

# to reset free kisok .

adb shell su -c "rm -rf /data/data/com.freekiosk/\*"
