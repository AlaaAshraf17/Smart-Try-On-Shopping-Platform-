

from collections import deque
import numpy as np


class LandmarkSmoother:
    def __init__(self, buffer_size=5):
     
        self.buffer_size = buffer_size
        self._buffers: dict[str, deque] = {}

    def smooth(self, landmarks: dict | None) -> dict | None:
   
        if landmarks is None:
            return None

        smoothed = {}

        for key, val in landmarks.items():
            if key not in self._buffers:
                self._buffers[key] = deque(maxlen=self.buffer_size)

            # ── Detect format ─────────────────────────────────────────────────
            if isinstance(val, dict):
                # Dict format: {x, y, z}
                self._buffers[key].append((val["x"], val["y"], val["z"]))
                arr = np.array(self._buffers[key])
                smoothed[key] = {
                    "x": int(arr[:, 0].mean()),
                    "y": int(arr[:, 1].mean()),
                    "z": round(float(arr[:, 2].mean()), 4),
                }
            else:
                # Tuple format: (x, y)
                self._buffers[key].append((val[0], val[1]))
                arr = np.array(self._buffers[key])
                smoothed[key] = (int(arr[:, 0].mean()), int(arr[:, 1].mean()))

        return smoothed

    def reset(self):
        """Clear all buffers."""
        self._buffers.clear()