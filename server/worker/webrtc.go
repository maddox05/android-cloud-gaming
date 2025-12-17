package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
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
	dataChannel    *webrtc.DataChannel
	mutex          sync.Mutex
}

// InputEvent represents an input action from the frontend
type InputEvent struct {
	Type      string  `json:"type"`      // "tap", "swipe", "keyevent", "text"
	X         int     `json:"x,omitempty"`
	Y         int     `json:"y,omitempty"`
	X2        int     `json:"x2,omitempty"`
	Y2        int     `json:"y2,omitempty"`
	Duration  int     `json:"duration,omitempty"` // for swipe
	KeyCode   string  `json:"keycode,omitempty"`  // for keyevent
	Text      string  `json:"text,omitempty"`     // for text input
	Timestamp int64   `json:"timestamp"`          // client timestamp
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

	log.Println("=== Creating WebRTC Answer ===")

	// Create a new PeerConnection with multiple STUN servers
	config := webrtc.Configuration{
		ICEServers: []webrtc.ICEServer{
			{
				URLs: []string{
					"stun:stun.l.google.com:19302",
					"stun:stun1.l.google.com:19302",
					"stun:stun2.l.google.com:19302",
				},
			},
		},
	}

	peerConnection, err := webrtc.NewPeerConnection(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create peer connection: %w", err)
	}

	log.Println("✓ Created PeerConnection")

	// Create a video track
	videoTrack, err := webrtc.NewTrackLocalStaticSample(
		webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeH264},
		"video",
		"android-screen",
	)
	if err != nil {
		peerConnection.Close()
		return nil, fmt.Errorf("failed to create video track: %w", err)
	}

	log.Println("✓ Created video track")

	// Add track to peer connection
	rtpSender, err := peerConnection.AddTrack(videoTrack)
	if err != nil {
		peerConnection.Close()
		return nil, fmt.Errorf("failed to add track: %w", err)
	}

	log.Printf("✓ Added track to peer connection (RTP Sender: %v)", rtpSender != nil)

	// Read RTCP packets (required for proper RTP flow)
	go func() {
		rtcpBuf := make([]byte, 1500)
		for {
			if _, _, rtcpErr := rtpSender.Read(rtcpBuf); rtcpErr != nil {
				return
			}
		}
	}()

	s.peerConnection = peerConnection
	s.videoTrack = videoTrack

	// Create data channel for input events
	dataChannel, err := peerConnection.CreateDataChannel("input", nil)
	if err != nil {
		peerConnection.Close()
		return nil, fmt.Errorf("failed to create data channel: %w", err)
	}
	s.dataChannel = dataChannel

	log.Println("✓ Created data channel for input")

	// Set up data channel event handlers
	dataChannel.OnOpen(func() {
		log.Printf("🎮 Data channel opened - ready to receive input events")
	})

	dataChannel.OnClose(func() {
		log.Printf("🎮 Data channel closed")
	})

	dataChannel.OnMessage(func(msg webrtc.DataChannelMessage) {
		s.handleInputEvent(msg.Data)
	})

	// Set up connection state handler to start streaming when connected
	peerConnection.OnICEConnectionStateChange(func(connectionState webrtc.ICEConnectionState) {
		log.Printf("📡 ICE Connection State: %s", connectionState.String())

		switch connectionState {
		case webrtc.ICEConnectionStateConnected:
			log.Println("🎉 ICE Connected! Starting video stream...")
			go s.streamVideo()
		case webrtc.ICEConnectionStateDisconnected:
			log.Println("⚠️  ICE Disconnected")
		case webrtc.ICEConnectionStateFailed:
			log.Println("❌ ICE Failed")
		case webrtc.ICEConnectionStateClosed:
			log.Println("🔒 ICE Closed")
		}
	})

	// Log ICE gathering state changes
	peerConnection.OnICEGatheringStateChange(func(state webrtc.ICEGathererState) {
		log.Printf("🔍 ICE Gathering State: %s", state.String())
	})

	// Log ICE candidates for debugging
	candidateCount := 0
	peerConnection.OnICECandidate(func(candidate *webrtc.ICECandidate) {
		if candidate != nil {
			candidateCount++
			log.Printf("🧊 ICE candidate #%d: %s (type: %s)",
				candidateCount, candidate.Address, candidate.Typ.String())
		} else {
			log.Printf("✓ ICE gathering complete (%d candidates total)", candidateCount)
		}
	})

	// Set the remote description (offer from client)
	log.Println("Setting remote description (client offer)...")
	if err = peerConnection.SetRemoteDescription(offer); err != nil {
		peerConnection.Close()
		return nil, fmt.Errorf("failed to set remote description: %w", err)
	}
	log.Println("✓ Remote description set")

	// Create an answer
	log.Println("Creating answer...")
	answer, err := peerConnection.CreateAnswer(nil)
	if err != nil {
		peerConnection.Close()
		return nil, fmt.Errorf("failed to create answer: %w", err)
	}
	log.Println("✓ Answer created")

	// CRITICAL: Create a channel that blocks until ICE gathering is complete
	// This ensures we send all ICE candidates in the answer SDP
	gatherComplete := webrtc.GatheringCompletePromise(peerConnection)

	// Set local description - this starts ICE gathering
	log.Println("Setting local description (starting ICE gathering)...")
	if err = peerConnection.SetLocalDescription(answer); err != nil {
		peerConnection.Close()
		return nil, fmt.Errorf("failed to set local description: %w", err)
	}
	log.Println("✓ Local description set, waiting for ICE gathering...")

	// Wait for ICE gathering to complete
	<-gatherComplete
	log.Println("✓ ICE gathering complete!")

	// Return the complete answer with all ICE candidates
	return peerConnection.LocalDescription(), nil
}

