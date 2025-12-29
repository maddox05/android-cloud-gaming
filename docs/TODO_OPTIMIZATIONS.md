# Remaining Optimizations

## Priority 2: WebRTC Backpressure
**File:** `worker/main.ts:61-68`

Video frames are sent without checking if the WebRTC buffer is full. If network is slow, frames silently drop with no feedback or recovery.

---

## Priority 3: SPS Parsing Not Cached
**File:** `frontend/src/utils/decoder.ts:127-212`

H.264 SPS (Sequence Parameter Set) is parsed on every keyframe. The result never changes but 100+ lines of bit-level parsing runs repeatedly.

---

## Priority 4: NAL Buffer Bloat
**File:** `frontend/src/utils/decoder.ts:37-62`

Every video frame triggers a linear scan of the entire buffer looking for NAL start codes. If decoding is slow, buffer grows and parsing gets progressively worse.

---

## Priority 5: Queue Matching is O(n×m)
**File:** `signal/queue.ts:56-86`

Every 5 seconds, the signal server iterates all queued clients × all workers. No indexing by game. Becomes slow with many clients/workers.
