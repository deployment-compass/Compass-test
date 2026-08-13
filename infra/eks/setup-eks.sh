#!/usr/bin/env bash
# Provisions the real EKS cluster and the one add-on it needs to make
# Ingress work: the AWS Load Balancer Controller (this is what actually
# creates a real Application Load Balancer in AWS when you apply an
# Ingress resource).
#
# Prereqs: awscli (configured with `aws configure`), eksctl, kubectl, helm.
# This step COSTS MONEY the moment the cluster exists — see
# docs/production-architecture.md for rough pricing. Delete it with
# teardown-eks.sh when you're not actively using it.
set -euo pipefail

echo "Creating EKS cluster (takes ~15-20 minutes)..."
eksctl create cluster -f cluster.yaml

echo "Cluster created. Configuring kubectl..."
aws eks update-kubeconfig --name compass-prod --region us-east-1

echo "Installing the AWS Load Balancer Controller (needed for Ingress)..."
eksctl utils associate-iam-oidc-provider --cluster compass-prod --approve

curl -o iam-policy.json https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/main/docs/install/iam_policy.json
aws iam create-policy \
  --policy-name AWSLoadBalancerControllerIAMPolicy \
  --policy-document file://iam-policy.json || true

eksctl create iamserviceaccount \
  --cluster=compass-prod \
  --namespace=kube-system \
  --name=aws-load-balancer-controller \
  --attach-policy-arn=arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):policy/AWSLoadBalancerControllerIAMPolicy \
  --override-existing-serviceaccounts \
  --approve

helm repo add eks https://aws.github.io/eks-charts >/dev/null 2>&1 || true
helm repo update
helm upgrade --install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=compass-prod \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller

echo ""
echo "EKS cluster ready. Next: install Argo CD (see infra/argocd/install-argocd.sh)"
