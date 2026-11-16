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
DIRS = 8       # facing directions, one row each: row k faces k*45 degrees clockwise from screen-right
TILT = 35      # camera tilt from straight down, degrees: gives the sprites depth
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
    t = math.radians(TILT)      # tilted toward the top of the screen, so we see fronts and sides, not just tops
    co.location = (0, -10 * math.sin(t), 10 * math.cos(t))
    co.rotation_euler = (t, 0, 0)
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


def cyl(loc, radius, depth, m, parent=None, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=radius, depth=depth, location=loc, rotation=rot)
    return _finish(bpy.context.object, m, parent)


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


def build_slime():
    body_m, dark_m, eye_m, shine_m = mat('#4cff8a', 0.5, 0.2), mat('#1f9e58', 0.3), mat('#0b2a18', 0.0), mat('#eafff2', 2.5)
    body = root()
    sphere((0, 0, -0.1), (1.0, 1.0, 0.25), dark_m, body)          # puddle rim
    dome = sphere((0, 0, 0), (0.86, 0.86, 0.6), body_m, body)
    for s in (1, -1):
        sphere((0.52, 0.27 * s, 0.4), (0.12, 0.14, 0.1), eye_m, body)
    sphere((-0.2, 0.3, 0.56), (0.2, 0.12, 0.05), shine_m, body)   # highlight
    sphere((-0.42, -0.25, 0.42), 0.09, dark_m, body)              # bubbles
    sphere((-0.1, -0.45, 0.4), 0.06, dark_m, body)

    def animate(p):
        k = math.sin(p * math.tau) * 0.1
        body.scale = (1 + k, 1 - k, 1)
        dome.location.x = k * 0.5

    return animate, 2.6


def build_archer():
    cloak_m, hood_m, bow_m, arrow_m, eye_m = mat('#ffd23f', 0.5), mat('#c99412', 0.35), mat('#7a4a1c', 0.2), mat('#fff8d8', 2.0), mat('#ffffff', 4.0)
    body = root()
    cape = plate([(0.1, 0.5), (-0.55, 0.62), (-0.95, 0.3), (-0.8, 0), (-0.95, -0.3), (-0.55, -0.62), (0.1, -0.5)], (0, 0, -0.1), hood_m, body, 0.05)
    sphere((0, 0, 0), (0.5, 0.62, 0.3), cloak_m, body)            # shoulders
    sphere((0.08, 0, 0.22), (0.34, 0.32, 0.3), hood_m, body)      # hood
    cone((0.36, 0, 0.22), 0.2, 0.36, (0, math.radians(90), 0), hood_m, body)
    for s in (1, -1):
        sphere((0.4, 0.1 * s, 0.34), 0.04, eye_m, body)
    # bow: an arc held out in front, string behind it
    arc = [(0.78 + 0.22 * math.cos(a), 0.78 * math.sin(a)) for a in [math.radians(d) for d in range(-80, 81, 16)]]
    inner = [(x - 0.09, y * 0.93) for x, y in reversed(arc)]
    plate(arc + inner, (0, 0, 0.12), bow_m, body, 0.045)
    for s in (1, -1):
        sphere((0.62, 0.3 * s, 0.1), 0.11, cloak_m, body)         # hands
    arrow = root()
    arrow.parent = body
    cyl((0.62, 0, 0.14), 0.03, 0.8, arrow_m, arrow, (0, math.radians(90), 0))
    cone((1.06, 0, 0.14), 0.08, 0.2, (0, math.radians(90), 0), arrow_m, arrow)

    def animate(p):
        pull = (1 - math.cos(p * math.tau)) / 2          # draw back, then return
        arrow.location.x = -0.24 * pull
        cape.scale.y = 1 + 0.07 * math.sin(p * math.tau)

    return animate, 3.3


