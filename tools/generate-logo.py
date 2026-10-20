#!/usr/bin/env python3
"""Generate the Turbo IMAP butterfly logo as PNG and ICO."""

from pathlib import Path

from PIL import Image, ImageDraw

SIZE = 512
SCALE = 4
CANVAS = SIZE * SCALE
CENTER = SIZE // 2
ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"


def scaled(point):
    return (round(point[0] * SCALE), round(point[1] * SCALE))


def cubic_points(p0, p1, p2, p3, steps=160):
    points = []
    for index in range(1, steps + 1):
        t = index / steps
        u = 1 - t
        x = (u ** 3) * p0[0] + 3 * (u ** 2) * t * p1[0] + 3 * u * (t ** 2) * p2[0] + (t ** 3) * p3[0]
        y = (u ** 3) * p0[1] + 3 * (u ** 2) * t * p1[1] + 3 * u * (t ** 2) * p2[1] + (t ** 3) * p3[1]
        points.append((x, y))
    return points


def wing_path(start, curves):
    points = [start]
    current = start
    for control_a, control_b, end in curves:
        points.extend(cubic_points(current, control_a, control_b, end))
        current = end
    return points


def mirrored(points):
    return [(SIZE - x, y) for x, y in points]


def draw_polygon(draw, points, color):
    draw.polygon([scaled(point) for point in points], fill=color)


def draw_beaded_line(draw, points, color, width):
    scaled_points = [scaled(point) for point in points]
    draw.line(scaled_points, fill=color, width=width * SCALE, joint="curve")
    radius = width * SCALE // 2
    for point in (scaled_points[0], scaled_points[-1]):
        draw.ellipse(
            [point[0] - radius, point[1] - radius, point[0] + radius, point[1] + radius],
            fill=color,
        )


def main():
    ASSETS.mkdir(parents=True, exist_ok=True)

    image = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    upper_outer = wing_path(
        (240, 270),
        [
            ((205, 240), (155, 160), (92, 105)),
            ((76, 175), (120, 260), (215, 292)),
            ((228, 296), (238, 285), (240, 270)),
        ],
    )
    upper_inner = wing_path(
        (238, 274),
        [
            ((210, 252), (175, 198), (136, 151)),
            ((127, 196), (158, 250), (221, 291)),
            ((230, 294), (238, 286), (238, 274)),
        ],
    )
    lower_outer = wing_path(
        (244, 330),
        [
            ((205, 322), (155, 340), (113, 390)),
            ((120, 450), (185, 470), (240, 405)),
            ((252, 388), (254, 352), (244, 330)),
        ],
    )
    lower_inner = wing_path(
        (242, 342),
        [
            ((212, 340), (181, 356), (147, 392)),
            ((155, 429), (198, 441), (236, 402)),
            ((247, 387), (249, 357), (242, 342)),
        ],
    )

    palette = {
        "upper_outer": "#00aff0",
        "upper_inner": "#7fdcff",
        "lower_outer": "#7fba00",
        "lower_inner": "#00b294",
    }
    right_palette = {
        "upper_outer": "#ffb900",
        "upper_inner": "#ffd35c",
        "lower_outer": "#f25022",
        "lower_inner": "#e3008c",
    }

    draw_polygon(draw, mirrored(lower_outer), right_palette["lower_outer"])
    draw_polygon(draw, mirrored(lower_inner), right_palette["lower_inner"])
    draw_polygon(draw, lower_outer, palette["lower_outer"])
    draw_polygon(draw, lower_inner, palette["lower_inner"])

    draw_polygon(draw, mirrored(upper_outer), right_palette["upper_outer"])
    draw_polygon(draw, mirrored(upper_inner), right_palette["upper_inner"])
    draw_polygon(draw, upper_outer, palette["upper_outer"])
    draw_polygon(draw, upper_inner, palette["upper_inner"])

    body_color = "#132a3e"
    antenna_left = cubic_points((246, 210), (238, 180), (222, 162), (208, 148))
    antenna_right = cubic_points((266, 210), (274, 180), (290, 162), (304, 148))
    draw_beaded_line(draw, antenna_left, body_color, 10)
    draw_beaded_line(draw, antenna_right, body_color, 10)

    draw.ellipse(
        [scaled((241, 238)), scaled((271, 376))],
        fill=body_color,
    )
    draw.ellipse(
        [scaled((231, 198)), scaled((281, 248))],
        fill=body_color,
    )
    draw.ellipse(
        [scaled((242, 207)), scaled((254, 219))],
        fill=(255, 255, 255, 48),
    )

    image = image.resize((SIZE, SIZE), Image.LANCZOS)
    image.save(ASSETS / "logo.png")

    icon = image.copy()
    icon.save(
        ASSETS / "logo.ico",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )

    print(f"Logo written to {ASSETS / 'logo.png'} and {ASSETS / 'logo.ico'}")


if __name__ == "__main__":
    main()
