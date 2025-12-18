// runs redroid with the given config in confg.ts
// this is a singleton, and gives data to those who want it.
// redroid runner will run commands to startup redroid correctly, and have a function is running while others can call to see if its running.

// it will run these commands as well

/**
 * 
 * adb push scrcpy-server-v2.1 /data/local/tmp/scrcpy-server-manual.jar
adb forward tcp:1234 localabstract:scrcpy
adb forward tcp:1234 localabstract:scrcpy-control

adb shell CLASSPATH=/data/local/tmp/scrcpy-server-manual.jar \
    app_process / com.genymobile.scrcpy.Server 2.1 \
    tunnel_forward=true audio=false control=true cleanup=false \
    raw_stream=true max_size=1920

    but values likle max_size and the tcp port (for video) it truns on should be in the config.
    



    it will also expose the redroid config for video and input etc to get from
 */
