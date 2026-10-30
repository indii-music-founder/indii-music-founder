"""Pure bridge command validation; does not simulate Blender or socket authentication."""
import ast
import pathlib
import unittest
import threading
import queue
import time
import secrets
import socket
import json
import hmac

tree = ast.parse(pathlib.Path(__file__).with_name('indii_blender_addon.py').read_text())
function = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == 'validate_scene_command')
namespace = {}
exec(compile(ast.Module(body=[function], type_ignores=[]), 'bridge-command-contract', 'exec'), namespace)
validate = namespace['validate_scene_command']
namespace.update(threading=threading, queue=queue, time=time, secrets=secrets, json=json, hmac=hmac, socket=socket, BRIDGE_SERVER=None)
bridge = next(n for n in tree.body if isinstance(n, ast.ClassDef) and n.name == 'IndiiBridgeServer')
exec(compile(ast.Module(body=[bridge], type_ignores=[]), 'bridge-queue-contract', 'exec'), namespace)

class SceneCommandContract(unittest.TestCase):
    def test_real_bind_conflict_invalidates_failed_session(self):
        server = namespace['IndiiBridgeServer'](port=0)
        server.bind()
        port = server.sock.getsockname()[1]
        other = namespace['IndiiBridgeServer'](port=port)
        try:
            with self.assertRaises(OSError):
                other.bind()
            self.assertIsNone(other.token)
            self.assertTrue(other.stopped.is_set())
        finally:
            server.stop()
        self.assertIsNone(server.token)

    def test_authenticated_socket_reaches_queue_and_expiration_prevents_mutation(self):
        server = namespace['IndiiBridgeServer']()
        client, peer = socket.socketpair()
        server.slots.acquire()
        worker = threading.Thread(target=server.handle_client, args=(peer,))
        worker.start()
        try:
            client.settimeout(2)
            client.sendall(json.dumps({"token": server.token, "action": "set_frame", "params": {"frame": 24}}).encode() + b'\n')
            job = server.commands.get(timeout=2)
            self.assertEqual(job["action"], 'set_frame')
            self.assertEqual(job["params"], {'frame': 24})
            job["deadline"] = time.monotonic() - 1
            server.commands.put_nowait(job)
            server.drain_commands()
            response = json.loads(client.recv(65536))
            self.assertEqual(response["status"], 'error')
            self.assertIn('expired', response['error'])
        finally:
            client.close()
            worker.join(2)
            self.assertFalse(worker.is_alive())

    def test_native_socket_denials(self):
        server = namespace['IndiiBridgeServer']()
        requests = [
            b'{"action":"ping"}\n',
            json.dumps({"action": "ping", "token": "0" * 64}).encode() + b'\n',
            json.dumps({"action": "exec_code", "token": server.token, "params": {"code": "not executed"}}).encode() + b'\n',
            b'x' * 65537,
            b'{"action":"ping"}',
        ]
        for payload in requests:
            client, peer = socket.socketpair()
            server.slots.acquire()
            worker = threading.Thread(target=server.handle_client, args=(peer,))
            worker.start()
            try:
                client.settimeout(2)
                client.sendall(payload)
                if payload == b'{"action":"ping"}':
                    client.shutdown(socket.SHUT_WR)
                response = json.loads(client.recv(65536))
                self.assertEqual(response["status"], "error")
                self.assertTrue(server.commands.empty())
            finally:
                client.close()
                worker.join(2)
                self.assertFalse(worker.is_alive())

    def test_expired_queue_work_never_touches_blender(self):
        server = namespace['IndiiBridgeServer']()
        job = {"action": "set_frame", "params": {"frame": 24}, "deadline": time.monotonic() - 1,
               "cancelled": False, "lock": threading.Lock(), "done": threading.Event(), "response": None}
        server.commands.put_nowait(job)
        self.assertEqual(server.drain_commands(), 0.05)
        self.assertTrue(job["done"].is_set())
        self.assertEqual(job["response"]["status"], "error")
        server.stopped.set()
        self.assertIsNone(server.drain_commands())

    def test_supported_commands(self):
        validate('ping', {})
        validate('get_scene_info', {})
        validate('set_frame', {'frame': 24})

    def test_python_and_unknown_commands_rejected(self):
        for action in ('exec_code', 'bake_texture', '', '../scene'):
            with self.assertRaises(ValueError):
                validate(action, {'code': 'not executed'})

    def test_bounded_strict_parameters(self):
        for params in ({'frame': True}, {'frame': 0}, {'frame': 1000001}, {'frame': 1.5}, {'frame': 1, 'code': ''}, []):
            with self.assertRaises(ValueError):
                validate('set_frame', params)
        with self.assertRaises(ValueError):
            validate('ping', {'code': ''})

if __name__ == '__main__':
    unittest.main()
