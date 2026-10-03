"""Test inference with landmark model on a sample image."""
import glob
import os

import cv2
from ultralytics import YOLO

model_path = os.path.join(os.path.dirname(__file__), 'models', 'best_landmarks.pt')
model = YOLO(model_path)
print(f"Model loaded. Task: {model.task}, Classes: {len(model.names)}")

# Find sample dental X-rays
sample_dirs = [
    '../public/samples',
    '../public/uploads',
    '../../DentalXrayAI/images',
]

test_image = None
for directory in sample_dirs:
    if os.path.exists(directory):
        images = glob.glob(os.path.join(directory, '*.jpg')) + glob.glob(os.path.join(directory, '*.png'))
        if images:
            test_image = images[0]
            break

if test_image:
    print(f"\nTesting with image: {test_image}")
    img = cv2.imread(test_image)
    if img is not None:
        print(f"Image size: {img.shape}")

        # Run inference
        results = model(img, conf=0.05, iou=0.4, verbose=False)
        result = results[0]

        print("\nDetection Results:")
        print(f"  Boxes found: {len(result.boxes) if result.boxes else 0}")
        print(f"  Masks found: {len(result.masks) if result.masks else 0}")

        if result.boxes:
            print("\n  Detected classes:")
            for box in result.boxes:
                cls_id = int(box.cls[0].item())
                class_name = model.names[cls_id]
                conf = float(box.conf[0].item())
                print(f"    - {class_name}: {conf:.3f}")

        if result.masks:
            print("\n  Segmentation masks available: Yes")
        else:
            print("\n  Segmentation masks available: No")
    else:
        print(f"Failed to load image: {test_image}")
else:
    print("\nNo sample images found. Please provide a test image path.")