func (s *WebRTCServer) streamTestVideo() {
	log.Println("🎬 STREAMING VIDEO FROM assets/test_video.mp4")

	// UNCOMMENT THIS FOR TEST PATTERN (to verify WebRTC works):
	// cmd := exec.Command("ffmpeg",
	// 	"-re", "-f", "lavfi", "-i", "testsrc=size=360x640:rate=30",
	// 	"-pix_fmt", "yuv420p", "-c:v", "libx264",
	// 	"-preset", "ultrafast", "-tune", "zerolatency",
	// 	"-profile:v", "baseline", "-f", "h264", "pipe:1",
	// )

	// FILE INPUT - optimized for CPU encoding
	cmd := exec.Command("ffmpeg",
		"-stream_loop", "-1",
		"-i", "assets/test_video.mp4",
		"-vf", "fps=20,scale=270:480",  // Lower res/fps for CPU
		"-c:v", "libx264",
		"-preset", "superfast",        // Faster than ultrafast
		"-tune", "zerolatency",
		"-profile:v", "baseline",
		"-pix_fmt", "yuv420p",
		"-threads", "4",               // Multi-thread encoding
		"-g", "60",                    // Keyframe every 2 seconds
		"-an",
		"-bsf:v", "h264_mp4toannexb",
		"-f", "h264",
		"pipe:1",
	)

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		log.Printf("Pipe error: %v", err)
		return
	}
	cmd.Stderr = os.Stderr

	if err := cmd.Start(); err != nil {
		log.Printf("FFmpeg error: %v", err)
		return
	}

	log.Println("📹 Parsing H.264 NAL units...")

	// Use h264reader to send complete NAL units (fixes green screen)
	h264Reader, err := h264reader.NewReader(stdout)
	if err != nil {
		log.Printf("h264reader error: %v", err)
		return
	}

	nalCount := 0
	for {
		nal, err := h264Reader.NextNAL()
		if err != nil {
			break
		}

		if s.videoTrack != nil {
			// Send NAL units immediately - duration doesn't matter for H.264
			s.videoTrack.WriteSample(media.Sample{
				Data:     nal.Data,
				Duration: time.Millisecond, // Minimal duration, send ASAP
			})
			nalCount++
			if nalCount%200 == 0 {
				log.Printf("✓ Sent %d NAL units", nalCount)
			}
		}
	}

	cmd.Process.Kill()
	cmd.Wait()
}

