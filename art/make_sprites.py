# Builds creatures in Blender and renders top-down animated sprite sheets for the game.
#
#   blender -b -P art/make_sprites.py -- bat          (one creature)
#   blender -b -P art/make_sprites.py --              (all creatures)
#
# Output: public/sprites/<name>.png (FRAMES frames side by side) and public/sprites/sprites.json.
# Creatures face +X (right), which is angle 0 in the game.
import bpy, sys, os, math, json, subprocess, tempfile

FRAME = 128    # pixels per frame
FRAMES = 8     # frames per loop
VIEW = 2.6     # model units visible across one frame
ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
OUT = os.path.join(ROOT, 'public', 'sprites')


# ---------- scene ----------
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    for eng in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'):
        try:
            sc.render.engine = eng
            break
        except TypeError:
            pass
    r = sc.render
    r.film_transparent = True
    r.resolution_x = r.resolution_y = FRAME
    r.resolution_percentage = 100
    r.image_settings.file_format = 'PNG'
    r.image_settings.color_mode = 'RGBA'
    sc.view_settings.view_transform = 'Standard'

    cam = bpy.data.cameras.new('cam')
    cam.type = 'ORTHO'
    cam.ortho_scale = VIEW
    co = bpy.data.objects.new('cam', cam)
    sc.collection.objects.link(co)
    co.location = (0, 0, 10)   # looks straight down
    sc.camera = co

    sun = bpy.data.lights.new('sun', 'SUN')
    sun.energy = 3.0
    so = bpy.data.objects.new('sun', sun)
    sc.collection.objects.link(so)
    so.rotation_euler = (math.radians(38), math.radians(-28), 0)

    world = bpy.data.worlds.new('world')
    sc.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get('Background')
    if bg:
        bg.inputs[0].default_value = (1, 1, 1, 1)
        bg.inputs[1].default_value = 0.4
    return sc


# ---------- materials ----------
def lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def rgba(hexc):
    h = hexc.lstrip('#')
    return tuple(lin(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4)) + (1,)


def mat(hexc, glow=0.5, rough=0.45):
    m = bpy.data.materials.new(hexc)
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    c = rgba(hexc)
    b.inputs['Base Color'].default_value = c
    b.inputs['Roughness'].default_value = rough
    b.inputs['Emission Color'].default_value = c
    b.inputs['Emission Strength'].default_value = glow
    return m


# ---------- primitives ----------
def _finish(o, m, parent):
    o.data.materials.append(m)
    for p in o.data.polygons:
        p.use_smooth = True
    if parent:
        o.parent = parent
    return o


def sphere(loc, scale, m, parent=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, location=loc)
    o = bpy.context.object
    o.scale = scale if isinstance(scale, tuple) else (scale,) * 3
    return _finish(o, m, parent)


def cone(loc, radius, depth, rot, m, parent=None):
    bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=radius, depth=depth, location=loc, rotation=rot)
    return _finish(bpy.context.object, m, parent)


def box(loc, scale, m, parent=None, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=loc, rotation=rot)
    o = bpy.context.object
    o.scale = scale
    _finish(o, m, parent)
    for p in o.data.polygons:
        p.use_smooth = False
    return o


def root():
    """Unscaled parent for a creature's parts, so child positions are in model units."""
    o = bpy.data.objects.new('root', None)
    bpy.context.scene.collection.objects.link(o)
    return o


def plate(points, loc, m, parent=None, thick=0.03):
    """A flat shape from a list of (x, y) points, e.g. a wing."""
    mesh = bpy.data.meshes.new('plate')
    n = len(points)
    verts = [(x, y, thick) for x, y in points] + [(x, y, -thick) for x, y in points]
    faces = [list(range(n)), list(range(2 * n - 1, n - 1, -1))]
    faces += [[i, (i + 1) % n, n + (i + 1) % n, n + i] for i in range(n)]
    mesh.from_pydata(verts, [], faces)
    o = bpy.data.objects.new('plate', mesh)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    o.data.materials.append(m)
    if parent:
        o.parent = parent
    return o


# ---------- creatures ----------
# Each builder creates the model and returns (animate, draw).
#   animate(p): pose the model for loop position p in 0..1
#   draw: sprite width in the game, in multiples of the creature's radius

def build_bat():
    body_m, wing_m, eye_m = mat('#b06cff', 0.55), mat('#6b35c9', 0.35), mat('#fff3a0', 4.0)
    body = root()
    sphere((0, 0, 0), (0.42, 0.26, 0.24), body_m, body)
    sphere((0.42, 0, 0.03), 0.21, body_m, body)
    for s in (1, -1):
        cone((0.44, 0.15 * s, 0.1), 0.09, 0.3, (0, math.radians(60), math.radians(25 * s)), body_m, body)
        sphere((0.58, 0.085 * s, 0.1), 0.045, eye_m, body)
    wing_pts = [(0.2, 0), (0.42, 0.45), (0.2, 1.12), (-0.08, 0.86), (-0.12, 0.6), (-0.34, 0.42), (-0.28, 0.2), (-0.36, 0)]
    left = plate(wing_pts, (0, 0.14, 0.05), wing_m, body)
    right = plate([(x, -y) for x, y in reversed(wing_pts)], (0, -0.14, 0.05), wing_m, body)

    def animate(p):
        a = math.sin(p * math.tau) * math.radians(58)
        left.rotation_euler = (a, 0, 0)
        right.rotation_euler = (-a, 0, 0)
        body.location.z = math.sin(p * math.tau) * -0.04

    return animate, 5.2


CREATURES = {'bat': build_bat}


# ---------- render ----------
def render(name):
    sc = reset()
    animate, draw = CREATURES[name]()
    tmp = tempfile.mkdtemp(prefix='sprite_')
    for f in range(FRAMES):
        animate(f / FRAMES)
        sc.render.filepath = os.path.join(tmp, f'f{f}.png')
        bpy.ops.render.render(write_still=True)
    out = os.path.join(OUT, name + '.png')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', os.path.join(tmp, 'f%d.png'),
                    '-filter_complex', f'tile={FRAMES}x1', '-frames:v', '1', out], check=True)
    return {'frames': FRAMES, 'size': FRAME, 'fps': 14, 'draw': draw}


def main():
    names = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    names = names or list(CREATURES)
    os.makedirs(OUT, exist_ok=True)
    manifest_path = os.path.join(OUT, 'sprites.json')
    manifest = json.load(open(manifest_path)) if os.path.exists(manifest_path) else {}
    for n in names:
        manifest[n] = render(n)
        print('rendered', n)
    json.dump(manifest, open(manifest_path, 'w'), indent=1)


main()
