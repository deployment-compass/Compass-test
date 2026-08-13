#!/usr/bin/env bash
# Deletes the EKS cluster and everything in it. Run this when you're
# done for the day/week to stop being billed. There is no "pause" for
# EKS the way there's no cost for a stopped kind cluster on your laptop
# -- the control plane bills hourly whether or not you're using it.
set -euo pipefail
eksctl delete cluster -f cluster.yaml
echo "Cluster deleted. Billing for the cluster itself stops now."