func (s *WebRTCServer) handleInputEvent(data []byte) {
	receiveTime := time.Now().UnixMilli()

	var event InputEvent
	if err := json.Unmarshal(data, &event); err != nil {
		log.Printf("❌ [INPUT] Failed to parse input event: %v", err)
		return
	}

	// Calculate latency from client to server
	latency := receiveTime - event.Timestamp

	log.Printf("🎮 [INPUT] Received at %d ms | Type: %s | Client timestamp: %d ms | Latency: %d ms",
		receiveTime, event.Type, event.Timestamp, latency)

	// Execute the input command via ADB
	startExec := time.Now().UnixMilli()
	if err := s.executeADBInput(event); err != nil {
		log.Printf("❌ [INPUT] Failed to execute ADB command: %v", err)
		return
	}
	execDuration := time.Now().UnixMilli() - startExec

	log.Printf("✓ [INPUT] Executed %s in %d ms | Total handling time: %d ms",
		event.Type, execDuration, time.Now().UnixMilli()-receiveTime)
}

func (s *WebRTCServer) executeADBInput(event InputEvent) error {
	var cmd *exec.Cmd

	switch event.Type {
	case "tap":
		cmd = exec.Command("adb", "shell", "input", "tap",
			fmt.Sprintf("%d", event.X), fmt.Sprintf("%d", event.Y))
		log.Printf("🎯 [ADB] input tap %d %d", event.X, event.Y)

	case "swipe":
		duration := event.Duration
		if duration == 0 {
			duration = 300 // default 300ms
		}
		cmd = exec.Command("adb", "shell", "input", "swipe",
			fmt.Sprintf("%d", event.X), fmt.Sprintf("%d", event.Y),
			fmt.Sprintf("%d", event.X2), fmt.Sprintf("%d", event.Y2),
			fmt.Sprintf("%d", duration))
		log.Printf("👆 [ADB] input swipe %d %d %d %d %d",
			event.X, event.Y, event.X2, event.Y2, duration)

	case "keyevent":
		cmd = exec.Command("adb", "shell", "input", "keyevent", event.KeyCode)
		log.Printf("⌨️  [ADB] input keyevent %s", event.KeyCode)

	case "text":
		// Escape special characters for shell
		cmd = exec.Command("adb", "shell", "input", "text", event.Text)
		log.Printf("📝 [ADB] input text '%s'", event.Text)

	default:
		return fmt.Errorf("unknown input type: %s", event.Type)
	}

	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("ADB command failed: %v, output: %s", err, output)
	}

	return nil
}

func (s *WebRTCServer) streamVideo() {
	log.Println("Starting adb screenrecord → WebRTC stream")

	cmd := exec.Command(
		"adb",
		"shell",
		"screenrecord",
		"--output-format=h264",
		"-",
	)

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		log.Printf("stdout pipe error: %v", err)
		return
	}
	cmd.Stderr = os.Stderr

	if err := cmd.Start(); err != nil {
		log.Printf("failed to start adb screenrecord: %v", err)
		return
	}

	// Create H264 Annex-B reader
	reader, err := h264reader.NewReader(stdout)
	if err != nil {
		log.Printf("h264 reader error: %v", err)
		return
	}

	frameDuration := time.Second / 30 // screenrecord ≈ 30fps
	ticker := time.NewTicker(frameDuration)
	defer ticker.Stop()

	frameCount := 0
	lastLogTime := time.Now()

	for range ticker.C {
		if s.videoTrack == nil {
			break
		}

		nalus, err := reader.NextNAL()
		if err != nil {
			if err != io.EOF {
				log.Printf("NAL read error: %v", err)
			}
			break
		}

		frameTime := time.Now().UnixMilli()
		err = s.videoTrack.WriteSample(media.Sample{
			Data:     nalus.Data,
			Duration: frameDuration,
		})
		if err != nil {
			log.Printf("WriteSample error: %v", err)
			break
		}

		frameCount++
		// Log every 30 frames (approximately 1 second)
		if frameCount%30 == 0 {
			elapsed := time.Since(lastLogTime).Milliseconds()
			fps := float64(30) / (float64(elapsed) / 1000.0)
			log.Printf("📹 [FRAME] Sent frame #%d at %d ms | FPS: %.1f", frameCount, frameTime, fps)
			lastLogTime = time.Now()
		}
	}

	cmd.Process.Kill()
	cmd.Wait()
	log.Println("Video stream stopped")
}
