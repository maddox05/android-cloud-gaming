start a pod:
docker compose -p pod0 -f docker-compose.pod.yml up --build

start signal server:
docker compose -f docker-compose.signal.yml up --build

clean docker state:
docker rm -f $(docker ps -aq)

debug android games
adb logcat -c
adb logcat -v time | grep -iE "supercell|brawl|royale|AndroidRuntime|libc|linker|fatal|signal"
