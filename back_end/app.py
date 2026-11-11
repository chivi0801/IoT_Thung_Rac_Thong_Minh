# -*- coding: utf-8 -*-
"""API nhan 5 frame tu ESP32-S3 va phan loai bang YOLO local."""
from collections import Counter, defaultdict
from datetime import datetime
import json
import os
from pathlib import Path
import re
import threading
from time import perf_counter, time
from urllib.error import HTTPError, URLError
from urllib.request import urlopen

import cv2
import numpy as np
import torch
from flask import Flask, jsonify, request, send_from_directory
from ultralytics import YOLO

BACKEND_DIR = Path(__file__).resolve().parent
BASE_DIR = BACKEND_DIR.parent
FRONTEND_DIR = BASE_DIR / "front_end"
MODEL_PATH = BACKEND_DIR / "model" / "best.pt"
ALLOWED_CLASSES = {0, 6, 15}
EXPECTED_MODEL_CLASSES = {
    0: "aluminumCan_awss",
    6: "bottle_awss",
    15: "paperCup_awss",
}
CONFIDENCE_THRESHOLD = 0.4
MAX_IMAGES = 5
UPLOAD_DIR = BACKEND_DIR / "uploads"
ESP32_BINS_URL = os.environ.get("ESP32_BINS_URL", "http://192.168.1.31/bins")
ESP32_SERVO_URL = os.environ.get("ESP32_SERVO_URL", "http://192.168.1.31/servo")
INFERENCE_DEVICE = 0 if torch.cuda.is_available() else "cpu"

# Mapping theo logic servo trong ESP32_S3/code.cpp
CLASS_TO_SERVO = {
    0: ("can", 180),
    6: ("bottle", 90),
    15: ("paper cup", 0),
}

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 20 * 1024 * 1024
_model = None
_model_lock = threading.Lock()
SERVER_STARTED_AT = time()


def get_model():
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                if not MODEL_PATH.is_file():
                    raise FileNotFoundError(f"Khong tim thay model: {MODEL_PATH}")
                model = YOLO(str(MODEL_PATH))
                model_names = model.names
                mismatches = {
                    class_id: {
                        "expected": expected_name,
                        "found": model_names.get(class_id) if isinstance(model_names, dict)
                        else model_names[class_id] if class_id < len(model_names) else None,
                    }
                    for class_id, expected_name in EXPECTED_MODEL_CLASSES.items()
                    if (
                        model_names.get(class_id) if isinstance(model_names, dict)
                        else model_names[class_id] if class_id < len(model_names) else None
                    ) != expected_name
                }
                if mismatches:
                    raise ValueError(
                        f"Class IDs trong model khong khop mapping can/bottle/paper cup: {mismatches}"
                    )
                _model = model
    return _model


def save_and_decode_images(files):
    batch_dir = UPLOAD_DIR / datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    batch_dir.mkdir(parents=True, exist_ok=True)
    images = []
    saved_paths = []
    for index, upload in enumerate(files, start=1):
        raw = upload.read()
        if not raw:
            continue
        path = batch_dir / f"frame_{index:02d}.jpg"
        path.write_bytes(raw)
        image = cv2.imdecode(np.frombuffer(raw, dtype=np.uint8), cv2.IMREAD_COLOR)
        if image is not None:
            images.append(image)
            saved_paths.append(path)
        else:
            path.unlink(missing_ok=True)
    return images, saved_paths, batch_dir


