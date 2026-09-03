"""OpenCV preprocessing pipeline for identity-card photographs."""

import logging
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class PreprocessedImage:
    """Processed image and metadata useful for diagnostics."""

    image: np.ndarray
    orientation: str


def rotate_image(image: np.ndarray, angle: int) -> np.ndarray:
    """Rotate an image clockwise by a right angle without changing its pixels."""

    rotations = {
        0: image,
        90: cv2.rotate(image, cv2.ROTATE_90_CLOCKWISE),
        180: cv2.rotate(image, cv2.ROTATE_180),
        270: cv2.rotate(image, cv2.ROTATE_90_COUNTERCLOCKWISE),
    }
    if angle not in rotations:
        raise ValueError("angle must be one of 0, 90, 180, or 270")
    return rotations[angle]


def _write_debug(image: np.ndarray, debug_dir: Path | None, filename: str) -> None:
    if debug_dir is None:
        return
    debug_dir.mkdir(parents=True, exist_ok=True)
    if not cv2.imwrite(str(debug_dir / filename), image):
        logger.warning("Could not save debug image %s", debug_dir / filename)


def _correct_perspective(image: np.ndarray) -> np.ndarray:
    """Apply a conservative quadrilateral correction when a card contour is clear."""

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 150)
    contours, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    image_area = image.shape[0] * image.shape[1]
    for contour in sorted(contours, key=cv2.contourArea, reverse=True)[:20]:
        area = cv2.contourArea(contour)
        perimeter = cv2.arcLength(contour, True)
        approximation = cv2.approxPolyDP(contour, 0.02 * perimeter, True)
        if len(approximation) != 4 or not 0.25 * image_area < area < 0.98 * image_area:
            continue
        points = approximation.reshape(4, 2).astype(np.float32)
        sums = points.sum(axis=1)
        differences = np.diff(points, axis=1).ravel()
        ordered = np.array(
            [
                points[np.argmin(sums)],
                points[np.argmin(differences)],
                points[np.argmax(sums)],
                points[np.argmax(differences)],
            ],
            dtype=np.float32,
        )
        width = max(
            np.linalg.norm(ordered[1] - ordered[0]), np.linalg.norm(ordered[2] - ordered[3])
        )
        height = max(
            np.linalg.norm(ordered[3] - ordered[0]), np.linalg.norm(ordered[2] - ordered[1])
        )
        if width < 100 or height < 60:
            continue
        destination = np.array(
            [[0, 0], [width - 1, 0], [width - 1, height - 1], [0, height - 1]], dtype=np.float32
        )
        matrix = cv2.getPerspectiveTransform(ordered, destination)
        return cv2.warpPerspective(image, matrix, (int(width), int(height)))
    return image


def preprocess_image(
    image_path: str,
    debug_dir: str | Path | None = None,
    apply_perspective: bool = True,
    max_dimension: int = 2200,
) -> PreprocessedImage:
    """Load, orient, resize, enhance, denoise, and optionally rectify an image."""

    source = cv2.imread(image_path, cv2.IMREAD_COLOR)
    if source is None:
        raise ValueError(f"Unable to read image: {image_path}")
    debug_path = Path(debug_dir) if debug_dir is not None else None
    orientation = "landscape"
    image = source
    if image.shape[0] > image.shape[1] * 1.15:
        image = cv2.rotate(image, cv2.ROTATE_90_CLOCKWISE)
        orientation = "rotated_portrait"
    _write_debug(image, debug_path, "01_oriented.jpg")

    longest_side = max(image.shape[:2])
    scale = min(2.0, max_dimension / longest_side)
    if scale != 1:
        image = cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    _write_debug(image, debug_path, "02_resized.jpg")

    if apply_perspective:
        image = _correct_perspective(image)
    _write_debug(image, debug_path, "03_perspective.jpg")

    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    lightness, a_channel, b_channel = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    contrast = cv2.cvtColor(
        cv2.merge((clahe.apply(lightness), a_channel, b_channel)), cv2.COLOR_LAB2BGR
    )
    _write_debug(contrast, debug_path, "04_contrast.jpg")

    grayscale = cv2.cvtColor(contrast, cv2.COLOR_BGR2GRAY)
    denoised = cv2.fastNlMeansDenoising(grayscale, None, 7, 7, 21)
    final = cv2.cvtColor(denoised, cv2.COLOR_GRAY2BGR)
    _write_debug(grayscale, debug_path, "05_grayscale.jpg")
    _write_debug(final, debug_path, "06_final.jpg")
    return PreprocessedImage(image=final, orientation=orientation)
