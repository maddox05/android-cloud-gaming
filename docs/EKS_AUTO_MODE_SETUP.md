# EKS Auto Mode Setup Guide for Android Cloud Gaming

This guide covers deploying your android-cloud-gaming platform to Amazon EKS with Auto Mode enabled.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Caveats for Cloud Gaming](#caveats-for-cloud-gaming)
- [Step 1: AWS Account Setup](#step-1-aws-account-setup)
- [Step 2: Create ECR Repositories](#step-2-create-ecr-repositories)
- [Step 3: Code Changes](#step-3-code-changes)
- [Step 4: Build and Push Docker Images](#step-4-build-and-push-docker-images)
- [Step 5: Create EKS Cluster](#step-5-create-eks-cluster)
- [Step 6: Deploy Kubernetes Resources](#step-6-deploy-kubernetes-resources)
- [Step 7: Verify Deployment](#step-7-verify-deployment)
- [Cost Considerations](#cost-considerations)
- [Scaling Configuration](#scaling-configuration)
- [Monitoring and Debugging](#monitoring-and-debugging)
- [Security Considerations](#security-considerations)
- [Troubleshooting](#troubleshooting)
- [Sources](#sources)

---

## Architecture Overview

```
                                    Internet
                                        │
                                        ▼
                              ┌─────────────────┐
                              │  AWS ALB        │
                              │  (Auto Mode)    │
                              └────────┬────────┘
                                       │
            ┌──────────────────────────┼──────────────────────────┐
            │                   EKS Cluster                       │
            │                                                     │
            │  ┌─────────────────────────────────────────────┐   │
            │  │           Signal Server (2 replicas)        │   │
            │  │  - Manages WebRTC signaling                 │   │
            │  │  - Creates/deletes gaming pods via K8s API  │   │
            │  │  - Maintains warm pool of 3 pods            │   │
            │  └─────────────────────────────────────────────┘   │
            │                         │                           │
            │          K8s API calls  │  WebSocket connections    │
            │                         ▼                           │
            │  ┌─────────────────────────────────────────────┐   │
            │  │         Gaming Pods (1 per player)          │   │
            │  │  ┌─────────┐  ┌─────────┐  ┌────────────┐   │   │
            │  │  │ worker  │◄─┤   ADB   │◄─┤  redroid   │   │   │
            │  │  │ (WebRTC)│  │ bridge  │  │ (Android)  │   │   │
            │  │  └─────────┘  └─────────┘  └────────────┘   │   │
            │  └─────────────────────────────────────────────┘   │
            │                                                     │
            │  EKS Auto Mode handles:                            │
            │  - EC2 provisioning when pods need nodes           │
            │  - Bin-packing multiple pods per node              │
            │  - Scale-down when pods are deleted                │
            │  - Load balancer provisioning                      │
            └─────────────────────────────────────────────────────┘
```

---

## Prerequisites

### Tools Required

| Tool | Version | Purpose |
|------|---------|---------|
| AWS CLI | v2.x | AWS resource management |
| eksctl | v0.170+ | EKS cluster creation |
| kubectl | v1.29+ | Kubernetes management |
| Docker | 20.x+ | Building container images |
| Node.js | 20.x | Local development |

### Install Commands

```bash
# AWS CLI (Linux)
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# eksctl
curl --silent --location "https://github.com/weaveworks/eksctl/releases/latest/download/eksctl_$(uname -s)_amd64.tar.gz" | tar xz -C /tmp
sudo mv /tmp/eksctl /usr/local/bin

# kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
```

### AWS Permissions Required

Your IAM user/role needs these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "eks:*",
        "ec2:*",
        "ecr:*",
        "iam:CreateRole",
        "iam:AttachRolePolicy",
        "iam:PutRolePolicy",
        "iam:PassRole",
        "iam:CreateServiceLinkedRole",
        "cloudformation:*",
        "elasticloadbalancing:*"
      ],
      "Resource": "*"
    }
  ]
}
```

---

## Caveats for Cloud Gaming

### 1. Privileged Containers (redroid)

**Issue:** redroid requires `privileged: true` to run the Android kernel.

**Impact:**
- EKS Auto Mode supports privileged containers, but they run with elevated permissions
- You cannot use Fargate (serverless) - must use EC2-backed nodes
- Security scanning tools will flag this

**Mitigation:**
- Use dedicated NodePools for gaming workloads
- Apply strict NetworkPolicies
- Use separate namespace with RBAC restrictions

### 2. Architecture Support (ARM64 Recommended)

**Good news:** redroid supports both `amd64` and `arm64` architectures.

**Recommendation:** Use AWS Graviton (ARM64) instances for ~20% cost savings.

**Configuration:**
```yaml
# In NodePool spec - prefer Graviton for cost savings
requirements:
  - key: kubernetes.io/arch
    operator: In
    values: ["arm64", "amd64"]  # Prefer arm64 (Graviton)
```

**Note:** Your worker image must also be built for ARM64. Use multi-arch builds:
```bash
docker buildx build --platform linux/amd64,linux/arm64 -t worker .
```

### 3. WebRTC and Networking

**Issue:** WebRTC requires STUN/TURN for NAT traversal.

**Considerations:**
- Public STUN servers (like Google's) work for most cases
- For users behind strict NAT/firewalls, you need a TURN server
- Consider deploying [coturn](https://github.com/coturn/coturn) or using [Twilio TURN](https://www.twilio.com/docs/stun-turn)

**Current config in your code:**
```typescript
// worker/main.ts
const pc = new RTCPeerConnection({
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
});
```

**Production recommendation:**
```typescript
const pc = new RTCPeerConnection({
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    {
      urls: "turn:your-turn-server.com:3478",
      username: "user",
      credential: "pass"
    }
  ],
});
```

### 4. Session Stickiness

**Issue:** Each player needs a dedicated redroid instance.

**Solution:** Your signal server creates one pod per player session. This is handled by the session management code (see [Step 3](#step-3-code-changes)).

### 5. Cold Start Latency

**Issue:** Starting a new gaming pod takes 30-60 seconds (container pull + Android boot).

**Mitigation:**
- Maintain a warm pool of pre-started pods (covered in this guide)
- Use ECR in the same region to minimize pull time
- Consider pre-pulling images to nodes

### 6. Resource Requirements

**Estimated per gaming session:**

| Component | CPU Request | Memory Request | CPU Limit | Memory Limit |
|-----------|-------------|----------------|-----------|--------------|
| worker | 500m | 512Mi | 1000m | 1Gi |
| redroid | 1500m | 2Gi | 2000m | 3Gi |
| **Total** | **2 CPU** | **2.5Gi** | **3 CPU** | **4Gi** |

**Instance sizing:**
- `m7g.xlarge` (4 vCPU, 16GB, Graviton): ~1-2 sessions, **~20% cheaper**
- `m7g.2xlarge` (8 vCPU, 32GB, Graviton): ~3-4 sessions, **~20% cheaper**
- `m6i.xlarge` (4 vCPU, 16GB, Intel): ~1-2 gaming sessions
- `m6i.2xlarge` (8 vCPU, 32GB, Intel): ~3-4 gaming sessions

### 7. No GPU by Default

**Issue:** redroid uses software rendering by default.

**If you need GPU acceleration:**
- Use `g4dn` or `g5` instance types
- Configure GPU resource requests
- Use redroid GPU-enabled images

```yaml
# GPU-enabled pod (optional)
resources:
  limits:
    nvidia.com/gpu: 1
```

### 8. Data Persistence

**Issue:** Android app data is lost when pod terminates.

**Options:**
1. **Ephemeral (current):** Each session starts fresh
2. **Persistent:** Use EBS volumes per user (more complex, higher cost)

```yaml
# For persistent sessions (optional)
volumes:
  - name: android-data
    persistentVolumeClaim:
      claimName: user-123-data
```

---

## Step 1: AWS Account Setup

### Configure AWS CLI

```bash
aws configure
# Enter your AWS Access Key ID
# Enter your AWS Secret Access Key
# Default region: us-west-2 (or your preferred region)
# Default output format: json
```

### Verify Configuration

```bash
aws sts get-caller-identity
```

Expected output:
```json
{
    "UserId": "AIDAXXXXXXXXXXXXXXXXX",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/your-username"
}
```

---

## Step 2: Create ECR Repositories

```bash
# Set your AWS account ID and region
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export AWS_REGION=us-west-2

# Create repositories
aws ecr create-repository --repository-name android-cloud-gaming/signal --region $AWS_REGION
aws ecr create-repository --repository-name android-cloud-gaming/worker --region $AWS_REGION

# Login to ECR
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com
```

---

## Step 3: Code Changes

### 3.1 Update Signal Server

Create a new file `signal/signal-k8s.ts` (or modify `signal/signal.ts`):

```typescript
import { WebSocketServer, WebSocket } from "ws";
import * as k8s from "@kubernetes/client-node";
import type {
  SignalMessage,
  StartMessage,
  ErrorMessage,
  ClientDisconnectedMessage,
} from "../shared/types.js";

// Environment configuration
const PORT = parseInt(process.env.SIGNAL_PORT || "6969", 10);
const NAMESPACE = process.env.NAMESPACE || "gaming";
const WORKER_IMAGE = process.env.WORKER_IMAGE!;
const REDROID_IMAGE = process.env.REDROID_IMAGE || "redroid/redroid:12.0.0-latest";
const WARM_POOL_TARGET = parseInt(process.env.WARM_POOL_SIZE || "3", 10);

// Kubernetes client setup
const kc = new k8s.KubeConfig();
if (process.env.NODE_ENV === "development") {
  kc.loadFromDefault();  // Uses ~/.kube/config
} else {
  kc.loadFromCluster();  // Uses service account token in-cluster
}
const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

// Session tracking
interface Session {
  pod: WebSocket | null;
  client: WebSocket | null;
  podName: string;
  createdAt: Date;
}

const sessions = new Map<string, Session>();
const warmPods = new Map<string, WebSocket>();  // podName -> ws

const wss = new WebSocketServer({ port: PORT });

wss.on("connection", async (ws, req) => {
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);
  const role = url.searchParams.get("role");
  const sessionId = url.searchParams.get("session");
  const podName = url.searchParams.get("podName");
  const status = url.searchParams.get("status");

  // Warm pod connecting
  if (role === "pod" && status === "warm" && podName) {
    warmPods.set(podName, ws);
    console.log(`[WARM] Pod ${podName} connected. Pool: ${warmPods.size}/${WARM_POOL_TARGET}`);

    ws.on("close", () => {
      warmPods.delete(podName);
      console.log(`[WARM] Pod ${podName} disconnected. Pool: ${warmPods.size}/${WARM_POOL_TARGET}`);
      replenishWarmPool();
    });

    ws.on("error", (err) => console.error(`[WARM] Pod ${podName} error:`, err));
    return;
  }

  // Active pod connecting for a session
  if (role === "pod" && sessionId) {
    const session = sessions.get(sessionId);
    if (session) {
      session.pod = ws;
      console.log(`[SESSION] Pod connected for session ${sessionId}`);

      // If client is already waiting, tell pod to start
      if (session.client && session.client.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "start" } as StartMessage));
      }

      ws.on("message", (data) => {
        const msg: SignalMessage = JSON.parse(data.toString());
        console.log(`[SESSION ${sessionId}] Pod ->`, msg.type);
        if (session.client?.readyState === WebSocket.OPEN) {
          session.client.send(data.toString());
        }
      });

      ws.on("close", () => {
        console.log(`[SESSION] Pod disconnected for session ${sessionId}`);
        cleanupSession(sessionId);
      });
    }
    return;
  }

  // Browser client connecting
  console.log("[CLIENT] New client connection");

  // Try to assign a warm pod first
  if (warmPods.size > 0) {
    const [warmPodName, warmPodWs] = warmPods.entries().next().value;
    warmPods.delete(warmPodName);

    const sessionId = crypto.randomUUID();
    sessions.set(sessionId, {
      pod: warmPodWs,
      client: ws,
      podName: warmPodName,
      createdAt: new Date(),
    });

    console.log(`[CLIENT] Assigned warm pod ${warmPodName} to session ${sessionId}`);

    // Update pod's session context
    warmPodWs.send(JSON.stringify({ type: "session-assigned", sessionId }));
    warmPodWs.send(JSON.stringify({ type: "start" } as StartMessage));
    ws.send(JSON.stringify({ type: "session-created", sessionId }));

    // Replenish the warm pool
    replenishWarmPool();

    setupClientHandlers(ws, sessionId, warmPodWs);
  } else {
    // No warm pods available - create on demand
    const sessionId = crypto.randomUUID();
    const podName = `gaming-${sessionId.slice(0, 8)}`;

    sessions.set(sessionId, {
      pod: null,
      client: ws,
      podName,
      createdAt: new Date(),
    });

    console.log(`[CLIENT] No warm pods, creating ${podName} for session ${sessionId}`);
    ws.send(JSON.stringify({ type: "session-creating", sessionId, message: "Starting gaming session..." }));

    try {
      await createGamingPod(podName, sessionId);
      ws.send(JSON.stringify({ type: "session-created", sessionId }));
    } catch (err) {
      console.error(`[CLIENT] Failed to create pod:`, err);
      ws.send(JSON.stringify({ type: "error", message: "Failed to create gaming session" } as ErrorMessage));
      sessions.delete(sessionId);
      ws.close();
      return;
    }

    setupClientHandlers(ws, sessionId, null);
  }
});

function setupClientHandlers(ws: WebSocket, sessionId: string, podWs: WebSocket | null) {
  ws.on("message", (data) => {
    const session = sessions.get(sessionId);
    const msg: SignalMessage = JSON.parse(data.toString());
    console.log(`[SESSION ${sessionId}] Client ->`, msg.type);

    if (session?.pod?.readyState === WebSocket.OPEN) {
      session.pod.send(data.toString());
    }
  });

  ws.on("close", () => {
    console.log(`[CLIENT] Client disconnected from session ${sessionId}`);
    cleanupSession(sessionId);
  });

  ws.on("error", (err) => console.error(`[CLIENT] Error in session ${sessionId}:`, err));
}

async function cleanupSession(sessionId: string) {
  const session = sessions.get(sessionId);
  if (!session) return;

  // Notify pod if still connected
  if (session.pod?.readyState === WebSocket.OPEN) {
    session.pod.send(JSON.stringify({ type: "client-disconnected" } as ClientDisconnectedMessage));
  }

  // Delete the pod
  try {
    await k8sApi.deleteNamespacedPod({ name: session.podName, namespace: NAMESPACE });
    console.log(`[CLEANUP] Deleted pod ${session.podName}`);
  } catch (err: any) {
    if (err.response?.statusCode !== 404) {
      console.error(`[CLEANUP] Failed to delete pod ${session.podName}:`, err);
    }
  }

  sessions.delete(sessionId);
}

async function createGamingPod(name: string, sessionId: string) {
  const signalUrl = `ws://signal-service:${PORT}?role=pod&session=${sessionId}`;

  const pod: k8s.V1Pod = {
    metadata: {
      name,
      namespace: NAMESPACE,
      labels: {
        app: "gaming-session",
        sessionId,
      },
    },
    spec: {
      restartPolicy: "Never",
      containers: [
        {
          name: "worker",
          image: WORKER_IMAGE,
          env: [
            { name: "SIGNAL_URL", value: signalUrl },
            { name: "REDROID_HOST", value: "localhost" },
            { name: "REDROID_WIDTH", value: process.env.REDROID_WIDTH || "720" },
            { name: "REDROID_HEIGHT", value: process.env.REDROID_HEIGHT || "1280" },
          ],
          resources: {
            requests: { cpu: "500m", memory: "512Mi" },
            limits: { cpu: "1000m", memory: "1Gi" },
          },
        },
        {
          name: "redroid",
          image: REDROID_IMAGE,
          securityContext: { privileged: true },
          args: [
            `androidboot.redroid_width=${process.env.REDROID_WIDTH || "720"}`,
            `androidboot.redroid_height=${process.env.REDROID_HEIGHT || "1280"}`,
            "androidboot.redroid_dpi=320",
            "androidboot.redroid_fps=60",
          ],
          resources: {
            requests: { cpu: "1500m", memory: "2Gi" },
            limits: { cpu: "2000m", memory: "3Gi" },
          },
          volumeMounts: [
            { name: "dev-binderfs", mountPath: "/dev/binderfs" },
          ],
        },
      ],
      volumes: [
        {
          name: "dev-binderfs",
          hostPath: { path: "/dev/binderfs", type: "Directory" },
        },
      ],
    },
  };

  await k8sApi.createNamespacedPod({ namespace: NAMESPACE, body: pod });
}

async function createWarmPod(name: string) {
  const signalUrl = `ws://signal-service:${PORT}?role=pod&status=warm&podName=${name}`;

  const pod: k8s.V1Pod = {
    metadata: {
      name,
      namespace: NAMESPACE,
      labels: {
        app: "gaming-session",
        status: "warm",
      },
    },
    spec: {
      restartPolicy: "Never",
      containers: [
        {
          name: "worker",
          image: WORKER_IMAGE,
          env: [
            { name: "SIGNAL_URL", value: signalUrl },
            { name: "REDROID_HOST", value: "localhost" },
            { name: "REDROID_WIDTH", value: process.env.REDROID_WIDTH || "720" },
            { name: "REDROID_HEIGHT", value: process.env.REDROID_HEIGHT || "1280" },
          ],
          resources: {
            requests: { cpu: "500m", memory: "512Mi" },
            limits: { cpu: "1000m", memory: "1Gi" },
          },
        },
        {
          name: "redroid",
          image: REDROID_IMAGE,
          securityContext: { privileged: true },
          args: [
            `androidboot.redroid_width=${process.env.REDROID_WIDTH || "720"}`,
            `androidboot.redroid_height=${process.env.REDROID_HEIGHT || "1280"}`,
            "androidboot.redroid_dpi=320",
            "androidboot.redroid_fps=60",
          ],
          resources: {
            requests: { cpu: "1500m", memory: "2Gi" },
            limits: { cpu: "2000m", memory: "3Gi" },
          },
          volumeMounts: [
            { name: "dev-binderfs", mountPath: "/dev/binderfs" },
          ],
        },
      ],
      volumes: [
        {
          name: "dev-binderfs",
          hostPath: { path: "/dev/binderfs", type: "Directory" },
        },
      ],
    },
  };

  await k8sApi.createNamespacedPod({ namespace: NAMESPACE, body: pod });
}

async function replenishWarmPool() {
  const needed = WARM_POOL_TARGET - warmPods.size;
  if (needed <= 0) return;

  console.log(`[WARM] Replenishing pool: creating ${needed} pods`);

  for (let i = 0; i < needed; i++) {
    const podName = `warm-${crypto.randomUUID().slice(0, 8)}`;
    try {
      await createWarmPod(podName);
      console.log(`[WARM] Created pod ${podName}`);
    } catch (err) {
      console.error(`[WARM] Failed to create pod ${podName}:`, err);
    }
  }
}

async function reconcileOnStartup() {
  console.log("[STARTUP] Reconciling state with Kubernetes...");

  try {
    // Find existing warm pods
    const { body } = await k8sApi.listNamespacedPod({
      namespace: NAMESPACE,
      labelSelector: "app=gaming-session,status=warm",
    });

    console.log(`[STARTUP] Found ${body.items.length} existing warm pods`);

    // Clean up any orphaned gaming pods (no active session)
    const activePods = await k8sApi.listNamespacedPod({
      namespace: NAMESPACE,
      labelSelector: "app=gaming-session",
    });

    for (const pod of activePods.body.items) {
      const podSessionId = pod.metadata?.labels?.sessionId;
      if (podSessionId && !sessions.has(podSessionId)) {
        console.log(`[STARTUP] Cleaning up orphaned pod ${pod.metadata?.name}`);
        try {
          await k8sApi.deleteNamespacedPod({
            name: pod.metadata!.name!,
            namespace: NAMESPACE,
          });
        } catch (err) {
          console.error(`[STARTUP] Failed to delete orphaned pod:`, err);
        }
      }
    }

    // Replenish warm pool
    await replenishWarmPool();
  } catch (err) {
    console.error("[STARTUP] Reconciliation failed:", err);
  }
}

// Start the server
console.log(`[STARTUP] Signal server starting on port ${PORT}`);
reconcileOnStartup();
console.log(`[STARTUP] Signal server ready`);
```

### 3.2 Update Signal package.json

Add the Kubernetes client dependency:

```bash
cd signal
npm install @kubernetes/client-node
```

### 3.3 Update Signal Dockerfile

```dockerfile
FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY *.ts ./
COPY tsconfig.json ./

# The K8s client needs ca-certificates for TLS
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

CMD ["npx", "tsx", "signal-k8s.ts"]
```

---

## Step 4: Build and Push Docker Images

```bash
# Set variables
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export AWS_REGION=us-west-2

# Login to ECR
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Build and push signal server
docker build -t android-cloud-gaming/signal ./signal
docker tag android-cloud-gaming/signal:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/android-cloud-gaming/signal:latest
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/android-cloud-gaming/signal:latest

# Build and push worker
docker build -t android-cloud-gaming/worker ./worker
docker tag android-cloud-gaming/worker:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/android-cloud-gaming/worker:latest
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/android-cloud-gaming/worker:latest
```

---

## Step 5: Create EKS Cluster

### 5.1 Create Cluster Config

Create `k8s/cluster.yaml`:

```yaml
apiVersion: eksctl.io/v1alpha5
kind: ClusterConfig

metadata:
  name: android-cloud-gaming
  region: us-west-2
  version: "1.31"

# Enable EKS Auto Mode
autoModeConfig:
  enabled: true

# IAM OIDC provider for service accounts
iam:
  withOIDC: true

# VPC configuration (optional - eksctl creates one by default)
# vpc:
#   id: vpc-xxxxxxxx
#   subnets:
#     private:
#       us-west-2a: { id: subnet-aaaa }
#       us-west-2b: { id: subnet-bbbb }
```

### 5.2 Create the Cluster

```bash
# This takes 15-20 minutes
eksctl create cluster -f k8s/cluster.yaml

# Verify connection
kubectl get nodes
```

---

## Step 6: Deploy Kubernetes Resources

### 6.1 Create Namespace

Create `k8s/namespace.yaml`:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: gaming
```

### 6.2 Create RBAC for Signal Server

Create `k8s/rbac.yaml`:

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: signal-server
  namespace: gaming
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-manager
  namespace: gaming
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["create", "delete", "get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: signal-pod-manager
  namespace: gaming
subjects:
  - kind: ServiceAccount
    name: signal-server
    namespace: gaming
roleRef:
  kind: Role
  name: pod-manager
  apiGroup: rbac.authorization.k8s.io
```

### 6.3 Create Signal Server Deployment

Create `k8s/signal-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: signal-server
  namespace: gaming
spec:
  replicas: 2
  selector:
    matchLabels:
      app: signal-server
  template:
    metadata:
      labels:
        app: signal-server
    spec:
      serviceAccountName: signal-server
      containers:
        - name: signal
          image: <AWS_ACCOUNT_ID>.dkr.ecr.<AWS_REGION>.amazonaws.com/android-cloud-gaming/signal:latest
          ports:
            - containerPort: 6969
          env:
            - name: SIGNAL_PORT
              value: "6969"
            - name: NAMESPACE
              value: "gaming"
            - name: WORKER_IMAGE
              value: "<AWS_ACCOUNT_ID>.dkr.ecr.<AWS_REGION>.amazonaws.com/android-cloud-gaming/worker:latest"
            - name: REDROID_IMAGE
              value: "redroid/redroid:12.0.0-latest"
            - name: WARM_POOL_SIZE
              value: "3"
            - name: REDROID_WIDTH
              value: "720"
            - name: REDROID_HEIGHT
              value: "1280"
          resources:
            requests:
              cpu: "250m"
              memory: "256Mi"
            limits:
              cpu: "500m"
              memory: "512Mi"
          livenessProbe:
            tcpSocket:
              port: 6969
            initialDelaySeconds: 10
            periodSeconds: 10
          readinessProbe:
            tcpSocket:
              port: 6969
            initialDelaySeconds: 5
            periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: signal-service
  namespace: gaming
spec:
  selector:
    app: signal-server
  ports:
    - port: 6969
      targetPort: 6969
  type: ClusterIP
```

### 6.4 Create Ingress (ALB)

Create `k8s/ingress.yaml`:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: gaming-ingress
  namespace: gaming
  annotations:
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/healthcheck-path: /
    alb.ingress.kubernetes.io/healthcheck-port: "6969"
    # For WebSocket support
    alb.ingress.kubernetes.io/load-balancer-attributes: idle_timeout.timeout_seconds=3600
spec:
  ingressClassName: alb
  rules:
    - http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: signal-service
                port:
                  number: 6969
```

### 6.5 Create NodePool for Gaming Workloads

Create `k8s/nodepool.yaml`:

```yaml
apiVersion: karpenter.sh/v1
kind: NodePool
metadata:
  name: gaming
spec:
  template:
    spec:
      nodeClassRef:
        group: eks.amazonaws.com
        kind: NodeClass
        name: default
      requirements:
        # x86_64 only (redroid requirement)
        - key: kubernetes.io/arch
          operator: In
          values: ["amd64"]
        # Instance types suitable for gaming
        - key: node.kubernetes.io/instance-type
          operator: In
          values:
            - m6i.xlarge    # 4 vCPU, 16GB - ~1-2 sessions
            - m6i.2xlarge   # 8 vCPU, 32GB - ~3-4 sessions
            - m6a.xlarge    # 4 vCPU, 16GB (AMD) - cheaper
            - m6a.2xlarge   # 8 vCPU, 32GB (AMD) - cheaper
        # Use on-demand for reliability (or spot for cost savings)
        - key: karpenter.sh/capacity-type
          operator: In
          values: ["on-demand"]
  # Maximum cluster size
  limits:
    cpu: "100"      # Max 100 vCPUs
    memory: "400Gi" # Max 400GB RAM
  # Consolidation settings
  disruption:
    consolidationPolicy: WhenEmptyOrUnderutilized
    consolidateAfter: 60s
```

### 6.6 Apply All Resources

```bash
# Replace placeholders in YAML files first
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export AWS_REGION=us-west-2

# Using envsubst or manual replacement
sed -i "s/<AWS_ACCOUNT_ID>/$AWS_ACCOUNT_ID/g" k8s/signal-deployment.yaml
sed -i "s/<AWS_REGION>/$AWS_REGION/g" k8s/signal-deployment.yaml

# Apply resources
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/rbac.yaml
kubectl apply -f k8s/nodepool.yaml
kubectl apply -f k8s/signal-deployment.yaml
kubectl apply -f k8s/ingress.yaml
```

---

## Step 7: Verify Deployment

```bash
# Check signal server pods
kubectl get pods -n gaming

# Check signal server logs
kubectl logs -n gaming -l app=signal-server -f

# Get the ALB URL
kubectl get ingress -n gaming
# Note the ADDRESS field - this is your WebSocket endpoint

# Test connection (replace with your ALB URL)
# wscat -c ws://<ALB_ADDRESS>
```

---

## Cost Considerations

### Pricing Breakdown (us-west-2, as of 2025)

| Component | Cost |
|-----------|------|
| EKS Cluster | $0.10/hour (~$73/month) |
| EKS Auto Mode compute fee | ~$0.01/vCPU-hour |
| m7g.xlarge Graviton (on-demand) | $0.1632/hour (~20% cheaper) |
| m6i.xlarge Intel (on-demand) | $0.192/hour |
| m7g.xlarge Graviton (spot) | ~$0.05-0.07/hour |
| ALB | $0.0225/hour + $0.008/LCU-hour |
| Data transfer | $0.09/GB (out to internet) |

### Example Monthly Cost

**Scenario:** Average 10 concurrent gaming sessions, 8 hours/day

```
EKS Cluster:                $73
Auto Mode fee:              ~$15 (20 vCPU * 240 hours * $0.01)
EC2 (3x m7g.xlarge Graviton): ~$117 (on-demand) or ~$42 (spot)
ALB:                        ~$20
Data transfer (1TB):        ~$90
-----------------------------------
Total (Graviton on-demand): ~$315/month
Total (Graviton spot):      ~$240/month
```

### Cost Optimization Tips

1. **Use Spot instances** for non-critical workloads:
   ```yaml
   # In NodePool
   - key: karpenter.sh/capacity-type
     operator: In
     values: ["spot", "on-demand"]
   ```

2. **Right-size warm pool** - Start with 3, adjust based on usage patterns

3. **Set consolidation** to quickly remove unused nodes

4. **Use Graviton instances** (m7g/m6g) - ~20% cheaper than Intel (m6i)

---

## Scaling Configuration

### Automatic Scaling Behavior

EKS Auto Mode automatically:
- **Scales up** when new pods can't fit on existing nodes
- **Scales down** when nodes are underutilized for 60+ seconds
- **Bin-packs** pods onto fewest nodes possible

### Manual Overrides

```yaml
# Force minimum nodes (not recommended for cost)
# Add to NodePool spec:
spec:
  limits:
    cpu: "100"
  # There's no minNodes in Karpenter - it scales to zero by default
```

### Warm Pool Sizing

Adjust the `WARM_POOL_SIZE` environment variable:

```yaml
env:
  - name: WARM_POOL_SIZE
    value: "5"  # Increase for busier periods
```

---

## Monitoring and Debugging

### Useful kubectl Commands

```bash
# View all gaming resources
kubectl get all -n gaming

# Watch pods in real-time
kubectl get pods -n gaming -w

# View signal server logs
kubectl logs -n gaming deployment/signal-server -f

# View logs for a specific gaming pod
kubectl logs -n gaming gaming-abc12345 -c worker
kubectl logs -n gaming gaming-abc12345 -c redroid

# Describe pod for events/errors
kubectl describe pod -n gaming gaming-abc12345

# View node utilization
kubectl top nodes

# View pod resource usage
kubectl top pods -n gaming
```

### CloudWatch Integration

EKS Auto Mode automatically sends metrics to CloudWatch. View in AWS Console:
- EKS > Clusters > android-cloud-gaming > Observability

### Prometheus/Grafana (Optional)

```bash
# Install kube-prometheus-stack
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack -n monitoring --create-namespace
```

---

## Security Considerations

### 1. Network Policies

Restrict pod-to-pod communication:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: gaming-network-policy
  namespace: gaming
spec:
  podSelector:
    matchLabels:
      app: gaming-session
  policyTypes:
    - Ingress
    - Egress
  ingress:
    # Only allow traffic from signal server
    - from:
        - podSelector:
            matchLabels:
              app: signal-server
  egress:
    # Allow traffic to signal server
    - to:
        - podSelector:
            matchLabels:
              app: signal-server
    # Allow DNS
    - to:
        - namespaceSelector: {}
          podSelector:
            matchLabels:
              k8s-app: kube-dns
      ports:
        - protocol: UDP
          port: 53
    # Allow STUN/TURN (WebRTC)
    - to:
        - ipBlock:
            cidr: 0.0.0.0/0
      ports:
        - protocol: UDP
          port: 19302
        - protocol: UDP
          port: 3478
```

### 2. Pod Security

Gaming pods require privileged mode for redroid. Isolate them:

```yaml
# Only allow privileged pods in gaming namespace
apiVersion: v1
kind: Namespace
metadata:
  name: gaming
  labels:
    pod-security.kubernetes.io/enforce: privileged
```

### 3. ECR Image Scanning

Enable vulnerability scanning:

```bash
aws ecr put-image-scanning-configuration \
    --repository-name android-cloud-gaming/worker \
    --image-scanning-configuration scanOnPush=true
```

### 4. Secrets Management

Don't hardcode credentials. Use AWS Secrets Manager:

```bash
# Create secret
aws secretsmanager create-secret --name gaming/turn-credentials \
    --secret-string '{"username":"user","password":"pass"}'
```

```yaml
# Reference in pod via External Secrets Operator or CSI driver
```

---

## Troubleshooting

### Pod Stuck in Pending

```bash
kubectl describe pod -n gaming <pod-name>
```

**Common causes:**
- No nodes with enough resources → Check NodePool limits
- Image pull failure → Verify ECR permissions
- NodePool not provisioning → Check Karpenter logs

```bash
# View Karpenter events
kubectl get events -n kube-system --sort-by='.lastTimestamp'
```

### Pod CrashLoopBackOff

```bash
kubectl logs -n gaming <pod-name> -c <container-name> --previous
```

**Common causes for redroid:**
- Missing binderfs → Ensure node supports it
- Insufficient memory → Increase limits
- Architecture mismatch → Ensure amd64 nodes

### WebSocket Connection Fails

1. Check ALB is healthy:
   ```bash
   kubectl get ingress -n gaming
   ```

2. Check signal server logs:
   ```bash
   kubectl logs -n gaming -l app=signal-server
   ```

3. Test internal connectivity:
   ```bash
   kubectl run test --rm -it --image=busybox -n gaming -- wget -qO- http://signal-service:6969
   ```

### Nodes Not Scaling Down

- Check consolidation settings in NodePool
- Ensure pods have correct resource requests (not just limits)
- View Karpenter decisions:
  ```bash
  kubectl logs -n kube-system -l app.kubernetes.io/name=karpenter
  ```

---

## Sources

### Official AWS Documentation
- [Amazon EKS Auto Mode](https://docs.aws.amazon.com/eks/latest/userguide/automode.html)
- [EKS Auto Mode Best Practices](https://docs.aws.amazon.com/eks/latest/best-practices/automode.html)
- [Getting Started with EKS Auto Mode](https://aws.amazon.com/blogs/containers/getting-started-with-amazon-eks-auto-mode/)
- [Under the Hood: EKS Auto Mode](https://aws.amazon.com/blogs/containers/under-the-hood-amazon-eks-auto-mode/)
- [EKS Auto Mode Security Overview](https://docs.aws.amazon.com/whitepapers/latest/security-overview-amazon-eks-auto-mode/amazon-eks-control-plane.html)

### Kubernetes Documentation
- [Service Accounts](https://kubernetes.io/docs/concepts/security/service-accounts/)
- [RBAC Authorization](https://kubernetes.io/docs/reference/access-authn-authz/rbac/)
- [Configure Service Accounts for Pods](https://kubernetes.io/docs/tasks/configure-pod-container/configure-service-account/)

### Kubernetes JavaScript Client
- [kubernetes-client/javascript GitHub](https://github.com/kubernetes-client/javascript)
- [@kubernetes/client-node npm](https://www.npmjs.com/package/@kubernetes/client-node)
- [In-Cluster Example](https://github.com/kubernetes-client/javascript/blob/master/examples/in-cluster.js)

### Related Tools
- [eksctl](https://eksctl.io/)
- [Karpenter](https://karpenter.sh/)
- [redroid](https://github.com/remote-android/redroid-doc)

---

## Next Steps

1. [ ] Set up CI/CD pipeline for automatic image builds
2. [ ] Configure custom domain with Route 53
3. [ ] Add HTTPS/WSS with ACM certificate
4. [ ] Set up CloudWatch alarms for monitoring
5. [ ] Implement user authentication
6. [ ] Add TURN server for better NAT traversal
7. [ ] Consider GPU instances for better performance
