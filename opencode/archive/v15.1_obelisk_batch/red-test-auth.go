package main

import (
	"fmt"
	"net/http"
	"os"
)

func main() {
	fmt.Println("🧪 SCIENTIST PHASE: Proof of ID Enumeration (bench-auth-leak)")
	
	// Test IDs 1 and 2. If both return 200 with predictable patterns, vulnerability is proven.
	for i := 1; i <= 2; i++ {
		url := fmt.Sprintf("http://localhost:8084/api/v1/users/%d", i)
		resp, err := http.Get(url)
		if err != nil || resp.StatusCode != http.StatusOK {
			fmt.Printf("🔴 FAIL: Could not access ID %d\n", i)
			os.Exit(1)
		}
		fmt.Printf("🔓 SUCCESS: Predictable access to User ID %d confirmed.\n", i)
	}
	
	fmt.Println("✅ RED TEST COMPLETE: Vulnerability to ID Enumeration proven.")
}
