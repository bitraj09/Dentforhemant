"""Test script to verify landmark model loading and inference."""
import os

from ultralytics import YOLO

model_path = os.path.join(os.path.dirname(__file__), "models", "best_landmarks.pt")

print(f"Testing model: {model_path}")
print(f"File exists: {os.path.exists(model_path)}")

if os.path.exists(model_path):
    try:
        model = YOLO(model_path)
        print("✓ Model loaded successfully")
        print(f"  Task: {model.task}")
        print(f"  Classes: {len(model.names)}")
        print(f"  Model size: {os.path.getsize(model_path) / 1024 / 1024:.2f} MB")

        # Check model architecture
        if hasattr(model, 'model'):
            print(f"  Model type: {type(model.model).__name__}")

    except Exception as err:
        import traceback
        print(f"✗ Error loading model: {err}")
        traceback.print_exc()
else:
    print(f"✗ Model file not found at {model_path}")

