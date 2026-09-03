import numpy as np
import pytest

from app.preprocessing import rotate_image


def test_rotate_image_supports_all_right_angles() -> None:
    image = np.arange(12, dtype=np.uint8).reshape(3, 4)

    assert rotate_image(image, 0).shape == (3, 4)
    assert rotate_image(image, 90).shape == (4, 3)
    assert rotate_image(image, 180).shape == (3, 4)
    assert rotate_image(image, 270).shape == (4, 3)


def test_rotate_image_rejects_non_right_angle() -> None:
    with pytest.raises(ValueError, match="angle"):
        rotate_image(np.zeros((2, 2), dtype=np.uint8), 45)