def build_brute():
    skin_m, dark_m, horn_m, eye_m = mat('#ff7a2f', 0.45), mat('#b0440f', 0.3), mat('#ffe2c2', 0.8), mat('#fff3a0', 4.0)
    body = root()
    box((-0.08, 0, 0), (0.5, 0.66, 0.3), skin_m, body)            # slab torso
    for s in (1, -1):
        sphere((0.02, 0.68 * s, 0.14), (0.36, 0.3, 0.3), dark_m, body)   # shoulder plates
        cone((0.02, 0.84 * s, 0.34), 0.1, 0.3, (0, 0, 0), horn_m, body)  # shoulder spike
    box((0.36, 0, 0.3), (0.24, 0.26, 0.2), dark_m, body)          # head
    for s in (1, -1):
        cone((0.5, 0.3 * s, 0.4), 0.09, 0.4, (0, math.radians(70), math.radians(35 * s)), horn_m, body)
        sphere((0.6, 0.12 * s, 0.38), 0.05, eye_m, body)
    fists = [sphere((0.55, 0.72 * s, 0.05), (0.3, 0.27, 0.25), skin_m, body) for s in (1, -1)]

    def animate(p):
        k = math.sin(p * math.tau)
        fists[0].location.x = 0.55 + 0.3 * k
        fists[1].location.x = 0.55 - 0.3 * k
        body.rotation_euler = (0, 0, math.radians(7) * k)

    return animate, 3.1


def build_bomber():
    shell_m, band_m, fuse_m, eye_m = mat('#ff3b5c', 0.5, 0.25), mat('#7d1024', 0.2), mat('#3a2a2a', 0.0), mat('#fff3a0', 4.0)
    body = root()
    sphere((0, 0, 0), 0.72, shell_m, body)
    cyl((0, 0, 0.0), 0.735, 0.2, band_m, body, (0, math.radians(90), 0))   # band around the middle
    cyl((-0.2, 0, 0.66), 0.14, 0.2, fuse_m, body)                          # cap
    for s in (1, -1):
        sphere((0.5, 0.26 * s, 0.4), (0.1, 0.13, 0.1), eye_m, body)
    feet = [sphere((0.05 + 0.3 * f, 0.72 * s, -0.3), (0.2, 0.14, 0.12), band_m, body) for s in (1, -1) for f in (1, -1)]
    spark_m = mat('#ffffff', 9.0)
    spark = sphere((-0.2, 0, 0.9), 0.17, spark_m, body)
    rays = [cone((-0.2, 0, 0.9), 0.06, 0.6, (math.radians(90), 0, math.radians(a)), spark_m, body) for a in (0, 90, 180, 270)]

    def animate(p):
        k = math.sin(p * math.tau)
        for i, f in enumerate(feet):
            f.location.x = 0.05 + (0.3 if i % 2 == 0 else -0.3) + 0.14 * k * (1 if i in (0, 3) else -1)
        on = 1.0 if int(p * 4) % 2 == 0 else 0.35                 # the fuse blinks
        spark.scale = (0.17 * on,) * 3
        for i, r in enumerate(rays):
            r.scale = (on, on, on)
            r.rotation_euler[2] = math.radians(i * 90 + 45 * int(p * 4))

    return animate, 3.2


def build_wisp():
    core_m, flame_m, halo_m = mat('#f2fdff', 7.0), mat('#4cd9ff', 2.2), mat('#1b7fb3', 1.0)
    body = root()
    spin = root()
    spin.parent = body
    core = sphere((0, 0, 0.4), 0.3, core_m, body)
    sphere((0, 0, 0), 0.46, flame_m, body)
    for i in range(4):
        a = i * math.pi / 2
        cone((0.62 * math.cos(a), 0.62 * math.sin(a), 0), 0.24, 0.9, (0, math.radians(90), a), flame_m, spin)
        b = a + math.pi / 4
        cone((0.42 * math.cos(b), 0.42 * math.sin(b), -0.1), 0.17, 0.5, (0, math.radians(90), b), halo_m, spin)
    motes = [sphere((0, 0, 0), 0.08, core_m, body) for _ in range(3)]

    def animate(p):
        spin.rotation_euler = (0, 0, p * math.pi / 2)             # quarter turn: loops with 4 points
        core.scale = (0.3 + 0.05 * math.sin(p * math.tau * 2),) * 3
        for i, m in enumerate(motes):
            a = -p * math.tau + i * math.tau / 3
            m.location = (1.08 * math.cos(a), 1.08 * math.sin(a), 0.1)

    return animate, 4.4


