"""FastAPI service that loads the Joblib model and serves predictions.

Run with:
    ml-service/.venv/Scripts/python -m uvicorn app:app --app-dir ml-service --port 8000
"""
from __future__ import annotations

import json
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, ConfigDict, Field

BASE = Path(__file__).resolve().parent
ARTIFACT_DIR = BASE / "artifacts"
MODEL_PATH = ARTIFACT_DIR / "student_performance_model.joblib"
METADATA_PATH = ARTIFACT_DIR / "model_metadata.json"
METRICS_PATH = BASE / "model_metrics.json"

_lock = threading.Lock()
_cache = {"model": None, "metadata": None, "loaded_at": None}


class PredictRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    attendance: float = Field(ge=0, le=100)
    internal_marks: float = Field(ge=0, le=100)
    study_hours: float = Field(ge=0, le=168)
    previous_marks: float = Field(ge=0, le=100)


def load_assets(force: bool = False):
    with _lock:
        if _cache["model"] is not None and not force:
            return _cache["model"], _cache["metadata"]
        if not MODEL_PATH.exists():
            raise HTTPException(
                status_code=503,
                detail={
                    "code": "MODEL_NOT_TRAINED",
                    "message": "Model artifact not found. Run ml-service/train_model.py first."
                }
            )
        if not METADATA_PATH.exists():
            raise HTTPException(
                status_code=503,
                detail={"code": "MODEL_METADATA_MISSING", "message": "Model metadata file is missing."}
            )
        _cache["model"] = joblib.load(MODEL_PATH)
        _cache["metadata"] = json.loads(METADATA_PATH.read_text(encoding="utf-8"))
        _cache["loaded_at"] = datetime.now(timezone.utc).isoformat()
        return _cache["model"], _cache["metadata"]


app = FastAPI(
    title="Student Performance ML Service",
    version="1.0.0",
    docs_url="/docs",
    redoc_url=None
)


@app.get("/health")
def health():
    loaded = _cache["model"] is not None
    if not loaded and MODEL_PATH.exists():
        try:
            load_assets()
            loaded = True
        except HTTPException:
            loaded = False
    return {
        "status": "ok" if loaded else "model_unavailable",
        "model_loaded": loaded,
        "artifact": MODEL_PATH.name,
        "is_prototype": True,
        "university_validated": False
    }


@app.get("/metadata")
def metadata():
    _, meta = load_assets()
    return meta


@app.get("/metrics")
def metrics():
    if not METRICS_PATH.exists():
        raise HTTPException(status_code=503, detail={"code": "METRICS_MISSING", "message": "Metrics file is missing."})
    return json.loads(METRICS_PATH.read_text(encoding="utf-8"))


@app.post("/predict")
def predict(payload: PredictRequest):
    model, meta = load_assets()
    feature_keys = [f["key"] for f in meta["features"]]
    values: Dict[str, float] = payload.model_dump()
    frame = pd.DataFrame([[values[key] for key in feature_keys]], columns=feature_keys)
    try:
        prediction = float(model.predict(frame)[0])
    except Exception as exc:  # noqa: BLE001 - surface a clean error to Node
        raise HTTPException(
            status_code=500,
            detail={"code": "PREDICTION_FAILED", "message": f"Model prediction failed: {type(exc).__name__}"}
        ) from exc

    predicted_marks = round(max(0.0, min(100.0, prediction)), 2)
    return {
        "predicted_marks": predicted_marks,
        "model_used": meta["active_model"],
        "model_version": meta["model_version"],
        "is_mock": False,
        "is_prototype": True,
        "university_validated": meta.get("university_validated", False),
        "features_used": feature_keys,
        "feature_values": values,
        "predicted_at": datetime.now(timezone.utc).isoformat()
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=False)
