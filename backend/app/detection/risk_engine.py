from dataclasses import dataclass, field
from typing import Optional
from ..config import settings

@dataclass
class RiskPolicy:
    """
    Application-level risk policy configuration.
    Note: These are application decision rules, completely separate from
    the model's internal per-chunk score threshold.
    """
    suspected_spoof_chunks: int = settings.POLICY_SPOOF_CHUNKS_FOR_SUSPECTED
    alert_consecutive_spoof_chunks: int = settings.POLICY_CONSECUTIVE_SPOOF_FOR_ALERT

@dataclass
class ChunkRecord:
    chunk_index: int
    start_time: float
    end_time: float
    score: float
    label: str  # "spoof" or "bonafide"
    inference_time_ms: float

class CallSessionRiskTracker:
    """
    Maintains chunk evaluation history and evaluates application-level risk
    for a live browser-to-browser voice call session.
    """
    def __init__(self, session_id: str, policy: Optional[RiskPolicy] = None):
        self.session_id = session_id
        self.policy = policy or RiskPolicy()
        self.history: list[ChunkRecord] = []
        self.total_chunks: int = 0
        self.spoof_chunks: int = 0
        self.bonafide_chunks: int = 0
        self.consecutive_spoof: int = 0
        self.max_consecutive_spoof: int = 0
        self.lowest_score: Optional[float] = None
        self.latest_score: Optional[float] = None

    def update_policy(self, suspected_chunks: int, alert_consecutive: int):
        self.policy.suspected_spoof_chunks = max(1, suspected_chunks)
        self.policy.alert_consecutive_spoof_chunks = max(1, alert_consecutive)

    def add_chunk(self, chunk_index: int, start_time: float, end_time: float, score: float, label: str, latency_ms: float) -> dict:
        record = ChunkRecord(
            chunk_index=chunk_index,
            start_time=start_time,
            end_time=end_time,
            score=score,
            label=label,
            inference_time_ms=latency_ms
        )
        self.history.append(record)
        self.total_chunks += 1
        self.latest_score = score
        if self.lowest_score is None or score < self.lowest_score:
            self.lowest_score = score

        if label == "spoof":
            self.spoof_chunks += 1
            self.consecutive_spoof += 1
            if self.consecutive_spoof > self.max_consecutive_spoof:
                self.max_consecutive_spoof = self.consecutive_spoof
        else:
            self.bonafide_chunks += 1
            self.consecutive_spoof = 0

        risk_state = self.evaluate_risk()
        return {
            "chunk": {
                "chunk_index": chunk_index,
                "start_time": start_time,
                "end_time": end_time,
                "score": score,
                "label": label,
                "inference_time_ms": latency_ms
            },
            "session_summary": {
                "total_chunks": self.total_chunks,
                "spoof_chunks": self.spoof_chunks,
                "bonafide_chunks": self.bonafide_chunks,
                "consecutive_spoof": self.consecutive_spoof,
                "max_consecutive_spoof": self.max_consecutive_spoof,
                "latest_score": self.latest_score,
                "lowest_score": self.lowest_score
            },
            "risk_state": risk_state
        }

    def evaluate_risk(self) -> dict:
        """
        Determines voice integrity risk based on the application policy.
        """
        if self.total_chunks == 0:
            return {
                "status": "INITIALIZING",
                "risk_level": "LOW",
                "title": "Awaiting Voice Stream",
                "description": "Listening for incoming voice packets...",
                "badge_color": "gray"
            }

        # Rule 1: Sustained spoof chunks over policy limit -> Critical alert
        if self.consecutive_spoof >= self.policy.alert_consecutive_spoof_chunks:
            return {
                "status": "AI_VOICE_CLONE_DETECTED",
                "risk_level": "CRITICAL",
                "title": "AI Voice Clone Detected",
                "description": f"Sustained synthetic speech patterns detected across {self.consecutive_spoof} consecutive 4s chunks.",
                "badge_color": "red"
            }

        # Rule 2: At least suspected_spoof_chunks flagged -> Warning
        if self.spoof_chunks >= self.policy.suspected_spoof_chunks:
            return {
                "status": "SYNTHETIC_VOICE_SUSPECTED",
                "risk_level": "HIGH",
                "title": "Synthetic Voice Suspected",
                "description": f"Voice authenticity dropped below threshold in {self.spoof_chunks} of {self.total_chunks} analyzed chunks.",
                "badge_color": "orange"
            }

        # Rule 3: All analyzed chunks are authentic
        return {
            "status": "VOICE_INTEGRITY_NORMAL",
            "risk_level": "NORMAL",
            "title": "Voice Integrity Verified",
            "description": f"All {self.total_chunks} analyzed voice chunks verified authentic.",
            "badge_color": "green"
        }
