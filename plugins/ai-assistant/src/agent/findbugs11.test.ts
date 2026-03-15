/**
 * findbugs11.test.ts — Round 11 synthetic fixtures targeting K8s/AKS parser edge cases.
 * Each test was first written as a failing test, then the parser bug was fixed.
 * Focused on patterns commonly encountered by K8s and AKS users.
 */
import { describe, expect, it } from 'vitest';
import { _testing } from './aksAgentManager';

const { extractAIAnswer } = _testing;

function panelLine(content: string, keyColor = '97;40'): string {
  const padded = content.padEnd(78);
  return `\x1b[40m \x1b[0m\x1b[${keyColor}m${padded}\x1b[0m\x1b[40m \x1b[0m`;
}

function panelBlank(): string {
  return '\x1b[40m' + ' '.repeat(80) + '\x1b[0m';
}

function makeRaw(bodyLines: string[]): string {
  const prefix = [
    'stty -echo',
    '\x1b[?2004l',
    '\x1b[?2004hroot@aks-agent-abc123:/app# ',
    '\x1b[?2004l',
    '',
    "Loaded models: ['azure/gpt-4']",
    '\x1b[1;96mAI:\x1b[0m ',
    '',
  ];
  const suffix = ['', '\x1b[?2004hroot@aks-agent-abc123:/app# '];
  return [...prefix, ...bodyLines, ...suffix].join('\n');
}

