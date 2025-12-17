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
	deviceWidth    int
	deviceHeight   int
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
	server := &WebRTCServer{
		port:    port,
		adbPort: adbPort,
	}
	server.getDeviceResolution()
	return server
}

func (s *WebRTCServer) getDeviceResolution() {
	// Get device resolution using adb shell wm size
	cmd := exec.Command("adb", "shell", "wm", "size")
	output, err := cmd.Output()
	if err != nil {
		log.Printf("⚠️  Failed to get device resolution, using defaults (1080x1920): %v", err)
		s.deviceWidth = 1080
		s.deviceHeight = 1920
		return
	}

	// Parse output like "Physical size: 1080x2400"
	outputStr := string(output)
	var width, height int
	if _, err := fmt.Sscanf(outputStr, "Physical size: %dx%d", &width, &height); err != nil {
		// Try alternative format "Override size: 1080x2400"
		if _, err := fmt.Sscanf(outputStr, "Override size: %dx%d", &width, &height); err != nil {
			log.Printf("⚠️  Failed to parse device resolution: %s, using defaults", outputStr)
			s.deviceWidth = 1080
			s.deviceHeight = 1920
			return
		}
	}

	s.deviceWidth = width
	s.deviceHeight = height
	log.Printf("📱 Device resolution: %dx%d", s.deviceWidth, s.deviceHeight)
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

	// Handle incoming data channel from client
	peerConnection.OnDataChannel(func(dc *webrtc.DataChannel) {
		log.Printf("🎮 Data channel received from client: %s", dc.Label())
		s.dataChannel = dc

		// Set up data channel event handlers
		dc.OnOpen(func() {
			log.Printf("🎉 Data channel opened - ready to receive input events")
		})

		dc.OnClose(func() {
			log.Printf("🔒 Data channel closed")
		})

		dc.OnMessage(func(msg webrtc.DataChannelMessage) {
			s.handleInputEvent(msg.Data)
		})

		dc.OnError(func(err error) {
			log.Printf("❌ Data channel error: %v", err)
		})
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

	latency := receiveTime - event.Timestamp
	log.Printf("🎮 [INPUT] Received | Type: %s | Latency: %d ms", event.Type, latency)

	// Execute ADB command in goroutine (non-blocking)
	go func() {
		startExec := time.Now().UnixMilli()
		if err := s.executeADBInput(event); err != nil {
			log.Printf("❌ [INPUT] Failed: %v", err)
			return
		}
		execDuration := time.Now().UnixMilli() - startExec
		log.Printf("✓ [INPUT] Executed %s in %d ms", event.Type, execDuration)
	}()
}

func (s *WebRTCServer) executeADBInput(event InputEvent) error {
	var cmd *exec.Cmd

	// Scale coordinates from frontend (assumes 1080x1920) to actual device resolution
	scaleX := float64(s.deviceWidth) / 1080.0
	scaleY := float64(s.deviceHeight) / 1920.0

	switch event.Type {
	case "tap":
		actualX := int(float64(event.X) * scaleX)
		actualY := int(float64(event.Y) * scaleY)
		cmd = exec.Command("adb", "shell", "input", "tap",
			fmt.Sprintf("%d", actualX), fmt.Sprintf("%d", actualY))
		log.Printf("🎯 [ADB] input tap %d %d (scaled from %d %d)", actualX, actualY, event.X, event.Y)

	case "swipe":
		duration := event.Duration
		if duration == 0 {
			duration = 300 // default 300ms
		}
		actualX1 := int(float64(event.X) * scaleX)
		actualY1 := int(float64(event.Y) * scaleY)
		actualX2 := int(float64(event.X2) * scaleX)
		actualY2 := int(float64(event.Y2) * scaleY)
		cmd = exec.Command("adb", "shell", "input", "swipe",
			fmt.Sprintf("%d", actualX1), fmt.Sprintf("%d", actualY1),
			fmt.Sprintf("%d", actualX2), fmt.Sprintf("%d", actualY2),
			fmt.Sprintf("%d", duration))
		log.Printf("👆 [ADB] input swipe %d %d %d %d %d (scaled)",
			actualX1, actualY1, actualX2, actualY2, duration)

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
		log.Printf("❌ ADB command failed: %v", err)
		log.Printf("   Command output: %s", string(output))
		return fmt.Errorf("ADB command failed: %v, output: %s", err, output)
	}

	if len(output) > 0 {
		log.Printf("   ADB output: %s", string(output))
	}

	return nil
}

func (s *WebRTCServer) streamVideo() {
	log.Println("🎬 Starting adb screenrecord → WebRTC stream")

	cmd := exec.Command(
		"adb",
		"shell",
		"screenrecord",
		"--output-format=h264",
		"--bit-rate", "8000000",
		"-",
	)

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		log.Printf("❌ stdout pipe error: %v", err)
		return
	}
	cmd.Stderr = os.Stderr

	if err := cmd.Start(); err != nil {
		log.Printf("❌ failed to start adb screenrecord: %v", err)
		return
	}

	reader, err := h264reader.NewReader(stdout)
	if err != nil {
		log.Printf("❌ h264 reader error: %v", err)
		return
	}

	log.Println("📹 Streaming frames...")

	nalCount := 0
	for {
		nal, err := reader.NextNAL()
		if err != nil {
			if err != io.EOF {
				log.Printf("NAL read error: %v", err)
			}
			break
		}

		if s.videoTrack == nil {
			break
		}

		s.videoTrack.WriteSample(media.Sample{
			Data:     nal.Data,
			Duration: time.Millisecond,
		})

		nalCount++
		if nalCount%100 == 0 {
			log.Printf("📹 [FRAME] %d frames sent", nalCount)
		}
	}

	cmd.Process.Kill()
	cmd.Wait()
	log.Printf("📹 Stream ended (%d frames sent)", nalCount)
}