def save_prediction(batch_dir, payload, started_at):
    payload["total_processing_seconds"] = round(perf_counter() - started_at, 3)
    (batch_dir / "prediction.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def save_annotated_images(results, frame_results, winning_class, batch_dir):
    for index, result in enumerate(results):
        annotated = result.plot()
        voted_class = frame_results[index]
        if voted_class is None:
            vote_text = "Frame vote: none"
        else:
            vote_text = f"Frame vote: {CLASS_TO_SERVO[voted_class][0]}"
        if winning_class is not None:
            vote_text += f" | Batch vote: {CLASS_TO_SERVO[winning_class][0]}"
        cv2.putText(
            annotated,
            vote_text,
            (10, 28),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (0, 255, 255),
            2,
            cv2.LINE_AA,
        )
        cv2.imwrite(str(batch_dir / f"annotated_{index + 1:02d}.jpg"), annotated)


def select_best_frame(frame_results, frame_confidences):
    """Pick the highest-confidence detected frame in the full batch."""
    candidates = [
        index for index, class_id in enumerate(frame_results)
        if class_id is not None and frame_confidences[index] is not None
    ]
    return max(candidates, key=lambda index: frame_confidences[index]) if candidates else 0


@app.get("/health")
def health():
    return jsonify({"status": "ok", "model": str(MODEL_PATH.name)})


@app.get("/api/health")
def api_health():
    return jsonify({
        "status": "ok",
        "model": str(MODEL_PATH.name),
        "model_loaded": _model is not None,
        "inference_device": INFERENCE_DEVICE,
        "cuda_available": torch.cuda.is_available(),
        "esp32_bins_url": ESP32_BINS_URL,
    })


@app.get("/api/bins")
def bins():
    """Proxy the ESP32 sensor endpoint for same-origin frontend requests."""
    try:
        with urlopen(ESP32_BINS_URL, timeout=3) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        return jsonify({"success": False, "error": f"ESP32 returned HTTP {exc.code}"}), 502
    except (URLError, TimeoutError, OSError, json.JSONDecodeError) as exc:
        return jsonify({"success": False, "error": f"Cannot read ESP32 /bins: {exc}"}), 503

    if not isinstance(payload, dict) or not isinstance(payload.get("bins"), list):
        return jsonify({"success": False, "error": "ESP32 /bins returned an invalid response"}), 502
    return jsonify(payload)


@app.post("/api/servo")
def control_servo():
    """Validate a servo command and proxy it to the ESP32."""
    payload = request.get_json(silent=True) or {}
    try:
        servo = int(payload.get("servo"))
        angle = int(payload.get("angle"))
    except (TypeError, ValueError):
        return jsonify({"success": False, "error": "servo and angle must be integers"}), 400
    if servo not in (1, 2) or not 0 <= angle <= 180:
        return jsonify({"success": False, "error": "servo must be 1 or 2 and angle must be between 0 and 180"}), 400

    separator = "&" if "?" in ESP32_SERVO_URL else "?"
    url = f"{ESP32_SERVO_URL}{separator}servo={servo}&angle={angle}"
    try:
        with urlopen(url, timeout=4) as response:
            response_text = response.read().decode("utf-8", errors="replace")
    except HTTPError as exc:
        return jsonify({"success": False, "error": f"ESP32 returned HTTP {exc.code}"}), 502
    except (URLError, TimeoutError, OSError) as exc:
        return jsonify({"success": False, "error": f"Cannot reach ESP32 servo endpoint: {exc}"}), 503
    return jsonify({"success": True, "servo": servo, "angle": angle, "esp32_response": response_text})


@app.get("/api/latest")
def latest_prediction():
    """Return the newest completed ESP32 image batch and its display URLs."""
    if not UPLOAD_DIR.exists():
        return jsonify({"status": "waiting", "message": "Waiting for ESP32 images."})

    batches = [
        path for path in UPLOAD_DIR.iterdir()
        if path.is_dir()
        and (path / "prediction.json").is_file()
        and (path / "prediction.json").stat().st_mtime >= SERVER_STARTED_AT
    ]
    if not batches:
        return jsonify({"status": "waiting", "message": "Waiting for ESP32 images."})

    batch_dir = max(batches, key=lambda path: (path / "prediction.json").stat().st_mtime_ns)
    prediction_file = batch_dir / "prediction.json"
    try:
        payload = json.loads(prediction_file.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return jsonify({"status": "error", "message": f"Could not read latest result: {exc}"}), 500

    images = []
    for index in range(1, MAX_IMAGES + 1):
        original_name = f"frame_{index:02d}.jpg"
        annotated_name = f"annotated_{index:02d}.jpg"
        original = f"/api/batches/{batch_dir.name}/{original_name}" if (batch_dir / original_name).is_file() else None
        annotated = f"/api/batches/{batch_dir.name}/{annotated_name}" if (batch_dir / annotated_name).is_file() else None
        if original or annotated:
            confidence_values = payload.get("frame_confidences", [])
            class_values = payload.get("frame_classes", [])
            images.append({
                "index": index,
                "confidence": confidence_values[index - 1] if index <= len(confidence_values) else None,
                "class_name": class_values[index - 1] if index <= len(class_values) else None,
                "original_url": original,
                "annotated_url": annotated,
            })

    best_index = payload.get("best_frame_index", 1)
    best_image = next((item for item in images if item["index"] == best_index), None)
    if best_image is None and images:
        best_image = max(images, key=lambda item: item["confidence"] or 0)

    payload["status"] = "complete"
    payload["batch_id"] = batch_dir.name
    payload["received_at"] = datetime.fromtimestamp(prediction_file.stat().st_mtime).astimezone().isoformat(timespec="seconds")
    payload["images"] = images
    payload["best_image"] = best_image
    return jsonify(payload)


@app.get("/api/batches/<batch_id>/<filename>")
def batch_image(batch_id: str, filename: str):
    if not re.fullmatch(r"\d{8}_\d{6}_\d{6}", batch_id):
        return jsonify({"error": "Invalid batch ID"}), 404
    if not re.fullmatch(r"(?:frame|annotated)_\d{2}\.jpg", filename):
        return jsonify({"error": "Invalid image name"}), 404
    batch_dir = UPLOAD_DIR / batch_id
    return send_from_directory(batch_dir, filename)


@app.get("/")
def frontend_index():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.get("/<path:asset_path>")
def frontend_asset(asset_path: str):
    return send_from_directory(FRONTEND_DIR, asset_path)


@app.post("/predict")
def predict():
    started_at = perf_counter()
    uploads = request.files.getlist("images")
    if not uploads:
        return jsonify({"success": False, "error": "No images received; use multipart field 'images'."}), 400
    if len(uploads) > MAX_IMAGES:
        return jsonify({"success": False, "error": f"At most {MAX_IMAGES} images are accepted."}), 400

    images, saved_paths, batch_dir = save_and_decode_images(uploads)
    if not images:
        return jsonify({"success": False, "error": "Could not decode uploaded JPEG images."}), 400

    try:
        model = get_model()
        # One local inference batch for all captured frames.
        results = model.predict(
            source=images,
            device=INFERENCE_DEVICE,
            classes=sorted(ALLOWED_CLASSES),
            conf=CONFIDENCE_THRESHOLD,
            verbose=False,
        )
        inference_device = str(getattr(getattr(model.predictor, "device", None), "type", "unknown"))
    except Exception as exc:
        app.logger.exception("YOLO inference failed")
        payload = {
            "success": False,
            "error": str(exc),
            "frames_received": len(images),
            "saved_images": [str(path.relative_to(BASE_DIR)) for path in saved_paths],
        }
        save_prediction(batch_dir, payload, started_at)
        return jsonify(payload), 500

    # Each frame gives at most one vote: its highest-confidence detection.
    # This prevents a frame with many boxes from dominating the decision.
    votes = Counter()
    confidences = defaultdict(list)
    frame_results = []
    frame_confidences = []
    for result in results:
        best_by_class = {}
        for box in result.boxes:
            class_id = int(box.cls[0].item())
            confidence = float(box.conf[0].item())
            if class_id in ALLOWED_CLASSES:
                best_by_class[class_id] = max(best_by_class.get(class_id, 0.0), confidence)
        if not best_by_class:
            frame_results.append(None)
            frame_confidences.append(None)
            continue
        winner = max(best_by_class, key=best_by_class.get)
        winner_confidence = best_by_class[winner]
        votes[winner] += 1
        confidences[winner].append(winner_confidence)
        frame_results.append(winner)
        frame_confidences.append(round(winner_confidence, 4))

    if not votes:
        save_annotated_images(results, frame_results, None, batch_dir)
        payload = {
            "success": False,
            "error": "No allowed class detected above confidence threshold.",
            "frames_received": len(images),
            "inference_device": inference_device,
            "votes": {},
            "best_frame_index": select_best_frame(frame_results, frame_confidences) + 1,
            "frame_confidences": frame_confidences,
            "frame_classes": [None] * len(frame_results),
            "saved_images": [str(path.relative_to(BASE_DIR)) for path in saved_paths],
        }
        save_prediction(batch_dir, payload, started_at)
        return jsonify(payload), 200

    # Majority vote; ties are resolved by mean confidence.
    winning_class = max(
        votes,
        key=lambda class_id: (votes[class_id], sum(confidences[class_id]) / len(confidences[class_id])),
    )
    class_name, servo_angle = CLASS_TO_SERVO[winning_class]
    mean_confidence = sum(confidences[winning_class]) / len(confidences[winning_class])
    required_votes = len(images) // 2 + 1
    if votes[winning_class] < required_votes:
        save_annotated_images(results, frame_results, winning_class, batch_dir)
        payload = {
            "success": False,
            "error": "Frames did not reach a majority agreement; keep the flap closed and retry.",
            "frames_received": len(images),
            "inference_device": inference_device,
            "votes": {CLASS_TO_SERVO[k][0]: v for k, v in votes.items()},
            "frame_classes": [CLASS_TO_SERVO[k][0] if k is not None else None for k in frame_results],
            "frame_confidences": frame_confidences,
            "best_frame_index": select_best_frame(frame_results, frame_confidences) + 1,
            "saved_images": [str(path.relative_to(BASE_DIR)) for path in saved_paths],
        }
        save_prediction(batch_dir, payload, started_at)
        return jsonify(payload), 200

    save_annotated_images(results, frame_results, winning_class, batch_dir)
    payload = {
        "success": True,
        "class_name": class_name,
        "class_id": winning_class,
        "servo_angle": servo_angle,
        "confidence": round(mean_confidence, 4),
        "votes": {CLASS_TO_SERVO[k][0]: v for k, v in votes.items()},
        "frames_received": len(images),
        "inference_device": inference_device,
        "frame_classes": [CLASS_TO_SERVO[k][0] if k is not None else None for k in frame_results],
        "frame_confidences": frame_confidences,
        "best_frame_index": select_best_frame(frame_results, frame_confidences) + 1,
        "saved_images": [str(path.relative_to(BASE_DIR)) for path in saved_paths],
    }
    save_prediction(batch_dir, payload, started_at)
    return jsonify(payload)


if __name__ == "__main__":
    # Bind to LAN for ESP32 uploads and frontend access from other devices.
    app.run(host="0.0.0.0", port=5000, threaded=True)
