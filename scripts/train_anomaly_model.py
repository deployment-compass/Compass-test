#!/usr/bin/env python3
"""
Train a baseline anomaly detection model (Isolation Forest) on collected JSONL data.
"""

import argparse
import json
import logging
import pickle
import sys
from collections import defaultdict
import math

try:
    from sklearn.ensemble import IsolationForest
    import numpy as np
except ImportError:
    print("Error: scikit-learn and numpy are required.")
    print("Install via: pip install scikit-learn numpy")
    sys.exit(1)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Features we expect to extract from the context
FEATURE_KEYS = [
    "request_rate",
    "error_rate",
    "p95_latency",
    "cpu_usage",
    "memory_usage",
]

def extract_features(context: dict) -> list[float]:
    """Extract a flat feature vector from a single service context."""
    vec = []
    for key in FEATURE_KEYS:
        val = context.get(key)
        # Handle None or missing by imputing 0.0 (or you could use mean imputation in a real pipeline)
        if val is None or math.isnan(val):
            vec.append(0.0)
        else:
            vec.append(float(val))
    return vec

def load_data(filepath: str) -> dict[str, list[list[float]]]:
    """
    Read JSONL lines containing BatchContextResponse outputs.
    Returns a dict mapping service name -> list of feature vectors.
    """
    data_by_service = defaultdict(list)
    count = 0
    with open(filepath, 'r') as f:
        for line in f:
            if not line.strip():
                continue
            try:
                batch = json.loads(line)
                results = batch.get("results", {})
                for svc, data in results.items():
                    ctx = data.get("context", {})
                    features = extract_features(ctx)
                    data_by_service[svc].append(features)
                count += 1
            except Exception as e:
                logger.warning(f"Failed to parse line: {e}")
                
    logger.info(f"Loaded {count} batch samples.")
    return dict(data_by_service)

def train_models(data_by_service: dict[str, list[list[float]]], output_prefix: str):
    """Train an Isolation Forest per service."""
    for svc, vectors in data_by_service.items():
        if len(vectors) < 10:
            logger.warning(f"Skipping {svc}: not enough data ({len(vectors)} samples)")
            continue
            
        logger.info(f"Training model for '{svc}' with {len(vectors)} samples...")
        X = np.array(vectors)
        
        # Fit Isolation Forest
        clf = IsolationForest(contamination=0.05, random_state=42)
        clf.fit(X)
        
        # Save model
        filename = f"{output_prefix}_{svc}.pkl"
        with open(filename, 'wb') as f:
            pickle.dump(clf, f)
            
        logger.info(f"Saved model to {filename}")

def main():
    parser = argparse.ArgumentParser(description="Train anomaly detection models from JSONL contexts.")
    parser.add_argument("--input", default="training_data.jsonl", help="Input JSONL file")
    parser.add_argument("--output-prefix", default="anomaly_model", help="Prefix for output .pkl files")
    args = parser.parse_args()

    data = load_data(args.input)
    if not data:
        logger.error("No valid data loaded. Exiting.")
        sys.exit(1)
        
    train_models(data, args.output_prefix)
    logger.info("Done.")

if __name__ == "__main__":
    main()
