# Smart Try-On — AI Service

The AI microservice for the Smart Try-On Shopping Platform.
Built with Python, Flask, OpenCV, and MediaPipe.

---

## Project Structure

```
AI-service/
├── main.py                  # Flask server entry point
├── requirements.txt         # Python dependencies
├── try_on/
│   ├── body_tracker.py      # MediaPipe pose detection (shoulders, torso)
│   ├── face_tracker.py      # MediaPipe face mesh detection (eyes, nose)
│   ├── shirt_overlay.py     # T-shirt placement & blending logic
│   └── glasses_overlay.py   # Glasses placement & blending logic
└── assets/
    ├── shirts/              # T-shirt PNG images (transparent background)
    └── glasses/             # Glasses PNG images (transparent background)
```

---

## Setup Instructions

### 1. Make sure Python 3.10+ is installed
```bash
python --version
```

### 2. Create a virtual environment
```bash
python -m venv venv
```

### 3. Activate the virtual environment
- **Windows:**
  ```bash
  venv\Scripts\activate
  ```
- **macOS / Linux:**
  ```bash
  source venv/bin/activate
  ```

### 4. Install dependencies
```bash
pip install -r requirements.txt
```

### 5. Download MediaPipe model files

The AI models are not included in the repo (too large for git). Download them once:

```bash
python download_models.py
```

This creates `face_landmarker.task` and `pose_landmarker.task` in the project root.

### 6. Run the server

```bash
python main.py
```

The service will start at: `http://localhost:5001`

---

## API Endpoints

| Method | Endpoint                        | Description                                        |
|--------|---------------------------------|----------------------------------------------------|
| GET    | `/health`                       | Health check — verify service is up                |
| POST   | `/try-on`                       | Overlay shirt or glasses on a video frame (2D PNG) |
| POST   | `/try-on/glasses/landmarks`     | Return face landmark coordinates for 3D rendering  |
| POST   | `/try-on/shirt/landmarks`       | Return body landmark coordinates for 3D rendering  |
| POST   | `/try-on/reset`                 | Reset smoothers when user switches products        |

### `/try-on` — 2D overlay (main endpoint)

Request:
```json
{
  "frame":     "data:image/jpeg;base64,...",
  "type":      "shirt | glasses",
  "asset_url": "https://yourcdn.com/shirts/blue.png"
}
```

Response:
```json
{
  "success":  true,
  "frame":    "data:image/jpeg;base64,...",
  "detected": true,
  "fps":      18.4
}
```

### `/try-on/glasses/landmarks` and `/try-on/shirt/landmarks` — 3D rendering

These lightweight endpoints skip image encoding entirely and return raw landmark
coordinates as JSON. Use these when the frontend renders with Three.js / WebGL
instead of a 2D PNG overlay.

Request:
```json
{ "frame": "data:image/jpeg;base64,..." }
```

Response (glasses):
```json
{
  "success":  true,
  "detected": true,
  "landmarks": {
    "left_eye": [423, 310], "right_eye": [198, 308],
    "nose_bridge": [312, 355],
    "left_face_edge": [521, 330], "right_face_edge": [105, 328],
    "left_arm_hinge": [498, 318], "left_ear_tip": [540, 340],
    "right_arm_hinge": [128, 316], "right_ear_tip": [86, 338]
  },
  "frame_width": 1280,
  "frame_height": 720,
  "fps": 28.4
}
```

Response (shirt) also includes a `measurements` object:
```json
{
  "measurements": {
    "shoulder_width":  312,
    "torso_height":    280,
    "torso_angle_deg": -2.4,
    "shoulder_mid":    [320, 210],
    "hip_mid":         [318, 490]
  }
}
```

### `/try-on/reset`

Call this when the user switches to a different product to clear smoother buffers.
Optionally pass `{ "clear_cache": true }` to also re-download cached assets.

---

## Integration with Frontend (Next.js)

The Next.js frontend communicates with this service via HTTP.
All endpoints support CORS so the frontend can call them directly during development.

For production, route requests through Next.js API routes (`/app/api/...`) to proxy to this service.

---

## Tech Stack

| Tool        | Purpose                          |
|-------------|----------------------------------|
| Python 3.10+| Core language                    |
| Flask       | HTTP API server                  |
| Flask-CORS  | Allow cross-origin requests      |
| OpenCV      | Video capture & image processing |
| MediaPipe   | Pose & face landmark detection   |
| NumPy       | Array/image math                 |
| Pillow      | PNG image handling (transparency)|
