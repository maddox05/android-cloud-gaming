package main

import (
	"fmt"
	"log"
	"os"
	"os/exec"
	"os/signal"
	"strings"
	"syscall"
	"time"
)

type Worker struct {
	Port          string
	ContainerName string
	ContainerID   string
}

// Main entry point for WebRTC streaming server
func main() {
	fmt.Println("Android Cloud Gaming - WebRTC Streaming Server")
	fmt.Println("================================================")

	// Configuration
	worker := &Worker{
		Port:          "5555",
		ContainerName: "redroid-webrtc-1",
	}
	webrtcPort := "8080"

	// Step 1: Start the Android container
	fmt.Println("\n[1/3] Starting Android container...")
	if err := worker.startContainer(); err != nil {
		log.Fatalf("Failed to start container: %v", err)
	}
	fmt.Printf("✓ Container started: %s (ID: %s)\n", worker.ContainerName, worker.ContainerID)

	// Ensure cleanup on exit
	defer func() {
		fmt.Println("\nCleaning up...")
		worker.cleanup()
	}()

	// Handle Ctrl+C gracefully
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-sigChan
		fmt.Println("\nReceived interrupt signal, shutting down...")
		worker.cleanup()
		os.Exit(0)
	}()

	// Wait for container to be ready
	fmt.Println("\n[2/3] Waiting for Android container to boot...")
	time.Sleep(5 * time.Second)

	// Step 2: Connect ADB
	fmt.Println("\n[3/3] Connecting ADB...")
	if err := worker.connectADB(); err != nil {
		log.Fatalf("Failed to connect ADB: %v", err)
	}
	fmt.Println("✓ ADB connected successfully")

	// Step 3: Start WebRTC server
	fmt.Println("\n🚀 Starting WebRTC streaming server...")
	fmt.Println("================================================")
	fmt.Printf("\nServer running at: http://localhost:%s\n", webrtcPort)
	fmt.Println("Open this URL in your browser to start streaming")
	fmt.Println("\nPress Ctrl+C to stop the server")
	fmt.Println("================================================\n")

	server := NewWebRTCServer(webrtcPort, worker.Port)
	if err := server.Start(); err != nil {
		log.Fatalf("WebRTC server error: %v", err)
	}
}

// Worker and its methods (reused from main.go)

func (w *Worker) startContainer() error {
	cmd := exec.Command("./start.sh", w.Port, w.ContainerName)
	output, err := cmd.Output()
	if err != nil {
		return fmt.Errorf("failed to execute start.sh: %w", err)
	}

	w.ContainerID = strings.TrimSpace(string(output))
	if w.ContainerID == "" {
		return fmt.Errorf("no container ID returned from start.sh")
	}

	return nil
}

func (w *Worker) connectADB() error {
	// Connect ADB to the container on the specified port
	adbConnect := exec.Command("adb", "connect", fmt.Sprintf("localhost:%s", w.Port))
	adbConnect.Stdout = os.Stdout
	adbConnect.Stderr = os.Stderr

	if err := adbConnect.Run(); err != nil {
		return fmt.Errorf("adb connect failed: %w", err)
	}

	// Wait for device to be ready
	time.Sleep(2 * time.Second)

	return nil
}

func (w *Worker) cleanup() {
	// Disconnect ADB
	fmt.Println("Disconnecting ADB...")
	disconnectCmd := exec.Command("adb", "disconnect", fmt.Sprintf("localhost:%s", w.Port))
	disconnectCmd.Run()

	// Stop and remove the container
	if w.ContainerID != "" {
		fmt.Printf("Stopping container %s...\n", w.ContainerName)
		stopCmd := exec.Command("sudo", "docker", "stop", w.ContainerID)
		stopCmd.Stdout = os.Stdout
		stopCmd.Stderr = os.Stderr
		if err := stopCmd.Run(); err != nil {
			fmt.Printf("Warning: Failed to stop container: %v\n", err)
		}

		fmt.Printf("Removing container %s...\n", w.ContainerName)
		rmCmd := exec.Command("sudo", "docker", "rm", w.ContainerID)
		rmCmd.Stdout = os.Stdout
		rmCmd.Stderr = os.Stderr
		if err := rmCmd.Run(); err != nil {
			fmt.Printf("Warning: Failed to remove container: %v\n", err)
		}
	}

	fmt.Println("Cleanup complete!")
}
