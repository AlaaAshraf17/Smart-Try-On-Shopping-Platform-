"""
Landmark Smoother — Fix 1
Keeps a rolling buffer of the last N frames of landmark positions
and returns the average. Eliminates jitter from raw MediaPipe output.

Used by both body and face trackers.
"""

from collections import deque
import numpy as np


class LandmarkSmoother:
    def __init__(self, buffer_size=5):
        """
        buffer_size → how many past frames to average.
        5 = smooth but still responsive to real movement.
        Higher = smoother but more lag when moving fast.
        """
        self.buffer_size = buffer_size
        # One deque per landmark key, created on first use
        self._buffers: dict[str, deque] = {}

    def smooth(self, landmarks: dict | None) -> dict | None:
        """
        Accept a landmarks dict like:
          {"left_shoulder": (x, y), "right_shoulder": (x, y), ...}

        Returns the same dict but with each point averaged across
        the last buffer_size frames. Returns None if input is None.

        On the first few frames the buffer isn't full yet — we average
        whatever we have so the shirt appears immediately without waiting.
        """
        if landmarks is None:
            # Don't clear the buffer — person may just be briefly occluded.
            # Return None so the caller knows nothing was detected.
            return None

        smoothed = {}
        for key, (x, y) in landmarks.items():
            if key not in self._buffers:
                self._buffers[key] = deque(maxlen=self.buffer_size)

            self._buffers[key].append((x, y))

            # Average all stored positions for this landmark
            arr = np.array(self._buffers[key])
            smoothed[key] = (int(arr[:, 0].mean()), int(arr[:, 1].mean()))

        return smoothed

    def reset(self):
        """Clear all buffers — call this if the person leaves the frame."""
        self._buffers.clear()