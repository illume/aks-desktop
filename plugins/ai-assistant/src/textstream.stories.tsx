// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { Box, Button, createTheme, CssBaseline, ThemeProvider } from '@mui/material';
import { Meta, StoryFn } from '@storybook/react';
import React, { useEffect, useRef, useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { Prompt } from './ai/manager';
import TextStreamContainer from './textstream';

const lightTheme = createTheme({
  palette: {
    mode: 'light',
    sidebar: { selectedBackground: '#c2c2c2' },
  },
});

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    sidebar: { selectedBackground: '#555555' },
  },
});

const meta: Meta = {
  title: 'AIAssistant/TextStreamScrolling',
  decorators: [
    (Story: any) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
};
export default meta;

// ── Helpers ──────────────────────────────────────────────────────────────────

const longAssistantResponse = `Here's a comprehensive guide to debugging your AKS cluster networking issues:

## 1. Check Pod Network Connectivity

\`\`\`bash
# List all pods with their IPs and nodes
kubectl get pods -A -o wide

# Test connectivity from a debug pod
kubectl run debug --image=busybox --restart=Never -- sleep 3600
kubectl exec -it debug -- wget -qO- http://my-service.default.svc.cluster.local
\`\`\`

## 2. Inspect Network Policies

\`\`\`bash
# List all network policies
kubectl get networkpolicies -A

# Describe a specific policy
kubectl describe networkpolicy my-policy -n my-namespace
\`\`\`

## 3. Verify DNS Resolution

\`\`\`bash
# Test DNS from inside a pod
kubectl exec -it debug -- nslookup kubernetes.default.svc.cluster.local
kubectl exec -it debug -- nslookup my-service.my-namespace.svc.cluster.local
\`\`\`

## 4. Check Node-Level Networking

| Check | Command | Expected |
|-------|---------|----------|
| Node status | \`kubectl get nodes\` | All Ready |
| CNI pods | \`kubectl get pods -n kube-system -l component=azure-cni\` | All Running |
| CoreDNS | \`kubectl get pods -n kube-system -l k8s-app=kube-dns\` | All Running |
| kube-proxy | \`kubectl get pods -n kube-system -l component=kube-proxy\` | All Running |

## 5. Review Azure NSG Rules

Make sure your Network Security Groups allow traffic between:
- Pod CIDR ranges across node pools
- Service CIDR range
- Node-to-node communication on required ports

> **Important**: After any NSG changes, it may take up to 5 minutes for rules to propagate fully.`;

const previousConversation: Prompt[] = [
  { role: 'user', content: 'How do I set up monitoring for my AKS cluster?' },
  {
    role: 'assistant',
    content: `You can enable Azure Monitor for containers using:

\`\`\`bash
az aks enable-addons --resource-group myResourceGroup --name myAKSCluster --addons monitoring
\`\`\`

This will install the monitoring agent on all nodes and start collecting metrics and logs.`,
  },
  { role: 'user', content: 'What about Prometheus?' },
  {
    role: 'assistant',
    content: `For Prometheus, you have several options:

1. **Azure Managed Prometheus** — recommended for AKS:
\`\`\`bash
az aks update --resource-group myRG --name myCluster --enable-azure-monitor-metrics
\`\`\`

2. **Self-managed Prometheus** using Helm:
\`\`\`bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack
\`\`\`

Both options integrate with Grafana for dashboards.`,
  },
  { role: 'user', content: 'How do I check my cluster networking?' },
];

// Follow-up questions used to simulate a realistic multi-turn conversation
const followUpQuestions = [
  'How do I check my cluster networking?',
  'How do I troubleshoot DNS issues in AKS?',
  'What about network policy debugging?',
  'How do I monitor network traffic between pods?',
];

// ── Stories ──────────────────────────────────────────────────────────────────

/**
 * Demonstrates that when a new agent response arrives, the viewport scrolls
 * to the **top** of the response rather than the bottom.
 * Click "Ask & Get Response" to simulate sending a question and receiving a
 * long response. Works for multiple sequential clicks — each click adds
 * a user question (scrolls to bottom) then an agent response (scrolls to top
 * of the response, with the user's question visible for context).
 */
export const ScrollToTopOfResponse: StoryFn = () => {
  const [history, setHistory] = useState<Prompt[]>(
    previousConversation.slice(0, -1) // start without the trailing user question
  );
  const [isLoading, setIsLoading] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const addExchange = () => {
    const question = followUpQuestions[questionIndex % followUpQuestions.length];
    // Add user question first (triggers scroll to bottom)
    setHistory(prev => [...prev, { role: 'user', content: question }]);
    setIsLoading(true);
    // Short delay to simulate loading, then add assistant response
    timerRef.current = setTimeout(() => {
      setHistory(prev => [...prev, { role: 'assistant', content: longAssistantResponse }]);
      setIsLoading(false);
      setQuestionIndex(i => i + 1);
    }, 500);
  };

  return (
    <ThemeProvider theme={lightTheme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', height: 500, maxWidth: 700 }}>
        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          <TextStreamContainer history={history} isLoading={isLoading} apiError={null} />
        </Box>
        <Box sx={{ p: 1, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button variant="contained" onClick={addExchange} disabled={isLoading}>
            Ask &amp; Get Response
          </Button>
        </Box>
      </Box>
    </ThemeProvider>
  );
};

/**
 * Same test in dark theme. The viewport should scroll to the top of the new
 * agent response when "Ask & Get Response" is clicked.
 */
export const ScrollToTopOfResponseDark: StoryFn = () => {
  const [history, setHistory] = useState<Prompt[]>(
    previousConversation.slice(0, -1)
  );
  const [isLoading, setIsLoading] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const addExchange = () => {
    const question = followUpQuestions[questionIndex % followUpQuestions.length];
    setHistory(prev => [...prev, { role: 'user', content: question }]);
    setIsLoading(true);
    timerRef.current = setTimeout(() => {
      setHistory(prev => [...prev, { role: 'assistant', content: longAssistantResponse }]);
      setIsLoading(false);
      setQuestionIndex(i => i + 1);
    }, 500);
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', height: 500, maxWidth: 700 }}>
        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          <TextStreamContainer history={history} isLoading={isLoading} apiError={null} />
        </Box>
        <Box sx={{ p: 1, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button variant="contained" onClick={addExchange} disabled={isLoading}>
            Ask &amp; Get Response
          </Button>
        </Box>
      </Box>
    </ThemeProvider>
  );
};

/**
 * Multi-step conversation: click repeatedly to add alternating user questions
 * and agent responses. Each agent response should scroll to show its top.
 */
export const MultiStepConversation: StoryFn = () => {
  const exchanges: Array<{ user: string; assistant: string }> = [
    {
      user: 'How do I scale my deployment?',
      assistant: `To scale a deployment, use:

\`\`\`bash
kubectl scale deployment my-app --replicas=5
\`\`\`

Or use Horizontal Pod Autoscaler:

\`\`\`bash
kubectl autoscale deployment my-app --min=2 --max=10 --cpu-percent=80
\`\`\`

Check the current state with:
\`\`\`bash
kubectl get hpa
\`\`\``,
    },
    {
      user: 'What if the pods are stuck in Pending?',
      assistant: `Pods stuck in **Pending** usually mean the scheduler can't find a suitable node. Common causes:

## Resource Constraints
\`\`\`bash
# Check node resource usage
kubectl top nodes

# Check pod resource requests
kubectl describe pod <pod-name> | grep -A 5 "Requests"
\`\`\`

## Node Affinity / Taints
\`\`\`bash
# Check node taints
kubectl get nodes -o custom-columns=NAME:.metadata.name,TAINTS:.spec.taints

# Check pending pod events
kubectl describe pod <pending-pod> | tail -20
\`\`\`

| Cause | Solution |
|-------|----------|
| Insufficient CPU | Add nodes or reduce requests |
| Insufficient memory | Add nodes or reduce requests |
| Node taint | Add toleration to pod spec |
| Node selector mismatch | Update node labels or pod selector |
| PVC pending | Check storage class and PV availability |`,
    },
    {
      user: 'How do I add more nodes?',
      assistant: `You can scale your node pool with the Azure CLI:

\`\`\`bash
# Scale an existing node pool
az aks nodepool scale \\
  --resource-group myResourceGroup \\
  --cluster-name myAKSCluster \\
  --name mynodepool \\
  --node-count 5

# Or enable cluster autoscaler
az aks nodepool update \\
  --resource-group myResourceGroup \\
  --cluster-name myAKSCluster \\
  --name mynodepool \\
  --enable-cluster-autoscaler \\
  --min-count 2 \\
  --max-count 10
\`\`\`

> **Tip**: The cluster autoscaler checks every 10 seconds for pending pods that can't be scheduled and scales up nodes accordingly.`,
    },
  ];

  const [history, setHistory] = useState<Prompt[]>([
    { role: 'user', content: 'Hello, I need help with AKS.' },
    {
      role: 'assistant',
      content: "Hi! I'm ready to help you with your AKS cluster. What do you need?",
    },
  ]);
  const [step, setStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const addNextExchange = () => {
    if (step >= exchanges.length) return;
    const exchange = exchanges[step];

    // Add user message
    setHistory(prev => [...prev, { role: 'user', content: exchange.user }]);

    // Add assistant response after a short delay
    setIsLoading(true);
    timerRef.current = setTimeout(() => {
      setHistory(prev => [...prev, { role: 'assistant', content: exchange.assistant }]);
      setIsLoading(false);
      setStep(s => s + 1);
    }, 600);
  };

  return (
    <ThemeProvider theme={lightTheme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', height: 500, maxWidth: 700 }}>
        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          <TextStreamContainer history={history} isLoading={isLoading} apiError={null} />
        </Box>
        <Box sx={{ p: 1, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button
            variant="contained"
            onClick={addNextExchange}
            disabled={isLoading || step >= exchanges.length}
          >
            {step < exchanges.length
              ? `Send Next Question (${step + 1}/${exchanges.length})`
              : 'Conversation Complete'}
          </Button>
        </Box>
      </Box>
    </ThemeProvider>
  );
};
