import json
import logging
from typing import Dict, Set
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from ..config import settings

logger = logging.getLogger("webrtc.signaling")

router = APIRouter(prefix="/ws/signaling", tags=["WebRTC Signaling"])

class RoomManager:
    """
    Manages active WebRTC signaling rooms and peer message routing.
    Signaling handles room negotiation, SDP offers/answers, and ICE candidate exchange.
    Actual voice audio flows peer-to-peer over WebRTC.
    """
    def __init__(self):
        # Mapping: room_id -> {client_id: WebSocket}
        self.rooms: Dict[str, Dict[str, WebSocket]] = {}

    async def connect(self, room_id: str, client_id: str, websocket: WebSocket):
        await websocket.accept()
        if room_id not in self.rooms:
            self.rooms[room_id] = {}
            
        existing_peers = list(self.rooms[room_id].keys())
        self.rooms[room_id][client_id] = websocket
        
        logger.info(f"[Signaling] Client {client_id} joined room {room_id}. Existing peers: {existing_peers}")
        
        # Notify the new peer about current room state & ICE server configurations
        await websocket.send_text(json.dumps({
            "type": "room_joined",
            "room_id": room_id,
            "client_id": client_id,
            "peers": existing_peers,
            "ice_servers": settings.ICE_SERVERS
        }))
        
        # Notify existing peers that a new peer joined
        for pid, peer_ws in self.rooms[room_id].items():
            if pid != client_id:
                try:
                    await peer_ws.send_text(json.dumps({
                        "type": "peer_joined",
                        "peer_id": client_id
                    }))
                except Exception as e:
                    logger.warning(f"Failed to send peer_joined to {pid}: {e}")

    async def disconnect(self, room_id: str, client_id: str):
        if room_id in self.rooms:
            self.rooms[room_id].pop(client_id, None)
            logger.info(f"[Signaling] Client {client_id} left room {room_id}")
            
            # Notify remaining peers
            remaining = list(self.rooms[room_id].keys())
            for pid, peer_ws in self.rooms[room_id].items():
                try:
                    await peer_ws.send_text(json.dumps({
                        "type": "peer_left",
                        "peer_id": client_id
                    }))
                except Exception:
                    pass
                    
            if not self.rooms[room_id]:
                del self.rooms[room_id]

    async def send_to_peer(self, room_id: str, target_peer_id: str, message: dict):
        if room_id in self.rooms and target_peer_id in self.rooms[room_id]:
            ws = self.rooms[room_id][target_peer_id]
            await ws.send_text(json.dumps(message))
        else:
            logger.warning(f"Target peer {target_peer_id} not found in room {room_id}")

room_manager = RoomManager()

@router.websocket("/{room_id}/{client_id}")
async def signaling_endpoint(websocket: WebSocket, room_id: str, client_id: str):
    await room_manager.connect(room_id, client_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
            except json.JSONDecodeError:
                continue

            msg_type = msg.get("type")
            target = msg.get("target")

            # Route SDP offer, answer, or ICE candidate to the intended peer
            if msg_type in ("offer", "answer", "ice_candidate"):
                if target:
                    msg["sender"] = client_id
                    await room_manager.send_to_peer(room_id, target, msg)
                    
            elif msg_type == "leave":
                break

    except (WebSocketDisconnect, RuntimeError):
        pass
    except Exception as e:
        logger.error(f"Signaling error for {client_id} in {room_id}: {e}")
    finally:
        await room_manager.disconnect(room_id, client_id)
