package main

import (
	"fmt"
	"os"

	"github.com/DomEscobar/erp-dev-bench/internal/models"
	"github.com/DomEscobar/erp-dev-bench/internal/store"
)

func main() {
	fmt.Println("🧪 SCIENTIST PHASE: Green Test (bench-refactor-001)")
	
	// Proof of Decoupling: We can use the store WITHOUT the server/gin.
	s := store.NewInMemStore()
	
	item := &models.Item{
		Name: "Test Item",
		Description: "Proven to be decoupled",
	}
	
	err := s.Create(item)
	if err != nil {
		fmt.Printf("🔴 FAIL: Could not create item: %v\n", err)
		os.Exit(1)
	}
	
	if item.ID != 1 {
		fmt.Printf("🔴 FAIL: ID assignment failed, got %d\n", item.ID)
		os.Exit(1)
	}
	
	retrieved, ok := s.Get(1)
	if !ok || retrieved.Name != "Test Item" {
		fmt.Println("🔴 FAIL: Retrieval failed or data corruption")
		os.Exit(1)
	}

	fmt.Println("🟢 GREEN TEST COMPLETE: Decoupled Store is functional and independent.")
	os.Exit(0)
}
