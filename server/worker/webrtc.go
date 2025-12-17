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

	// Set up connection state handler to start streaming when connected
	peerConnection.OnICEConnectionStateChange(func(connectionState webrtc.ICEConnectionState) {
		log.Printf("📡 ICE Connection State: %s", connectionState.String())

		switch connectionState {
		case webrtc.ICEConnectionStateConnected:
			log.Println("🎉 ICE Connected! Starting video stream...")
			go s.streamTestVideo()
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
	log.Println("🎬 STREAMING TEST PATTERN - YOU SHOULD SEE A COLOR BAR PATTERN")

	cmd := exec.Command("ffmpeg",
		"-re",
		"-f", "lavfi",
		"-i", "testsrc=size=360x640:rate=20",
		"-pix_fmt", "yuv420p",
		"-c:v", "libx264",
		"-preset", "ultrafast",
		"-tune", "zerolatency",
		"-profile:v", "baseline",
		"-f", "h264",
		"pipe:1",
	)

	stdout, _ := cmd.StdoutPipe()
	cmd.Stderr = os.Stderr
	cmd.Start()

	h264Reader, err := h264reader.NewReader(stdout)
	if err != nil {
		log.Printf("h264reader error: %v", err)
		return
	}

	log.Println("📹 Sending test frames to browser...")
	count := 0
	for {
		nal, err := h264Reader.NextNAL()
		if err != nil {
			if err != io.EOF {
				log.Printf("NAL error: %v", err)
			}
			break
		}

		if s.videoTrack != nil {
			s.videoTrack.WriteSample(media.Sample{
				Data:     nal.Data,
				Duration: time.Millisecond * 50,
			})
			count++
			if count%100 == 0 {
				log.Printf("✓ Sent %d frames", count)
			}
		}
	}
}

func (s *WebRTCServer) streamVideo() {
	log.Println("Starting fast video stream to WebRTC...")

	// Optimized pipeline: adb -> ffmpeg with minimal latency
	cmd := exec.Command("bash", "-c",
		fmt.Sprintf(`adb -s localhost:%s exec-out screenrecord --bit-rate=2M --output-format=h264 --size=360x640 - | \
		ffmpeg -re -fflags nobuffer+fastseek -flags low_delay -probesize 32 -analyzeduration 0 \
		-i pipe:0 -c:v copy -bsf:v h264_mp4toannexb -f h264 pipe:1`, s.adbPort))

	cmd.Stderr = os.Stderr
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		log.Printf("Failed to create pipe: %v", err)
		return
	}

	log.Println("Starting streaming pipeline...")
	if err := cmd.Start(); err != nil {
		log.Printf("Failed to start command: %v", err)
		return
	}

	// Read and send raw H264 chunks directly - bypass h264reader
	log.Println("Streaming raw H264 chunks to WebRTC...")
	chunkSize := 1024 * 32 // 32KB chunks
	buffer := make([]byte, chunkSize)
	chunkCount := 0
	startTime := time.Now()

	for {
		n, err := stdout.Read(buffer)
		if err != nil {
			if err != io.EOF {
				log.Printf("Read error: %v", err)
			}
			break
		}

		if n == 0 {
			continue
		}

		if s.videoTrack == nil {
			break
		}

		// Send raw H264 chunk to WebRTC
		chunk := make([]byte, n)
		copy(chunk, buffer[:n])

		if err := s.videoTrack.WriteSample(media.Sample{
			Data:     chunk,
			Duration: time.Millisecond * 50,
		}); err != nil {
			log.Printf("Error sending chunk: %v", err)
			break
		}

		chunkCount++
		if chunkCount%20 == 0 {
			elapsed := time.Since(startTime).Seconds()
			bytesPerSec := float64(chunkCount*chunkSize) / elapsed / 1024
			log.Printf("Sent %d chunks (%.1f KB/s)", chunkCount, bytesPerSec)
		}
	}

	log.Printf("Stream stopped after %d chunks", chunkCount)
	cmd.Process.Kill()
	cmd.Wait()
}
