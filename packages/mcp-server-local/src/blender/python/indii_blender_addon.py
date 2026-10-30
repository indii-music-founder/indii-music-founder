bl_info = {
    "name": "indii.music 3D Bridge",
    "author": "indii.music",
    "version": (1, 0, 0),
    "blender": (4, 0, 0),
    "location": "View3D > Sidebar > indii.music",
    "description": "Interactive real-time bridge connecting indii.music AI agents to the active Blender viewport",
    "category": "3D View",
}

import bpy
import socket
import threading
import json
import hmac
import secrets
import time
import queue

BRIDGE_SERVER = None
BRIDGE_THREAD = None
BRIDGE_RUNNING = False

def validate_scene_command(action, params):
    """Only bounded declarative commands may reach the Blender main thread."""
    if not isinstance(params, dict):
        raise ValueError("Command parameters must be an object.")
    if action in ("ping", "get_scene_info"):
        if params:
            raise ValueError("This command accepts no parameters.")
        return
    if action == "set_frame":
        if set(params) != {"frame"} or type(params["frame"]) is not int or not 1 <= params["frame"] <= 1000000:
            raise ValueError("Frame must be an integer between 1 and 1000000.")
        return
    raise ValueError("Unsupported scene command. Python execution is not supported.")


class IndiiBridgeServer:
    def __init__(self, host="127.0.0.1", port=9876):
        self.host = host
        self.port = port
        self.sock = None
        self.token = secrets.token_hex(32)
        self.slots = threading.BoundedSemaphore(8)
        self.commands = queue.Queue(maxsize=8)
        self.stopped = threading.Event()

    def bind(self):
        """Bind synchronously so the operator never announces a failed listener."""
        if self.host != "127.0.0.1" or self.stopped.is_set():
            raise ValueError("A new loopback bridge session is required.")
        listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            listener.bind((self.host, self.port))
            listener.listen(5)
            listener.settimeout(1.0)
            self.sock = listener
        except Exception:
            listener.close()
            self.token = None
            self.stopped.set()
            raise

    def start(self):
        while not self.stopped.is_set():
            try:
                conn, addr = self.sock.accept()
                if not self.slots.acquire(blocking=False):
                    conn.close()
                    continue
                threading.Thread(target=self.handle_client, args=(conn,), daemon=True).start()
            except socket.timeout:
                continue
            except OSError:
                self.stopped.set()
                break

    def handle_client(self, conn):
        try:
            conn.settimeout(10.0)
            data = bytearray()
            deadline = time.monotonic() + 10.0
            while b"\n" not in data:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise ValueError("Bridge request timed out.")
                conn.settimeout(remaining)
                chunk = conn.recv(min(4096, 65537 - len(data)))
                if not chunk:
                    raise ValueError("Incomplete bridge request.")
                data.extend(chunk)
                if len(data) > 65536:
                    raise ValueError("Bridge request too large.")
            frame, trailing = bytes(data).split(b"\n", 1)
            if trailing:
                raise ValueError("Only one command is allowed per connection.")
            req = json.loads(frame.decode('utf-8'))
            credential = req.get("token") if isinstance(req, dict) else None
            if not isinstance(credential, str) or len(credential) != 64 or not self.token or not hmac.compare_digest(credential, self.token):
                raise ValueError("Bridge pairing required.")
            action = req.get("action", "ping")
            params = req.get("params", {})
            validate_scene_command(action, params)

            resp = self.execute_in_main_thread(action, params)

            conn.sendall(json.dumps(resp).encode('utf-8'))
        except Exception as e:
            err_resp = {"status": "error", "error": "Bridge request rejected."}
            try:
                conn.sendall(json.dumps(err_resp).encode('utf-8'))
            except Exception:
                pass
        finally:
            conn.close()
            self.slots.release()

    def get_scene_info(self):
        scene = bpy.context.scene
        objects = []
        for obj in scene.objects:
            objects.append({
                "name": obj.name,
                "type": obj.type,
                "location": [round(c, 3) for c in obj.location],
                "visible": obj.visible_get()
            })
        return {
            "name": scene.name,
            "engine": scene.render.engine,
            "resolution": [scene.render.resolution_x, scene.render.resolution_y],
            "fps": scene.render.fps,
            "frame_range": [scene.frame_start, scene.frame_end],
            "object_count": len(objects),
            "objects": objects[:30] # Cap list for performance
        }

    def drain_commands(self):
        """Registered by the operator on Blender's main thread, never a socket worker."""
        if self.stopped.is_set():
            global BRIDGE_RUNNING
            if BRIDGE_SERVER is self:
                BRIDGE_RUNNING = False
            return None
        for _ in range(8):
            try:
                job = self.commands.get_nowait()
            except queue.Empty:
                break
            with job["lock"]:
                if job["cancelled"] or self.stopped.is_set() or time.monotonic() >= job["deadline"]:
                    job["response"] = {"status": "error", "error": "Command expired before execution."}
                else:
                    try:
                        action, params = job["action"], job["params"]
                        validate_scene_command(action, params)
                        if action == "ping":
                            response = {"status": "ok", "version": "1.0.0", "blender": bpy.app.version_string}
                        elif action == "get_scene_info":
                            response = {"status": "ok", "result": self.get_scene_info()}
                        else:
                            bpy.context.scene.frame_set(params["frame"])
                            response = {"status": "ok", "result": {"frame": bpy.context.scene.frame_current}}
                        job["response"] = response
                    except Exception:
                        job["response"] = {"status": "error", "error": "Scene command failed."}
                job["done"].set()
        return 0.05

    def execute_in_main_thread(self, action, params):
        validate_scene_command(action, params)
        job = {"action": action, "params": params, "deadline": time.monotonic() + 5.0,
               "cancelled": False, "lock": threading.Lock(), "done": threading.Event(), "response": None}
        self.commands.put_nowait(job)
        if not job["done"].wait(5.0):
            with job["lock"]:
                # A completed command is reported truthfully; pending work is cancelled.
                if not job["done"].is_set():
                    job["cancelled"] = True
                    return {"status": "error", "error": "Command timed out before execution."}
        return job["response"]

    def stop(self):
        global BRIDGE_RUNNING
        BRIDGE_RUNNING = False
        self.token = None
        self.stopped.set()
        if self.sock:
            try:
                self.sock.close()
            except Exception:
                pass
        print("[indii.music] Live 3D Bridge stopped.")

