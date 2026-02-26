package main

import (
	"fmt"
	"sync"
	"github.com/DomEscobar/erp-dev-bench/internal/store"
)

func main() {
	fmt.Println("🧪 SCIENTIST PHASE: Race Condition Reproduction (bench-concurrency-race)")
	s := store.NewItemStore()
	var wg sync.WaitGroup
	
	// Spawn 100 concurrent writers to trigger "fatal error: concurrent map writes"
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			s.Save(id, "data")
		}(i)
	}
	wg.Wait()
	fmt.Println("🔴 FAIL: Race detection failed (did not crash). Increase load or use -race.")
}
