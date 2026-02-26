package main

import (
	"log"
	"net/http"
	"time"
)

func main() {
	// Let the server start
	time.Sleep(2 * time.Second)

	// Max Int32 is 2,147,483,647
	// We send 3,000,000,000
	overflowID := "3000000000"

	client := &http.Client{Timeout: 5 * time.Second}
	req, _ := http.NewRequest("GET", "http://localhost:8083/health", nil)
	req.Header.Set("X-Request-ID", overflowID)

	log.Printf("🧪 SCIENTIST PHASE: Sending overflow request_id: %s", overflowID)
	resp, err := client.Do(req)
	if err != nil {
		log.Fatalf("❌ CRASH REPRODUCED: Server failed to respond: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Fatalf("❌ BUG CONFIRMED: Expected 200 OK, got %d", resp.StatusCode)
	}

	log.Printf("✅ Request completed, but did it overflow? (Check server logs)")
}