# The owner copies this session credential explicitly; it is never logged.
class INDIIMUSIC_OT_CopyPairing(bpy.types.Operator):
    bl_idname = "indii.copy_pairing"
    bl_label = "Copy Pairing Code"

    def execute(self, context):
        if not BRIDGE_SERVER or not BRIDGE_SERVER.token:
            return {'CANCELLED'}
        context.window_manager.clipboard = BRIDGE_SERVER.token
        self.report({'INFO'}, "Paste the code into indii desktop's Blender pairing field.")
        return {'FINISHED'}

# Operators
class INDIIMUSIC_OT_StartBridge(bpy.types.Operator):
    bl_idname = "indii.start_bridge"
    bl_label = "Start Bridge"
    bl_description = "Starts the live socket bridge server for indii.music agents"

    def execute(self, context):
        global BRIDGE_SERVER, BRIDGE_THREAD, BRIDGE_RUNNING
        if BRIDGE_RUNNING:
            self.report({'INFO'}, "Bridge is already running.")
            return {'FINISHED'}

        candidate = IndiiBridgeServer(port=9876)
        try:
            candidate.bind()
            bpy.app.timers.register(candidate.drain_commands)
            BRIDGE_THREAD = threading.Thread(target=candidate.start, daemon=True)
            BRIDGE_SERVER = candidate
            BRIDGE_RUNNING = True
            BRIDGE_THREAD.start()
        except Exception:
            candidate.stop()
            self.report({'ERROR'}, "Could not start the Blender bridge. Check whether port 9876 is already in use.")
            return {'CANCELLED'}
        self.report({'INFO'}, "indii.music Live Bridge started on port 9876.")
        return {'FINISHED'}

class INDIIMUSIC_OT_StopBridge(bpy.types.Operator):
    bl_idname = "indii.stop_bridge"
    bl_label = "Stop Bridge"
    bl_description = "Stops the live socket bridge server"

    def execute(self, context):
        global BRIDGE_SERVER
        if BRIDGE_SERVER:
            if context.window_manager.clipboard == BRIDGE_SERVER.token:
                context.window_manager.clipboard = ""
            BRIDGE_SERVER.stop()
        self.report({'INFO'}, "indii.music Live Bridge stopped.")
        return {'FINISHED'}

# UI Panel in 3D Viewport Sidebar
class INDIIMUSIC_PT_BridgePanel(bpy.types.Panel):
    bl_label = "indii.music 3D Bridge"
    bl_idname = "INDIIMUSIC_PT_bridge_panel"
    bl_space_type = 'VIEW_3D'
    bl_region_type = 'UI'
    bl_category = 'indii.music'

    def draw(self, context):
        layout = self.layout
        global BRIDGE_RUNNING

        box = layout.box()
        if BRIDGE_RUNNING:
            box.label(text="Status: Connected (Port 9876)", icon='CHECKMARK')
            box.operator("indii.copy_pairing", text="Copy Pairing Code")
            box.operator("indii.stop_bridge", text="Stop Server", icon='PAUSE')
        else:
            box.label(text="Status: Offline", icon='CANCEL')
            box.operator("indii.start_bridge", text="Start Live Server", icon='PLAY')

        layout.separator()
        layout.label(text="Active Agents: Director, Creative, Video")
        layout.label(text="Awaiting commands from indii studio...")

classes = (
    INDIIMUSIC_OT_CopyPairing,
    INDIIMUSIC_OT_StartBridge,
    INDIIMUSIC_OT_StopBridge,
    INDIIMUSIC_PT_BridgePanel,
)

def register():
    for cls in classes:
        bpy.utils.register_class(cls)

def unregister():
    global BRIDGE_SERVER
    if BRIDGE_SERVER:
        BRIDGE_SERVER.stop()
    for cls in reversed(classes):
        bpy.utils.unregister_class(cls)

if __name__ == "__main__":
    register()
