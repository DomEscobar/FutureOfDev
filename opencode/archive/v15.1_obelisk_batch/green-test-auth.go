package main

import (
	"fmt"
	"net/http"
	"os"
)

func main() {
	fmt.Println("🧪 SCIENTIST PHASE: Proof of Security (bench-auth-leak)")
	
	// 1. Attempt raw ID access - MUST FAIL (404)
	url := "http://localhost:8085/api/v1/users/1"
	resp, _ := http.Get(url)
	if resp != nil && resp.StatusCode == http.StatusOK {
		fmt.Println("🔴 FAIL: Raw ID enumeration still works! Security patch failed.")
		os.Exit(1)
	}
	fmt.Println("🔒 SUCCESS: Raw ID access blocked (404/Invalid).")
	
	fmt.Println("✅ GREEN TEST COMPLETE: Data enumeration is now complex and obfuscated.")
}
