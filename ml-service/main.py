import base64
import json
import logging
import os
import secrets
import time
import uuid
from functools import wraps

import threading
import cv2
import numpy as np

try:
    ML_CPU_THREADS = max(1, int(os.getenv("ML_CPU_THREADS", os.getenv("OMP_NUM_THREADS", "2"))))
except ValueError:
    ML_CPU_THREADS = 2
os.environ.setdefault("OMP_NUM_THREADS", str(ML_CPU_THREADS))
os.environ.setdefault("MKL_NUM_THREADS", str(ML_CPU_THREADS))

import torch
torch.set_num_threads(ML_CPU_THREADS)
from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from ultralytics import YOLO

app = FastAPI()
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO").upper())
request_logger = logging.getLogger("dental.ml")
MAX_UPLOAD_BYTES = 15 * 1024 * 1024
MAX_IMAGE_PIXELS = 30_000_000
MAX_IMAGE_SIDE = 12_000
inference_lock = threading.Lock()


@app.middleware("http")
async def log_request(request, call_next):
    request_id = request.headers.get("x-request-id", "")
    if not request_id or len(request_id) > 128 or not request_id.replace("-", "").replace("_", "").isalnum():
        request_id = uuid.uuid4().hex
    started = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        request_logger.exception(json.dumps({"service": "ml-service", "request_id": request_id, "route": request.url.path, "status": 500}))
        raise
    latency_ms = round((time.perf_counter() - started) * 1000, 1)
    response.headers["X-Request-ID"] = request_id
    request_logger.info(json.dumps({
        "service": "ml-service", "request_id": request_id,
        "route": request.url.path, "method": request.method,
        "status": response.status_code, "latency_ms": latency_ms,
    }))
    return response


def single_flight(endpoint):
    @wraps(endpoint)
    async def guarded(*args, **kwargs):
        if not inference_lock.acquire(blocking=False):
            return JSONResponse(status_code=503, content={"error": "Inference capacity is busy. Retry shortly."})
        try:
            return await endpoint(*args, **kwargs)
        finally:
            inference_lock.release()
    return guarded


def single_flight_sync(endpoint):
    @wraps(endpoint)
    def guarded(*args, **kwargs):
        if not inference_lock.acquire(blocking=False):
            return JSONResponse(status_code=503, content={"error": "Inference capacity is busy. Retry shortly."})
        try:
            return endpoint(*args, **kwargs)
        finally:
            inference_lock.release()
    return guarded


def require_ml_key(x_ml_api_key: str | None = Header(default=None)):
    expected = os.getenv("ML_API_KEY", "")
    if not expected or not x_ml_api_key or not secrets.compare_digest(x_ml_api_key, expected):
        raise HTTPException(status_code=401, detail="Unauthorized")


