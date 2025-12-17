package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/exec"
	"strings"
	"time"
)

// TODO: This is for testing only. In production, Go should run alone with its container,
// not starting containers. Each worker should be a separate Docker image or Kubernetes pod.

type Worker struct {
	Port          string
	ContainerName string
	ContainerID   string
}

func main() {
	fmt.Println("worker started")

	// Example configuration - in production these would come from environment variables or config
	worker := &Worker{
		Port:          "5555",
		ContainerName: "redroid-worker-1",
	}

	// Step 1: Start the container using start.sh
	if err := worker.startContainer(); err != nil {
		log.Fatalf("Failed to start container: %v", err)
	}
	fmt.Printf("Container started: %s (ID: %s)\n", worker.ContainerName, worker.ContainerID)

	// Ensure cleanup happens at the end
	defer func() {
		fmt.Println("\nCleaning up...")
		worker.cleanup()
	}()

	// Wait for container to be ready
	time.Sleep(5 * time.Second)

	// Step 2: Connect ADB to the container
	if err := worker.connectADB(); err != nil {
		log.Fatalf("Failed to connect ADB: %v", err)
	}
	fmt.Println("ADB connected successfully")

	// Step 3: Stream video using scrcpy with h264 compression
	if err := worker.streamVideo(); err != nil {
		log.Fatalf("Failed to stream video: %v", err)
	}

	fmt.Println("Worker completed successfully!")
}

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

	// Verify connection
	adbDevices := exec.Command("adb", "devices")
	adbDevices.Stdout = os.Stdout
	adbDevices.Stderr = os.Stderr

	if err := adbDevices.Run(); err != nil {
		return fmt.Errorf("adb devices failed: %w", err)
	}

	return nil
}

func (w *Worker) streamVideo() error {
	// Use scrcpy to stream video and pipe to ffmpeg for encoding
	outputFile := fmt.Sprintf("recording-%s.mp4", time.Now().Format("20060102-150405"))

	fmt.Printf("Recording video to %s for 10 seconds...\n", outputFile)

	// Create context with 15 second timeout (10s recording + 5s for ffmpeg to finish)
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	// scrcpy command - output video to stdout in mkv format
	scrcpyCmd := exec.CommandContext(
		ctx,
		"scrcpy",
		"-s", fmt.Sprintf("localhost:%s", w.Port),
		"--max-fps=20",
		"--max-size=360",
		"--no-display",
		"--record=-", // Output to stdout
		"--record-format=mkv",
	)

	// ffmpeg command - read from stdin, copy to mp4
	// Use separate context for ffmpeg (not tied to scrcpy timeout)
	ffmpegCmd := exec.Command(
		"ffmpeg",
		"-y", // Overwrite output file
		"-i", "-", // Read from stdin
		"-c", "copy", // Copy streams without re-encoding
		"-movflags", "+faststart", // Optimize for streaming
		outputFile,
	)

	// Pipe scrcpy stdout to ffmpeg stdin
	pipe, err := scrcpyCmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("failed to create pipe: %w", err)
	}
	ffmpegCmd.Stdin = pipe
	ffmpegCmd.Stdout = os.Stdout
	ffmpegCmd.Stderr = os.Stderr
	scrcpyCmd.Stderr = os.Stderr

	// Start ffmpeg first (so it's ready to receive data)
	if err := ffmpegCmd.Start(); err != nil {
		return fmt.Errorf("failed to start ffmpeg: %w", err)
	}

	// Start scrcpy
	if err := scrcpyCmd.Start(); err != nil {
		return fmt.Errorf("failed to start scrcpy: %w", err)
	}

	// Wait for scrcpy to finish (will be killed by context after 15s)
	scrcpyErr := scrcpyCmd.Wait()
	if scrcpyErr != nil && ctx.Err() == nil {
		// Only report error if it wasn't due to timeout
		fmt.Printf("Warning: scrcpy exited with error: %v\n", scrcpyErr)
	}

	// Close the pipe so ffmpeg knows input is done
	pipe.Close()

	// Wait for ffmpeg to finish writing the file
	ffmpegErr := ffmpegCmd.Wait()
	if ffmpegErr != nil {
		return fmt.Errorf("ffmpeg failed: %w", ffmpegErr)
	}

	fmt.Printf("Recording complete! Saved to: %s\n", outputFile)
	return nil
}

func (w *Worker) cleanup() {
	// Disconnect ADB
	fmt.Println("Disconnecting ADB...")
	disconnectCmd := exec.Command("adb", "disconnect", fmt.Sprintf("localhost:%s", w.Port))
	disconnectCmd.Run() // Ignore errors

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