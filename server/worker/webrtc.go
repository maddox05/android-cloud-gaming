package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os/exec"
	"sync"
	"time"

	"github.com/pion/webrtc/v3"
	"github.com/pion/webrtc/v3/pkg/media"
	"github.com/pion/webrtc/v3/pkg/media/h264reader"
)

type WebRTCServer struct {
	port           string
	adbPort        string
	peerConnection *webrtc.PeerConnection
	videoTrack     *webrtc.TrackLocalStaticSample
	mutex          sync.Mutex
}

func NewWebRTCServer(port, adbPort string) *WebRTCServer {
	return &WebRTCServer{
		port:    port,
		adbPort: adbPort,
	}
}

func (s *WebRTCServer) Start() error {
	// Serve static files (frontend)
	http.HandleFunc("/", s.serveHTML)
	http.HandleFunc("/offer", s.handleOffer)

	fmt.Printf("WebRTC server starting on http://0.0.0.0:%s\n", s.port)
	return http.ListenAndServe(":"+s.port, nil)
}

func (s *WebRTCServer) serveHTML(w http.ResponseWriter, r *http.Request) {
	// Serve the frontend index.html
	http.ServeFile(w, r, "../../../frontend/index.html")
}

func (s *WebRTCServer) handleOffer(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Read the offer from client
	var offer webrtc.SessionDescription
	if err := json.NewDecoder(r.Body).Decode(&offer); err != nil {
		log.Printf("Error decoding offer: %v", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	log.Printf("Received offer type: %s", offer.Type)
	log.Printf("Offer SDP length: %d", len(offer.SDP))
	log.Printf("Offer SDP:\n%s", offer.SDP)

	// Create answer
	answer, err := s.createAnswer(offer)
	if err != nil {
		log.Printf("Error creating answer: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Send answer back to client
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(answer)
}

func (s *WebRTCServer) createAnswer(offer webrtc.SessionDescription) (*webrtc.SessionDescription, error) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	// Create a new PeerConnection
	config := webrtc.Configuration{
		ICEServers: []webrtc.ICEServer{
			{
				URLs: []string{"stun:stun.l.google.com:19302"},
			},
		},
	}

	peerConnection, err := webrtc.NewPeerConnection(config)
	if err != nil {
		return nil, err
	}

	// Create a video track
	videoTrack, err := webrtc.NewTrackLocalStaticSample(
		webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeH264},
		"video",
		"android-screen",
	)
	if err != nil {
		return nil, err
	}

	// Add track to peer connection
	if _, err = peerConnection.AddTrack(videoTrack); err != nil {
		return nil, err
	}

	s.peerConnection = peerConnection
	s.videoTrack = videoTrack

	// Set the remote description (offer from client)
	if err = peerConnection.SetRemoteDescription(offer); err != nil {
		return nil, err
	}

	// Create an answer
	answer, err := peerConnection.CreateAnswer(nil)
	if err != nil {
		return nil, err
	}

	// Set local description
	if err = peerConnection.SetLocalDescription(answer); err != nil {
		return nil, err
	}

	// Start streaming video
	go s.streamVideo()

	return &answer, nil
}

func (s *WebRTCServer) streamVideo() {
	fmt.Println("Starting video stream to WebRTC...")

	// Use scrcpy to capture screen and pipe to ffmpeg
	scrcpyCmd := exec.Command(
		"scrcpy",
		"-s", fmt.Sprintf("localhost:%s", s.adbPort),
		"--max-fps=20",
		"--max-size=360",
		"--no-display",
		"--record=-",
		"--record-format=mkv",
	)

	// ffmpeg converts mkv to raw h264
	ffmpegCmd := exec.Command(
		"ffmpeg",
		"-i", "-",
		"-an", // No audio
		"-c:v", "copy",
		"-f", "h264",
		"-",
	)

	// Pipe scrcpy to ffmpeg
	scrcpyStdout, err := scrcpyCmd.StdoutPipe()
	if err != nil {
		log.Printf("Failed to create scrcpy pipe: %v", err)
		return
	}
	ffmpegCmd.Stdin = scrcpyStdout

	// Get ffmpeg output
	ffmpegStdout, err := ffmpegCmd.StdoutPipe()
	if err != nil {
		log.Printf("Failed to create ffmpeg pipe: %v", err)
		return
	}

	// Start both commands
	if err := scrcpyCmd.Start(); err != nil {
		log.Printf("Failed to start scrcpy: %v", err)
		return
	}

	if err := ffmpegCmd.Start(); err != nil {
		log.Printf("Failed to start ffmpeg: %v", err)
		return
	}

	// Read h264 frames and send to WebRTC
	h264Reader, err := h264reader.NewReader(ffmpegStdout)
	if err != nil {
		log.Printf("Failed to create h264 reader: %v", err)
		return
	}

	fmt.Println("Streaming h264 frames to WebRTC...")
	for {
		nal, err := h264Reader.NextNAL()
		if err != nil {
			if err == io.EOF {
				break
			}
			log.Printf("Error reading NAL: %v", err)
			break
		}

		if s.videoTrack == nil {
			break
		}

		// Write NAL to video track
		// Video RTP clock rate is 90000 Hz, so duration = 90000 / fps
		if err := s.videoTrack.WriteSample(media.Sample{
			Data:     nal.Data,
			Duration: time.Millisecond * 50, // 20 fps = 50ms per frame
		}); err != nil {
			log.Printf("Error writing sample: %v", err)
			break
		}
	}

	scrcpyCmd.Wait()
	ffmpegCmd.Wait()
	fmt.Println("Video stream ended")
}
