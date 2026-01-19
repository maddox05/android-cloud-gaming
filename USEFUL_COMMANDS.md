docker kill $(docker ps -q)

docker container prune -f

docker volume rm $(docker volume ls -q)
