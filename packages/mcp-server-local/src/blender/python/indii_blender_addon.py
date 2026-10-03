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
import traceback

BRIDGE_SERVER = None
BRIDGE_THREAD = None
BRIDGE_RUNNING = False

class IndiiBridgeServer:
    def __init__(self, host="127.0.0.1", port=9876):
        self.host = host
        self.port = port
        self.sock = None

    def start(self):
        global BRIDGE_RUNNING
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.sock.bind((self.host, self.port))
        self.sock.listen(5)
        self.sock.settimeout(1.0)
        BRIDGE_RUNNING = True
        print(f"[indii.music] Live 3D Bridge listening on {self.host}:{self.port}")

        while BRIDGE_RUNNING:
            try:
                conn, addr = self.sock.accept()
                threading.Thread(target=self.handle_client, args=(conn,), daemon=True).start()
            except socket.timeout:
                continue
            except Exception as e:
                if BRIDGE_RUNNING:
                    print(f"[indii.music] Server accept error: {e}")
                break

    def handle_client(self, conn):
        try:
            conn.settimeout(10.0)
            data = conn.recv(65536).decode('utf-8')
            if not data:
                return

            req = json.loads(data)
            action = req.get("action", "ping")
            params = req.get("params", {})

            if action == "ping":
                resp = {"status": "ok", "version": "1.0.0", "blender": bpy.app.version_string}
            elif action == "get_scene_info":
                resp = self.get_scene_info()
            elif action == "exec_code":
                code = params.get("code", "")
                resp = self.execute_in_main_thread(code)
            else:
                resp = {"error": f"Unknown action: {action}"}

            conn.sendall(json.dumps(resp).encode('utf-8'))
        except Exception as e:
            err_resp = {"error": str(e), "trace": traceback.format_exc()}
            try:
                conn.sendall(json.dumps(err_resp).encode('utf-8'))
            except Exception:
                pass
        finally:
            conn.close()

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

    def execute_in_main_thread(self, code_str):
        result_holder = {"done": False, "result": None, "error": None}

        def runner():
            try:
                exec_globals = {"bpy": bpy, "context": bpy.context}
                exec(code_str, exec_globals)
                result_holder["result"] = "Execution completed successfully."
            except Exception as e:
                result_holder["error"] = str(e)
            finally:
                result_holder["done"] = True

        bpy.app.timers.register(runner)

        # Wait briefly for execution in main thread
        import time
        start_t = time.time()
        while not result_holder["done"] and (time.time() - start_t) < 5.0:
            time.sleep(0.05)

        if result_holder["error"]:
            return {"status": "error", "error": result_holder["error"]}
        return {"status": "ok", "result": result_holder["result"]}

    def stop(self):
        global BRIDGE_RUNNING
        BRIDGE_RUNNING = False
        if self.sock:
            try:
                self.sock.close()
            except Exception:
                pass
        print("[indii.music] Live 3D Bridge stopped.")

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

        BRIDGE_SERVER = IndiiBridgeServer(port=9876)
        BRIDGE_THREAD = threading.Thread(target=BRIDGE_SERVER.start, daemon=True)
        BRIDGE_THREAD.start()
        self.report({'INFO'}, "indii.music Live Bridge started on port 9876.")
        return {'FINISHED'}

class INDIIMUSIC_OT_StopBridge(bpy.types.Operator):
    bl_idname = "indii.stop_bridge"
    bl_label = "Stop Bridge"
    bl_description = "Stops the live socket bridge server"

    def execute(self, context):
        global BRIDGE_SERVER
        if BRIDGE_SERVER:
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
            box.operator("indii.stop_bridge", text="Stop Server", icon='PAUSE')
        else:
            box.label(text="Status: Offline", icon='CANCEL')
            box.operator("indii.start_bridge", text="Start Live Server", icon='PLAY')

        layout.separator()
        layout.label(text="Active Agents: Director, Creative, Video")
        layout.label(text="Awaiting commands from indii studio...")

classes = (
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