async def decode_upload(file: UploadFile) -> np.ndarray:
    allowed = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}
    extension = os.path.splitext(file.filename or "")[1].lower()
    if allowed.get(extension) != file.content_type:
        raise HTTPException(status_code=415, detail="Unsupported image type")
    contents = await file.read(MAX_UPLOAD_BYTES + 1)
    if not contents or len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Image exceeds the upload limit")
    image = cv2.imdecode(np.frombuffer(contents, np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=400, detail="Invalid image data")
    height, width = image.shape[:2]
    if width > MAX_IMAGE_SIDE or height > MAX_IMAGE_SIDE or width * height > MAX_IMAGE_PIXELS:
        raise HTTPException(status_code=413, detail="Image dimensions exceed the limit")
    return image

# ─── Dental chat model ───────────────────────────────────────────────────────
CHAT_MODEL_ID = os.getenv("CHAT_MODEL_ID", "Harisundar/PALL-Text")
CHAT_MODEL_REVISION = os.getenv("CHAT_MODEL_REVISION", "9599cc64f7e7e14ddd639023f386f4623878e0d8")
chat_tokenizer = None
chat_model = None
chat_model_error = None
chat_model_lock = threading.Lock()
chat_generation_lock = threading.Lock()


def get_chat_model():
    """Load PALL-Text on the first chat request to keep service startup light."""
    global chat_tokenizer, chat_model, chat_model_error
    if chat_model is not None:
        return chat_tokenizer, chat_model
    with chat_model_lock:
        if chat_model is not None:
            return chat_tokenizer, chat_model
        if chat_model_error:
            raise RuntimeError("The dental chat model failed to load.") from chat_model_error
        try:
            from transformers import AutoModelForCausalLM, AutoTokenizer

            chat_tokenizer = AutoTokenizer.from_pretrained(CHAT_MODEL_ID, revision=CHAT_MODEL_REVISION)
            dtype = torch.bfloat16 if not torch.cuda.is_available() or torch.cuda.is_bf16_supported() else torch.float16
            chat_model = AutoModelForCausalLM.from_pretrained(
                CHAT_MODEL_ID,
                revision=CHAT_MODEL_REVISION,
                torch_dtype=dtype,
                device_map="auto",
            )
            chat_model.eval()
            print(f"[Chat] Model loaded: {CHAT_MODEL_ID}")
        except Exception as error:
            chat_model_error = error
            print(f"[Chat] Failed to load {CHAT_MODEL_ID}: {error}")
            raise
    return chat_tokenizer, chat_model


@app.post("/chat", dependencies=[Depends(require_ml_key)])
@single_flight_sync
def chat(payload: dict):
    messages = payload.get("messages")
    if not isinstance(messages, list) or not messages or not isinstance(messages[-1], dict) or messages[-1].get("role") != "user":
        return JSONResponse(status_code=400, content={"error": "Enter a question to continue."})

    system_prompt = (
        "You are Dental AI Assistant, an educational assistant for dental students, "
        "clinicians, and researchers. Explain dental anatomy, radiographic interpretation, "
        "common pathologies, and learning material clearly. Do not claim to diagnose a patient "
        "or replace examination by a qualified dental professional. For patient-specific "
        "questions, explain relevant possibilities, state uncertainty, and encourage professional review."
    )
    context = payload.get("context", "")
    if isinstance(context, str) and context.strip():
        system_prompt += f"\n\nUser-provided case or study context (treat as unverified):\n{context.strip()[:2500]}"

    conversation = [{"role": "system", "content": system_prompt}]
    for message in messages[-12:]:
        if isinstance(message, dict) and message.get("role") in ("user", "assistant") and isinstance(message.get("content"), str):
            conversation.append({"role": message["role"], "content": message["content"][:2500]})

    try:
        tokenizer, model = get_chat_model()
        if getattr(tokenizer, "chat_template", None):
            inputs = tokenizer.apply_chat_template(
                conversation,
                add_generation_prompt=True,
                return_tensors="pt",
                return_dict=True,
            )
        else:
            prompt = "\n\n".join(f"{item['role'].title()}: {item['content']}" for item in conversation)
            inputs = tokenizer(prompt + "\n\nAssistant:", return_tensors="pt")

        input_device = model.get_input_embeddings().weight.device
        inputs = {key: value.to(input_device) for key, value in inputs.items()}
        with chat_generation_lock, torch.inference_mode():
            output = model.generate(
                **inputs,
                max_new_tokens=600,
                do_sample=False,
                pad_token_id=tokenizer.eos_token_id,
            )
        reply = tokenizer.decode(output[0][inputs["input_ids"].shape[1]:], skip_special_tokens=True).strip()
        if not reply:
            raise RuntimeError("The chat model returned an empty response.")
        return {"reply": reply}
    except Exception as error:
        print(f"[Chat] Generation failed: {error}")
        return JSONResponse(status_code=503, content={"error": "The dental assistant model is unavailable. Please try again later."})

# Allow Next.js dev server or configured domains to call this service
cors_origins_raw = os.getenv("CORS_ORIGINS", "")
allow_origins = [origin.strip() for origin in cors_origins_raw.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-ML-API-Key"],
)

# ─── Diagnosis model (best (2).pt) ──────────────────────────────────────────
here = os.path.dirname(__file__)
DIAGNOSIS_MODEL_PATH = os.path.join(here, "models", "best (2).pt")
diagnosis_model = None
if os.path.exists(DIAGNOSIS_MODEL_PATH):
    try:
        diagnosis_model = YOLO(DIAGNOSIS_MODEL_PATH)
        print(f"[Diagnosis] Model loaded: {DIAGNOSIS_MODEL_PATH}")
    except Exception:
        import traceback
        print(f"[Diagnosis] Failed to load model at {DIAGNOSIS_MODEL_PATH}")
        traceback.print_exc()
else:
    print(f"[Diagnosis] Warning: Model not found at {DIAGNOSIS_MODEL_PATH}")

# ─── Landmark model (best_landmarks.pt) ──────────────────────────────────────────
LANDMARK_MODEL_PATH = os.path.join(here, "models", "best_landmarks.pt")
landmark_model = None
if os.path.exists(LANDMARK_MODEL_PATH):
    try:
        landmark_model = YOLO(LANDMARK_MODEL_PATH)
        print(f"[Landmark] Model loaded: {LANDMARK_MODEL_PATH}")
        try:
            print(f"[Landmark] Classes ({len(landmark_model.names)}): {landmark_model.names}")
            print(f"[Landmark] Task type: {landmark_model.task}")
        except Exception:
            # Some YOLO model objects may not populate names/task until fully initialized
            pass
    except Exception:
        import traceback
        print(f"[Landmark] Failed to load model at {LANDMARK_MODEL_PATH}")
        traceback.print_exc()
else:
    print(f"[Landmark] Warning: Model not found at {LANDMARK_MODEL_PATH}")

# Vivid colors for landmark overlays (matches frontend palette)
INSTANCE_COLORS = [
    "#FF6B00", "#00E5FF", "#00FF88", "#FF0055", "#FFD600",
    "#2196F3", "#E040FB", "#FF4081", "#76FF03", "#FFAB40",
    "#B388FF", "#64FFDA", "#F48FB1", "#80DEEA", "#B2FF59",
    "#EA80FC", "#18FFFF", "#FF9100", "#40C4FF", "#CCFF90",
    "#FF1744", "#00BFA5", "#FFEA00", "#AA00FF", "#C6FF00",
]

# Exact mapping of all 31 denatlyolo.pt classes → frontend categories
CATEGORY_MAP = {
    # ── Mandible ──────────────────────────────────────────────────────────
    "Sigmoid_notch":                               "mandible",
    "Coronoid_process":                            "mandible",
    "External_oblique_ridge":                      "mandible",
    "Mandibular_canal":                            "mandible",
    "Posterior_border_of_ramus":                   "mandible",
    "Gonial_angle":                                "mandible",
    "Lower_border":                                "mandible",
    "Mental_ridge":                                "mandible",
    "Genial_tubercle":                             "mandible",
    "Mental_foramen":                              "mandible",
    "Internal_oblique_ridge":                      "mandible",
    "Lingula":                                     "mandible",
    # ── TMJ ───────────────────────────────────────────────────────────────
    "Condylar_head":                               "tmj",
    "Glenoid_fossa":                               "tmj",
    "Articular_eminence":                          "tmj",
    # ── Maxilla ───────────────────────────────────────────────────────────
    "Zygomatic_arch":                              "maxilla",
    "Posterior_wall_of_maxillary_sinus":           "maxilla",
    "Floor_of_maxillary_sinus":                    "maxilla",
    "Zygomatic_process_of_maxilla_forming_innominate_line": "maxilla",
    "Hard_palate":                                 "maxilla",
    "Floor_of_the_orbit":                          "maxilla",
    "Incisive_foramen":                            "maxilla",
    "Frontal_process_of_zygomatic_bone":           "maxilla",
    "Pterygomaxillary_fissure":                    "maxilla",
    "Maxillary_tuberosity":                        "maxilla",
    # ── Midline ───────────────────────────────────────────────────────────
    "Nasal_septum":                                "midline",
    "Inferior_concha":                             "midline",
    # ── Other ─────────────────────────────────────────────────────────────
    "Hyoid_bone":                                  "other",
    "Meatus":                                      "other",
    "Spine_of_the_sphenoid_bone":                  "other",
    "Lateral_pterygoid_plate":                     "other",
}

def class_to_category(class_name: str) -> str:
    """Exact match first, then substring fallback."""
    if class_name in CATEGORY_MAP:
        return CATEGORY_MAP[class_name]
    lower = class_name.lower()
    if any(k in lower for k in ["mandib", "ramus", "gonial", "mental", "coronoid", "lingula", "genial", "oblique"]):
        return "mandible"
    if any(k in lower for k in ["condyl", "glenoid", "articular", "tmj"]):
        return "tmj"
    if any(k in lower for k in ["maxill", "palate", "zygomat", "orbit", "incisive", "pterygom", "tuberosity"]):
        return "maxilla"
    if any(k in lower for k in ["nasal", "septum", "concha", "meatus"]):
        return "midline"
    return "other"

def display_name(class_name: str) -> str:
    """Convert snake_case class names to readable Title Case."""
    return class_name.replace("_", " ")

def mask_to_polygon(mask_xy, img_w: int, img_h: int):
    """Convert ultralytics mask contour points → list of {x, y} pixel dicts."""
    if mask_xy is None or len(mask_xy) == 0:
        return []
    pts = mask_xy.astype(float)
    # Downsample to max ~40 points for clean SVG polygon
    step = max(1, len(pts) // 40)
    pts = pts[::step]
    return [{"x": float(p[0]), "y": float(p[1])} for p in pts]

def bbox_to_polygon(box_xyxy):
    """Fallback: convert [x1,y1,x2,y2] bbox to 4-point polygon."""
    x1, y1, x2, y2 = box_xyxy
    return [
        {"x": float(x1), "y": float(y1)},
        {"x": float(x2), "y": float(y1)},
        {"x": float(x2), "y": float(y2)},
        {"x": float(x1), "y": float(y2)},
    ]

# ─── Root ─────────────────────────────────────────────────────────────────────
def check_result_is_valid_opg(result) -> bool:
    """
    Checks if a YOLO prediction result contains a set of landmark detections
    consistent with a valid panoramic dental OPG radiograph.
    """
    if result.boxes is None or len(result.boxes) == 0:
        return False

    boxes = result.boxes
    high_conf_detections = [box for box in boxes if float(box.conf[0].item()) >= 0.22]
    unique_classes = {int(box.cls[0].item()) for box in high_conf_detections}

    max_conf = max(float(box.conf[0].item()) for box in boxes) if len(boxes) > 0 else 0.0

    return len(high_conf_detections) >= 3 or len(unique_classes) >= 2 or max_conf >= 0.45

@app.get("/")
def read_root():
    if diagnosis_model is None or landmark_model is None:
        return JSONResponse(status_code=503, content={"ok": False})
    required_weights = ("toothpulpmask.pt", "maskrcnn_best.pth")
    if any(not os.path.isfile(os.path.join(here, "models", weight)) for weight in required_weights):
        return JSONResponse(status_code=503, content={"ok": False})
    return {"ok": True}

# ─── Diagnosis endpoint ───────────────────────────────────────────────────────
@app.post("/analyze", dependencies=[Depends(require_ml_key)])
@single_flight
async def analyze(file: UploadFile = File(...)):
    if diagnosis_model is None:
        return JSONResponse(status_code=500, content={"error": "Diagnosis model not loaded."})

    try:
        img = await decode_upload(file)
    except HTTPException as error:
        return JSONResponse(status_code=error.status_code, content={"error": error.detail})

    # Validate image using landmark model (offline check)
    if landmark_model is not None:
        landmark_results = landmark_model(img, conf=0.05, iou=0.4, verbose=False)
        if not check_result_is_valid_opg(landmark_results[0]):
            return {
                "detections": [],
                "annotated_image": None,
                "isValidXray": False,
            }

    results = diagnosis_model(img)
    annotated_img = results[0].plot()

    _, buffer = cv2.imencode('.jpg', annotated_img)
    base64_img = base64.b64encode(buffer).decode('utf-8')

    detections = []
    for box in results[0].boxes:
        cls_id = int(box.cls[0].item())
        class_name = diagnosis_model.names[cls_id]
        confidence = float(box.conf[0].item())
        coords = box.xyxy[0].tolist()
        detections.append({
            "class": class_name,
            "confidence": confidence,
            "box": coords,
        })

    return {
        "detections": detections,
        "annotated_image": f"data:image/jpeg;base64,{base64_img}",
        "isValidXray": True,
    }

# ─── Landmark endpoint ────────────────────────────────────────────────────────
@app.post("/landmarks", dependencies=[Depends(require_ml_key)])
@single_flight
async def detect_landmarks(file: UploadFile = File(...)):
    if landmark_model is None:
        return JSONResponse(
            status_code=503,
            content={"error": "Custom AI landmark model not loaded."},
        )

    try:
        img = await decode_upload(file)
    except HTTPException as error:
        return JSONResponse(status_code=error.status_code, content={"error": error.detail})
    img_h, img_w = img.shape[:2]

    # Use very low confidence threshold so we don't miss detections
    # Default conf=0.05 is often used for medical models
    results = landmark_model(img, conf=0.05, iou=0.4, verbose=False)
    result = results[0]

    # Validate image using the results we just generated
    if not check_result_is_valid_opg(result):
        return {
            "landmarks": [],
            "annotated_image": None,
            "model": "custom_ai_landmarks.pt",
            "image_width": img_w,
            "image_height": img_h,
            "isValidXray": False,
        }

    raw_boxes = len(result.boxes) if result.boxes is not None else 0
    raw_masks = len(result.masks) if result.masks is not None else 0
    print(f"[Landmark] Raw detections — boxes: {raw_boxes}, masks: {raw_masks}")
    if raw_boxes > 0:
        for i, box in enumerate(result.boxes):
            cls_id = int(box.cls[0].item())
            print(f"  [{i}] class={landmark_model.names[cls_id]}  conf={float(box.conf[0].item()):.3f}  box={box.xyxy[0].tolist()}")

    # Annotated image
    annotated_img = result.plot()
    _, buffer = cv2.imencode('.jpg', annotated_img)
    base64_img = base64.b64encode(buffer).decode('utf-8')

    landmarks = []
    names = landmark_model.names

    # ── Try segmentation masks first ──────────────────────────────────────────
    has_masks = result.masks is not None and len(result.masks) > 0

    if has_masks:
        for idx, (mask, box) in enumerate(zip(result.masks, result.boxes, strict=False)):
            cls_id = int(box.cls[0].item())
            class_name = names[cls_id]
            confidence = float(box.conf[0].item())

            # mask.xy is a list of contour point arrays
            mask_pts = mask.xy[0] if len(mask.xy) > 0 else np.array([])
            polygon = mask_to_polygon(mask_pts, img_w, img_h)

            if not polygon:
                polygon = bbox_to_polygon(box.xyxy[0].tolist())

            # Centroid
            xs = [p["x"] for p in polygon]
            ys = [p["y"] for p in polygon]
            cx = sum(xs) / len(xs) if xs else img_w / 2
            cy = sum(ys) / len(ys) if ys else img_h / 2

            color = INSTANCE_COLORS[idx % len(INSTANCE_COLORS)]
            category = class_to_category(class_name)

            landmarks.append({
                "id": f"lm_{idx}_{class_name.lower().replace(' ', '_').replace('/', '_')}",
                "name": display_name(class_name),
                "polygon": polygon,
                "centerX": round(cx),
                "centerY": round(cy),
                "confidence": round(confidence, 4),
                "color": color,
                "category": category,
                "description": "Segmentation mask detected by Custom AI model",
                "significance": f"{display_name(class_name)} — Confidence: {round(confidence * 100, 1)}%",
            })

    else:
        # ── Fallback: bounding-box mode ────────────────────────────────────────
        for idx, box in enumerate(result.boxes):
            cls_id = int(box.cls[0].item())
            class_name = names[cls_id]
            confidence = float(box.conf[0].item())

            polygon = bbox_to_polygon(box.xyxy[0].tolist())

            x1, y1, x2, y2 = box.xyxy[0].tolist()
            cx = (x1 + x2) / 2
            cy = (y1 + y2) / 2

            color = INSTANCE_COLORS[idx % len(INSTANCE_COLORS)]
            category = class_to_category(class_name)

            landmarks.append({
                "id": f"lm_{idx}_{class_name.lower().replace(' ', '_')}",
                "name": class_name,
                "polygon": polygon,
                "centerX": round(cx),
                "centerY": round(cy),
                "confidence": round(confidence, 4),
                "color": color,
                "category": category,
                "description": "Detected by Custom AI landmark model",
                "significance": f"Class: {class_name} | Conf: {round(confidence * 100, 1)}%",
            })

    return {
        "landmarks": landmarks,
        "annotated_image": f"data:image/jpeg;base64,{base64_img}",
        "model": "custom_ai_landmarks.pt",
        "image_width": img_w,
        "image_height": img_h,
        "isValidXray": True,
    }


# ─── Forensics endpoint ───────────────────────────────────────────────────────
@app.post("/forensics", dependencies=[Depends(require_ml_key)])
@single_flight
async def analyze_forensics(file: UploadFile = File(...)):
    try:
        from forensic_pipeline import run_forensic_pipeline
        img = await decode_upload(file)

        # Validate image using landmark model
        if landmark_model is not None:
            landmark_results = landmark_model(img, conf=0.05, iou=0.4, verbose=False)
            if not check_result_is_valid_opg(landmark_results[0]):
                return {
                    "isValidXray": False,
                    "summary": "The uploaded image does not appear to be a valid OPG panoramic radiograph.",
                    "result": None
                }

        results = run_forensic_pipeline(img)
        return results
    except HTTPException as error:
        return JSONResponse(status_code=error.status_code, content={"error": error.detail})
    except ValueError as error:
        return JSONResponse(status_code=422, content={"error": str(error)})
    except Exception:
        import logging
        logging.exception("Forensic inference failed")
        return JSONResponse(status_code=500, content={"error": "Forensic inference failed."})

if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "0.0.0.0")  # nosec B104
    port = int(os.getenv("PORT", "8001"))
    uvicorn.run(app, host=host, port=port)


