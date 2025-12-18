package main

import (
	"fmt"
)


func main(){
	fmt.Println("This is a placeholder main function.")
	var name string = "nigger";

	for i := 0; i < len(name); i++ {
		fmt.Println(string(name[i]))
	}
	var year int = 2025
	var pointer_to_year *int = &year
	fmt.Println("Year:", year)

	fmt.Println("Pointer to Year:", pointer_to_year)

	fmt.Println("FIBB of 69: ", calc_fib(69))
}

var fib_results map[int]int = make(map[int]int)

  func calc_fib(number int) int {
      if number == 0 || number == 1 {
          return 1
      }

      // Check cache first
      if val, exists := fib_results[number]; exists {
          return val
      }

      // Calculate and store
      result := calc_fib(number-1) + calc_fib(number-2)
      fib_results[number] = result
      return result
  }
