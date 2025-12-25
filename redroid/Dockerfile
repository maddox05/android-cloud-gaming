FROM redroid/redroid:12.0.0-latest

ADD system/ /system/

# Enable ARM translation by default
ENV RO_DALVIK_VM_NATIVE_BRIDGE=libndk_translation.so \
    RO_ENABLE_NATIVE_BRIDGE_EXEC=1 \
    PERSIST_SYS_NATIVEBRIDGE=1 \
    PERSIST_SYS_NDK_TRANSLATION=1

CMD ["androidboot.use_redroid_overlayfs=1", \
     "ro.dalvik.vm.native.bridge=libndk_translation.so", \
     "ro.enable.native.bridge.exec=1", \
     "persist.sys.nativebridge=1", \
     "persist.sys.ndk_translation=1"]
