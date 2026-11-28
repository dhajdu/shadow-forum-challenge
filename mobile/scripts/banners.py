# Regenerate with: python3 mobile/scripts/banners.py mobile/assets/banners  (needs Pillow and numpy)
# People-free "night city" banners in the Neon Noir palette (docs/design-system.md):
# bg #06080f, bg-2 #0b1020, red #ff4326, blue #2f7dff, amber #f5a524, navy #1d3a7a.
import random, sys, os
from PIL import Image, ImageDraw, ImageFilter
W, H = 1000, 560
BG, BG2 = (6, 8, 15), (11, 16, 32)
RED, BLUE, AMBER, NAVY, ORANGE, GREEN = (255, 67, 38), (47, 125, 255), (245, 165, 36), (29, 58, 122), (255, 122, 26), (87, 211, 140)

def lerp(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

def glow(img, xy, r, color, alpha):
    layer = Image.new("RGB", img.size, (0, 0, 0))
    d = ImageDraw.Draw(layer)
    x, y = xy
    d.ellipse([x - r, y - r * 0.7, x + r, y + r * 0.7], fill=tuple(int(c * alpha) for c in color))
    layer = layer.filter(ImageFilter.GaussianBlur(r * 0.45))
    return Image.fromarray(__import__("numpy").minimum(255, __import__("numpy").asarray(img, dtype="int32") + __import__("numpy").asarray(layer, dtype="int32")).astype("uint8"))

def make(name, seed, left, right, accent, moon=False, tall=1.0, rain=True, horizon=0.84):
    rnd = random.Random(seed)
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    for y in range(H):  # sky
        d.line([(0, y), (W, y)], fill=lerp(BG2, BG, y / H))
    img = glow(img, (W * 0.14, H * 0.45), 330, left, 0.55)
    img = glow(img, (W * 0.88, H * 0.5), 340, right, 0.6)
    if moon:
        img = glow(img, (W * 0.62, H * 0.2), 90, (220, 228, 255), 0.35)
        dm = ImageDraw.Draw(img); dm.ellipse([W * 0.62 - 34, H * 0.2 - 34, W * 0.62 + 34, H * 0.2 + 34], fill=(214, 222, 245))
    d = ImageDraw.Draw(img)
    base = int(H * horizon)
    # three depth layers of towers, far (lighter, hazier) to near (darkest)
    for layer, (shade, hmin, hmax, wmin, wmax, lit) in enumerate([
        (lerp(BG2, NAVY, 0.35), 0.20, 0.42, 30, 70, 0.05),
        (lerp(BG2, BG, 0.3), 0.16, 0.38, 40, 90, 0.07),
        (lerp(BG, (0, 0, 0), 0.25), 0.10, 0.30, 55, 120, 0.09)]):
        x = -rnd.randint(0, 40)
        while x < W:
            w = rnd.randint(wmin, wmax)
            h = int(H * rnd.uniform(hmin, hmax) * tall)
            top = base - h
            d.rectangle([x, top, x + w, base], fill=shade)
            if rnd.random() < 0.25:  # stepped top / antenna
                d.rectangle([x + w * 0.3, top - h * 0.08, x + w * 0.7, top], fill=shade)
                if rnd.random() < 0.5: d.line([(x + w * 0.5, top - h * 0.08), (x + w * 0.5, top - h * 0.18)], fill=shade, width=2)
            for wy in range(top + 8, base - 6, 9):  # windows
                for wx in range(int(x) + 5, int(x + w) - 5, 8):
                    if rnd.random() < lit:
                        c = rnd.choice([AMBER, (255, 214, 150), (190, 210, 255), accent])
                        c = lerp(shade, c, 0.35 + 0.4 * layer / 2)
                        d.rectangle([wx, wy, wx + 3, wy + 4], fill=c)
            if layer == 2 and rnd.random() < 0.22:  # vertical neon sign
                sx = x + rnd.randint(4, max(5, w - 10)); sy = top + rnd.randint(10, max(11, h // 2)); sh = rnd.randint(40, 110)
                col = rnd.choice([left, right, accent])
                img2 = Image.new("RGB", img.size, (0, 0, 0)); d2 = ImageDraw.Draw(img2)
                d2.rectangle([sx, sy, sx + 9, sy + sh], fill=col)
                img2 = img2.filter(ImageFilter.GaussianBlur(9))
                import numpy as np
                img = Image.fromarray(np.minimum(255, np.asarray(img, dtype="int32") + np.asarray(img2, dtype="int32")).astype("uint8"))
                d = ImageDraw.Draw(img)
                d.rectangle([sx + 2, sy, sx + 7, sy + sh], fill=lerp(col, (255, 255, 255), 0.35))
            x += w + rnd.randint(-6, 10)
    # wet street with reflections
    import numpy as np
    arr = np.asarray(img).copy()
    refl = arr[max(0, 2 * base - H):base][::-1]
    h = H - base
    refl = refl[:h]
    street = (refl * 0.28 + np.array(BG) * 0.72).astype("uint8")
    arr[base:base + street.shape[0]] = street
    img = Image.fromarray(arr)
    d = ImageDraw.Draw(img)
    d.line([(0, base), (W, base)], fill=lerp(BG, accent, 0.35), width=1)
    if rain:
        rl = Image.new("RGBA", img.size, (0, 0, 0, 0)); dr = ImageDraw.Draw(rl)
        for _ in range(420):
            x0, y0 = rnd.randint(-50, W), rnd.randint(-40, H)
            dr.line([(x0, y0), (x0 + 6, y0 + 26)], fill=(200, 215, 255, rnd.randint(18, 45)), width=1)
        img = Image.alpha_composite(img.convert("RGBA"), rl).convert("RGB")
    img = img.filter(ImageFilter.GaussianBlur(0.6))
    img.save(os.path.join(sys.argv[1], f"{name}.jpg"), quality=78, optimize=True, progressive=True)

out = sys.argv[1]
make("hero", 11, RED, BLUE, AMBER, moon=True, tall=1.05)
make("landing", 23, RED, BLUE, RED, moon=False, tall=1.15)
make("back", 37, NAVY, BLUE, BLUE, tall=0.95)
make("front", 41, RED, NAVY, ORANGE, tall=1.0)
make("kitty", 53, AMBER, NAVY, AMBER, tall=0.9)
make("chat", 61, NAVY, BLUE, BLUE, moon=True, tall=1.0)
make("stances", 73, RED, ORANGE, RED, tall=1.1)
make("goals", 89, AMBER, BLUE, GREEN, tall=1.0)
make("me", 97, BLUE, NAVY, BLUE, tall=0.95)
make("ask", 103, NAVY, BLUE, (120, 150, 255), moon=True, tall=0.9)