def build_player():
    armor_m, steel_m, cape_m, visor_m = mat('#f4f6ff', 0.6, 0.3), mat('#9aa4c4', 0.3, 0.3), mat('#e8344e', 0.45), mat('#12b866', 0.9)
    body = root()
    cape = plate([(-0.1, 0.42), (-0.6, 0.55), (-1.05, 0.34), (-0.92, 0.1), (-1.08, -0.12), (-0.9, -0.36), (-0.6, -0.55), (-0.1, -0.42)], (0, 0, -0.12), cape_m, body, 0.05)
    pads = [sphere((0, 0.5 * s, 0.05), (0.3, 0.26, 0.22), steel_m, body) for s in (1, -1)]
    sphere((0, 0, 0), (0.4, 0.5, 0.3), armor_m, body)             # chest
    sphere((0.1, 0, 0.28), 0.32, armor_m, body)                   # helmet
    box((-0.08, 0, 0.56), (0.2, 0.035, 0.06), cape_m, body)       # crest
    box((0.37, 0, 0.45), (0.05, 0.2, 0.05), visor_m, body)        # visor
    hands = [sphere((0.42, 0.44 * s, 0), 0.13, steel_m, body) for s in (1, -1)]
    cyl((0.74, -0.44, 0.02), 0.045, 0.7, steel_m, hands[1].parent, (0, math.radians(90), 0)).parent = hands[1]
    hands[1].children[0].location = (2.4, 0, 0.1)
    hands[1].children[0].scale = (1 / 0.13,) * 3

    def animate(p):
        k = math.sin(p * math.tau)
        hands[0].location.x = 0.42 + 0.12 * k
        hands[1].location.x = 0.42 - 0.12 * k
        pads[0].location.x = 0.05 * k
        pads[1].location.x = -0.05 * k
        cape.scale = (1 + 0.05 * math.sin(p * math.tau * 2), 1 + 0.08 * k, 1)

    return animate, 5.2


CREATURES = {'bat': build_bat, 'slime': build_slime, 'archer': build_archer, 'brute': build_brute,
             'bomber': build_bomber, 'wisp': build_wisp, 'player': build_player}


# ---------- render ----------
def render(name):
    sc = reset()
    fixed = set(bpy.data.objects)                     # camera and sun
    animate, draw = CREATURES[name]()
    # Put the whole creature under one turntable so it can face each direction.
    turn = bpy.data.objects.new('turn', None)
    sc.collection.objects.link(turn)
    for o in bpy.data.objects:
        if o not in fixed and o is not turn and o.parent is None:
            o.parent = turn
    tmp = tempfile.mkdtemp(prefix='sprite_')
    for d in range(DIRS):
        # Game angles grow clockwise on screen (y points down), Blender's grow anticlockwise.
        turn.rotation_euler = (0, 0, -d * math.tau / DIRS)
        for f in range(FRAMES):
            animate(f / FRAMES)
            sc.render.filepath = os.path.join(tmp, f'f{d * FRAMES + f}.png')
            bpy.ops.render.render(write_still=True)
    out = os.path.join(OUT, name + '.png')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', os.path.join(tmp, 'f%d.png'),
                    '-filter_complex', f'tile={FRAMES}x{DIRS}', '-frames:v', '1', out], check=True)
    return {'frames': FRAMES, 'dirs': DIRS, 'size': FRAME, 'fps': 14, 'draw': draw}


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
