#!/usr/bin/env python3
"""Print active display UUIDs as JSON: [{"id", "uuid", "builtin"}].

Used instead of obs-websocket's GetInputPropertiesListPropertyItems for
screen_capture, which hangs on OBS 32.1.x.
"""
import ctypes
import json

cs = ctypes.CDLL('/System/Library/Frameworks/ColorSync.framework/ColorSync')
cg = ctypes.CDLL('/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics')
cf = ctypes.CDLL('/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation')

n = ctypes.c_uint32()
ids = (ctypes.c_uint32 * 16)()
cg.CGGetActiveDisplayList(16, ids, ctypes.byref(n))

fn = cs.CGDisplayCreateUUIDFromDisplayID
fn.restype = ctypes.c_void_p
fn.argtypes = [ctypes.c_uint32]
cf.CFUUIDCreateString.restype = ctypes.c_void_p
cf.CFUUIDCreateString.argtypes = [ctypes.c_void_p, ctypes.c_void_p]
cf.CFStringGetCStringPtr.restype = ctypes.c_char_p
cf.CFStringGetCStringPtr.argtypes = [ctypes.c_void_p, ctypes.c_uint32]

out = []
for i in range(n.value):
    d = ids[i]
    s = cf.CFUUIDCreateString(None, fn(d))
    p = cf.CFStringGetCStringPtr(s, 0x08000100)  # kCFStringEncodingUTF8
    out.append({
        'id': d,
        'uuid': (p or b'').decode(),
        'builtin': bool(cg.CGDisplayIsBuiltin(d)),
    })
print(json.dumps(out))