function extractCodeBlocks(result: string): string[] {
  const blocks: string[] = [];
  let inBlock = false;
  let current: string[] = [];
  for (const line of result.split('\n')) {
    if (/^```/.test(line.trim())) {
      if (inBlock) {
        blocks.push(current.join('\n'));
        current = [];
      }
      inBlock = !inBlock;
      continue;
    }
    if (inBlock) current.push(line);
  }
  return blocks;
}

function assertNoAnsiLeaks(result: string): void {
  expect(result).not.toMatch(/\x1b/);
  expect(result).not.toMatch(/\[\d+m/);
}

describe('findbugs11: K8s/AKS-focused extractAIAnswer edge cases round 2', () => {
  // Bug 1: kubectl resource/action output like "deployment.apps/my-app scaled"
  // not detected as code. These lines follow a `$ kubectl scale` command but
  // the output lines themselves don't match any tier.
  it('1. kubectl resource action output lines detected as code', () => {
    const body = [
      'Scale the deployment:',
      '',
      panelLine('$ kubectl scale deployment my-app --replicas=5 -n production'),
      panelLine('deployment.apps/my-app scaled'),
      panelBlank(),
      '',
      'Verify:',
      '',
      panelLine('$ kubectl get deployment my-app -n production'),
      panelLine('NAME     READY   UP-TO-DATE   AVAILABLE   AGE'),
      panelLine('my-app   5/5     5            5           3d'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('kubectl scale');
    expect(all).toContain('deployment.apps/my-app scaled');
  });

  // Bug 2: kubectl create/apply output lines not detected as code
  // Lines like "service/my-svc created", "configmap/my-config unchanged"
  // follow kubectl commands but aren't detected by any code tier
  it('2. kubectl apply output lines stay in code block', () => {
    const body = [
      'Apply manifests:',
      '',
      panelLine('$ kubectl apply -f manifests/ -n production'),
      panelLine('namespace/production unchanged'),
      panelLine('serviceaccount/my-app created'),
      panelLine('deployment.apps/my-app configured'),
      panelLine('service/my-app-svc created'),
      panelLine('configmap/my-config unchanged'),
      panelLine('ingress.networking.k8s.io/my-ingress created'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('kubectl apply');
    expect(all).toContain('service/my-app-svc created');
    expect(all).toContain('ingress.networking.k8s.io/my-ingress created');
  });

  // Bug 3: Helm status output mistaken for YAML because STATUS: matches key: pattern
  // "NAMESPACE: production" and "STATUS: deployed" are helm output, not YAML
  it('3. Helm status output not treated as YAML keys', () => {
    const body = [
      'Check Helm release:',
      '',
      panelLine('$ helm status my-release -n production'),
      panelLine('NAME: my-release'),
      panelLine('LAST DEPLOYED: Mon Jan 15 10:30:00 2024'),
      panelLine('NAMESPACE: production'),
      panelLine('STATUS: deployed'),
      panelLine('REVISION: 3'),
      panelLine('TEST SUITE: None'),
      panelLine('NOTES:'),
      panelLine('  Get the URL by running:'),
      panelLine('  kubectl get svc my-release -n production'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('helm status');
    expect(all).toContain('STATUS: deployed');
  });

  // Bug 4: kubectl rollout status output not detected as code
  // Lines like "Waiting for rollout to finish..." and "deployment successfully rolled out"
  // are plain English but they're command output
  it('4. kubectl rollout output stays in code block', () => {
    const body = [
      'Wait for rollout:',
      '',
      panelLine('$ kubectl rollout status deployment/my-app -n production'),
      panelLine('Waiting for deployment "my-app" rollout to finish: 1 of 3 updated replicas are available...'),
      panelLine('Waiting for deployment "my-app" rollout to finish: 2 of 3 updated replicas are available...'),
      panelLine('deployment "my-app" successfully rolled out'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('kubectl rollout');
    expect(all).toContain('successfully rolled out');
  });

  // Bug 5: terraform plan output with + prefix not detected as code
  // The `+` prefix used by terraform plan/apply is not in any detection tier
  it('5. terraform plan output with + prefix detected as code', () => {
    const body = [
      'Plan the AKS cluster:',
      '',
      panelLine('$ terraform plan'),
      panelLine(''),
      panelLine('Terraform will perform the following actions:'),
      panelLine(''),
      panelLine('  # azurerm_kubernetes_cluster.aks will be created'),
      panelLine('  + resource "azurerm_kubernetes_cluster" "aks" {'),
      panelLine('      + dns_prefix          = "myaks"'),
      panelLine('      + location            = "eastus"'),
      panelLine('      + name                = "myAKSCluster"'),
      panelLine('      + resource_group_name = "myResourceGroup"'),
      panelLine('    }'),
      panelLine(''),
      panelLine('Plan: 1 to add, 0 to change, 0 to destroy.'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('terraform plan');
    expect(all).toContain('azurerm_kubernetes_cluster');
  });

  // Bug 6: Docker build step output not detected as code
  // Lines like "Step 1/10 : FROM node:18" and "---> abc123" are build output
  it('6. Docker build step output stays in code block', () => {
    const body = [
      'Build the image:',
      '',
      panelLine('$ docker build -t myapp:latest .'),
      panelLine('Step 1/5 : FROM node:18-alpine'),
      panelLine(' ---> abc123def456'),
      panelLine('Step 2/5 : WORKDIR /app'),
      panelLine(' ---> Using cache'),
      panelLine(' ---> def456789abc'),
      panelLine('Step 3/5 : COPY package*.json ./'),
      panelLine(' ---> 789abcdef012'),
      panelLine('Step 4/5 : RUN npm ci --production'),
      panelLine(' ---> Running in container123'),
      panelLine('Step 5/5 : CMD ["node", "server.js"]'),
      panelLine(' ---> 012345678abc'),
      panelLine('Successfully built 012345678abc'),
      panelLine('Successfully tagged myapp:latest'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('docker build');
    expect(all).toContain('Step 1/5');
    expect(all).toContain('Successfully tagged');
  });

  // Bug 7: Helm template Jinja/Go template syntax {{...}} detected as YAML
  // The looksLikeYaml function matches { at start of line, so {{- if }}
  // gets classified as YAML flow mapping opener instead of template code
  it('7. Helm template Go expressions in bare output wrapped as code', () => {
    const body = [
      'The Helm template generates:',
      '',
      panelLine('{{- if .Values.ingress.enabled -}}'),
      panelLine('apiVersion: networking.k8s.io/v1'),
      panelLine('kind: Ingress'),
      panelLine('metadata:'),
      panelLine('  name: {{ include "mychart.fullname" . }}'),
      panelLine('  {{- with .Values.ingress.annotations }}'),
      panelLine('  annotations:'),
      panelLine('    {{- toYaml . | nindent 4 }}'),
      panelLine('  {{- end }}'),
      panelLine('spec:'),
      panelLine('  rules:'),
      panelLine('  {{- range .Values.ingress.hosts }}'),
      panelLine('  - host: {{ .host }}'),
      panelLine('{{- end }}'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('{{- if .Values.ingress.enabled');
    expect(all).toContain('kind: Ingress');
    expect(all).toContain('{{- end }}');
  });

  // Bug 8: ConfigMap with embedded properties file (key=value format)
  // spring.datasource.url=jdbc:... is not detected by any code tier
  it('8. ConfigMap with embedded Spring properties stays together', () => {
    const body = [
      'Create ConfigMap:',
      '',
      panelLine('apiVersion: v1'),
      panelLine('kind: ConfigMap'),
      panelLine('metadata:'),
      panelLine('  name: app-config'),
      panelLine('data:'),
      panelLine('  application.properties: |'),
      panelLine('    server.port=8080'),
      panelLine('    spring.datasource.url=jdbc:postgresql://db:5432/mydb'),
      panelLine('    spring.datasource.username=${DB_USER}'),
      panelLine('    spring.jpa.hibernate.ddl-auto=update'),
      panelLine('    management.endpoints.web.exposure.include=health,info'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('kind: ConfigMap');
    expect(all).toContain('spring.datasource.url');
    expect(all).toContain('management.endpoints');
  });

  // Bug 9: kubectl error output treated as YAML because "error:" matches key: pattern
  // "error: the server doesn't have a resource type" is an error message, not YAML
  it('9. kubectl error messages not absorbed into YAML blocks', () => {
    const body = [
      'Try to access the resource:',
      '',
      panelLine('$ kubectl get pods -n production'),
      panelLine('NAME                     READY   STATUS    RESTARTS   AGE'),
      panelLine('api-server-abc12         1/1     Running   0          2d'),
      panelBlank(),
      '',
      'If you see an error like:',
      '',
      panelLine('$ kubectl get customresource -n production'),
      panelLine('error: the server doesnt have a resource type "customresource"'),
      panelBlank(),
      '',
      'It means the CRD is not installed.',
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(2);
    const all = blocks.join('\n');
    expect(all).toContain('kubectl get pods');
    expect(all).toContain('error: the server');
    // The trailing prose should NOT be inside a code block
    expect(result).toContain('CRD is not installed');
  });

  // Bug 10: Warning messages from kubectl treated as YAML
  // "Warning: policy/v1beta1 PodSecurityPolicy is deprecated" starts with
  // "Warning:" which matches YAML key: pattern
  it('10. kubectl deprecation warnings stay with command output', () => {
    const body = [
      'Apply the policy:',
      '',
      panelLine('$ kubectl apply -f psp.yaml'),
      panelLine('Warning: policy/v1beta1 PodSecurityPolicy is deprecated in v1.21+'),
      panelLine('podsecuritypolicy.policy/restricted created'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('kubectl apply');
    expect(all).toContain('Warning:');
    expect(all).toContain('podsecuritypolicy');
  });

  // Bug 11: kubectl events output as bare table without $ prefix
  // Events table with TYPE/REASON/OBJECT/MESSAGE columns might not be detected
  it('11. bare kubectl events table detected as code', () => {
    const body = [
      'Recent events in the namespace:',
      '',
      panelLine('LAST SEEN   TYPE      REASON              OBJECT                        MESSAGE'),
      panelLine('30s         Normal    Scheduled           pod/api-server-abc12          Successfully assigned'),
      panelLine('28s         Normal    Pulling             pod/api-server-abc12          Pulling image "myapp:v2"'),
      panelLine('15s         Normal    Pulled              pod/api-server-abc12          Successfully pulled image'),
      panelLine('14s         Normal    Created             pod/api-server-abc12          Created container api'),
      panelLine('14s         Normal    Started             pod/api-server-abc12          Started container api'),
      panelLine('5s          Warning   BackOff             pod/worker-xyz99              Back-off restarting failed'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('LAST SEEN');
    expect(all).toContain('BackOff');
  });

  // Bug 12: Kustomization patches with strategic merge patch
  // Non-K8s YAML with patchesStrategicMerge: list at 1-space indent
  it('12. Kustomization with patchesStrategicMerge wrapped as YAML', () => {
    const body = [
      'Create kustomization.yaml:',
      '',
      panelLine(' resources:'),
      panelLine(' - deployment.yaml'),
      panelLine(' - service.yaml'),
      panelLine(' patchesStrategicMerge:'),
      panelLine(' - |-'),
      panelLine('   apiVersion: apps/v1'),
      panelLine('   kind: Deployment'),
      panelLine('   metadata:'),
      panelLine('     name: my-app'),
      panelLine('   spec:'),
      panelLine('     replicas: 5'),
      panelLine(' commonLabels:'),
      panelLine('   app: my-app'),
      panelLine('   env: production'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('resources:');
    expect(all).toContain('patchesStrategicMerge');
    expect(all).toContain('commonLabels');
  });

  // Bug 13: Go code using client-go with k8s.io import paths
  // client-go code commonly written by K8s users
  it('13. Go client-go code stays in one code block', () => {
    const body = [
      'Create main.go:',
      '',
      panelLine('package main'),
      panelLine(''),
      panelLine('import ('),
      panelLine('  "context"'),
      panelLine('  "fmt"'),
      panelLine('  metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"'),
      panelLine('  "k8s.io/client-go/kubernetes"'),
      panelLine('  "k8s.io/client-go/tools/clientcmd"'),
      panelLine(')'),
      panelLine(''),
      panelLine('func main() {'),
      panelLine('  config, err := clientcmd.BuildConfigFromFlags("", kubeconfig)'),
      panelLine('  if err != nil {'),
      panelLine('    panic(err)'),
      panelLine('  }'),
      panelLine('  clientset, err := kubernetes.NewForConfig(config)'),
      panelLine('  pods, err := clientset.CoreV1().Pods("default").List(context.TODO(), metav1.ListOptions{})'),
      panelLine('  for _, pod := range pods.Items {'),
      panelLine('    fmt.Printf("Pod: %s\\n", pod.Name)'),
      panelLine('  }'),
      panelLine('}'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('package main');
    expect(all).toContain('k8s.io/client-go');
    expect(all).toContain('CoreV1().Pods');
  });

  // Bug 14: RBAC ClusterRole with resourceNames and verbs arrays
  // Complex RBAC rules with multiple indentation levels
  it('14. RBAC ClusterRole with complex rules stays together', () => {
    const body = [
      'Create ClusterRole:',
      '',
      panelLine('apiVersion: rbac.authorization.k8s.io/v1'),
      panelLine('kind: ClusterRole'),
      panelLine('metadata:'),
      panelLine('  name: monitoring-role'),
      panelLine('rules:'),
      panelLine('- apiGroups: [""]'),
      panelLine('  resources: ["pods", "nodes", "services", "endpoints"]'),
      panelLine('  verbs: ["get", "list", "watch"]'),
      panelLine('- apiGroups: ["apps"]'),
      panelLine('  resources: ["deployments", "replicasets", "statefulsets"]'),
      panelLine('  verbs: ["get", "list", "watch"]'),
      panelLine('- apiGroups: ["monitoring.coreos.com"]'),
      panelLine('  resources: ["prometheuses", "servicemonitors", "alertmanagers"]'),
      panelLine('  verbs: ["*"]'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('rbac.authorization.k8s.io');
    expect(all).toContain('verbs: ["*"]');
  });

  // Bug 15: Mixed kubectl commands with prose between them
  // Multiple kubectl commands separated by prose explanations
  // Each command should be in its own code block, prose should be outside
  it('15. Multiple kubectl commands with prose rendered correctly', () => {
    const body = [
      'First, create the namespace:',
      '',
      panelLine('$ kubectl create namespace monitoring'),
      panelLine('namespace/monitoring created'),
      panelBlank(),
      '',
      'Then install Prometheus:',
      '',
      panelLine('$ helm install prometheus prometheus-community/kube-prometheus-stack \\'),
      panelLine('    --namespace monitoring \\'),
      panelLine('    --set grafana.enabled=true \\'),
      panelLine('    --set alertmanager.enabled=true'),
      panelBlank(),
      '',
      'Verify the pods are running:',
      '',
      panelLine('$ kubectl get pods -n monitoring'),
      panelLine('NAME                                                  READY   STATUS    RESTARTS   AGE'),
      panelLine('prometheus-kube-prometheus-operator-7d9f5b6c4-abc12   1/1     Running   0          60s'),
      panelLine('prometheus-grafana-85f4c9d7b-xyz99                    3/3     Running   0          60s'),
      panelLine('alertmanager-prometheus-alertmanager-0                1/1     Running   0          60s'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(2);
    const all = blocks.join('\n');
    expect(all).toContain('kubectl create namespace');
    expect(all).toContain('helm install');
    expect(all).toContain('kubectl get pods');
    expect(all).toContain('alertmanager');
    // Prose between blocks should be outside code
    expect(result).toContain('Then install Prometheus');
    expect(result).toContain('Verify the pods');
  });
});
