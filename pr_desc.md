💡 **What:** The `migrateSamplePlatforms` function in `scripts/migrate-mock-to-firestore.ts` was optimized to fetch existing mock documents concurrently using `Promise.all()` instead of making sequential queries in a for-loop. Additionally, the instantiation of the `createdAt` and `updatedAt` timestamps (`new Date()`) was hoisted outside the loop.

🎯 **Why:**
- **N+1 Query Resolution:** A typical sequential pattern makes subsequent database requests wait on the previous ones to finish, resulting in unnecessary aggregate network and I/O latency.
- **CPU Savings & Data Consistency:** Hoisting `new Date()` outside of the loop avoids invoking the object initialization routine repeatedly, saving minimal but positive CPU cycles per iteration, and it guarantees that every document within the write batch receives the exact same timestamp string representing the operation boundary.

📊 **Measured Improvement:**
I established a benchmark that mocked the Firestore `get()` and `commit()` functions, introducing an artificial 50ms latency delay to simulate typical network conditions.

- **Baseline (Sequential):** ~302.46ms
- **Optimized (Concurrent):** ~101.53ms
- **Change over baseline:** Execution time was reduced by roughly **66%**, as it dropped the cumulative wait times into a single, combined latency window for the `.get()` fetches.
