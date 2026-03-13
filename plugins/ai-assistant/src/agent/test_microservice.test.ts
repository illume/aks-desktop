import { describe, it, expect } from 'vitest';
import { _testing } from './aksAgentManager';

const { extractAIAnswer } = _testing;

const rawMicroserviceYaml = [
  'stty -echo',
  '\x1b[?2004l',
  '\x1b[?2004hroot@aks-agent-649f94dbb9-whtf8:/app# ',
  '\x1b[?2004l\r',
  '\x1b[?2004h> ',
  '\x1b[?2004l\r',
  '\x1b[1;96mAI:\x1b[0m ',
  'Below is a single (large) multi-document YAML example for a "complicated"       ',
  'microservice setup: multiple namespaces, shared config, secrets, several        ',
  'microservices, HPAs, PDBs, NetworkPolicies, an Ingress, a CronJob, and a Job.   ',
  '',
  '\x1b[40m                                                                                \x1b[0m',
  '\x1b[40m \x1b[0m\x1b[37;40m# --------------------------------------------------------\x1b[0m\x1b[40m                    \x1b[0m\x1b[40m \x1b[0m',
  '\x1b[40m \x1b[0m\x1b[37;40m# Namespaces\x1b[0m\x1b[40m                                                                  \x1b[0m\x1b[40m \x1b[0m',
  '\x1b[40m \x1b[0m\x1b[37;40m# --------------------------------------------------------\x1b[0m\x1b[40m                    \x1b[0m\x1b[40m \x1b[0m',
  '\x1b[40m \x1b[0m\x1b[91;40mapiVersion\x1b[0m\x1b[97;40m:\x1b[0m\x1b[97;40m \x1b[0m\x1b[40mv1                                                                \x1b[0m\x1b[40m \x1b[0m',
  '\x1b[40m \x1b[0m\x1b[91;40mkind\x1b[0m\x1b[97;40m:\x1b[0m\x1b[97;40m \x1b[0m\x1b[40mNamespace                                                               \x1b[0m\x1b[40m \x1b[0m',
  '\x1b[40m \x1b[0m\x1b[91;40mmetadata\x1b[0m\x1b[97;40m:\x1b[0m\x1b[40m                                                                     \x1b[0m\x1b[40m \x1b[0m',
  '\x1b[40m \x1b[0m\x1b[97;40m  \x1b[0m\x1b[91;40mname\x1b[0m\x1b[97;40m:\x1b[0m\x1b[97;40m \x1b[0m\x1b[40mplatform                                                              \x1b[0m\x1b[40m \x1b[0m',
  '\x1b[40m \x1b[0m\x1b[97;40m---\x1b[0m\x1b[40m                                                                           \x1b[0m\x1b[40m \x1b[0m',
  '\x1b[40m \x1b[0m\x1b[91;40mapiVersion\x1b[0m\x1b[97;40m:\x1b[0m\x1b[97;40m \x1b[0m\x1b[40mv1                                                                \x1b[0m\x1b[40m \x1b[0m',
  '\x1b[40m \x1b[0m\x1b[91;40mkind\x1b[0m\x1b[97;40m:\x1b[0m\x1b[97;40m \x1b[0m\x1b[40mNamespace                                                               \x1b[0m\x1b[40m \x1b[0m',
  '\x1b[40m \x1b[0m\x1b[91;40mmetadata\x1b[0m\x1b[97;40m:\x1b[0m\x1b[40m                                                                     \x1b[0m\x1b[40m \x1b[0m',
  '\x1b[40m \x1b[0m\x1b[97;40m  \x1b[0m\x1b[91;40mname\x1b[0m\x1b[97;40m:\x1b[0m\x1b[97;40m \x1b[0m\x1b[40mapps                                                                  \x1b[0m\x1b[40m \x1b[0m',
  '\x1b[40m \x1b[0m\x1b[40m                                                                              \x1b[0m\x1b[40m \x1b[0m',
  '\x1b[40m \x1b[0m\x1b[37;40m# --------------------------------------------------------\x1b[0m\x1b[40m                    \x1b[0m\x1b[40m \x1b[0m',
  '\x1b[40m \x1b[0m\x1b[37;40m# Shared config/secrets\x1b[0m\x1b[40m                                                       \x1b[0m\x1b[40m \x1b[0m',
  '\x1b[40m \x1b[0m\x1b[37;40m# --------------------------------------------------------\x1b[0m\x1b[40m                    \x1b[0m\x1b[40m \x1b[0m',
  '\x1b[40m \x1b[0m\x1b[97;40m---\x1b[0m\x1b[40m                                                                           \x1b[0m\x1b[40m \x1b[0m',
  '\x1b[40m \x1b[0m\x1b[91;40mapiVersion\x1b[0m\x1b[97;40m:\x1b[0m\x1b[97;40m \x1b[0m\x1b[40mv1                                                                \x1b[0m\x1b[40m \x1b[0m',
  '\x1b[40m \x1b[0m\x1b[91;40mkind\x1b[0m\x1b[97;40m:\x1b[0m\x1b[97;40m \x1b[0m\x1b[40mConfigMap                                                               \x1b[0m\x1b[40m \x1b[0m',
  '\x1b[40m \x1b[0m\x1b[91;40mmetadata\x1b[0m\x1b[97;40m:\x1b[0m\x1b[40m                                                                     \x1b[0m\x1b[40m \x1b[0m',
  '\x1b[40m \x1b[0m\x1b[97;40m  \x1b[0m\x1b[91;40mname\x1b[0m\x1b[97;40m:\x1b[0m\x1b[97;40m \x1b[0m\x1b[40mglobal-config                                                         \x1b[0m\x1b[40m \x1b[0m',
  '\x1b[40m \x1b[0m\x1b[97;40m  \x1b[0m\x1b[91;40mnamespace\x1b[0m\x1b[97;40m:\x1b[0m\x1b[97;40m \x1b[0m\x1b[40mapps                                                             \x1b[0m\x1b[40m \x1b[0m',
  '\x1b[40m \x1b[0m\x1b[91;40mdata\x1b[0m\x1b[97;40m:\x1b[0m\x1b[40m                                                                         \x1b[0m\x1b[40m \x1b[0m',
  '\x1b[40m \x1b[0m\x1b[97;40m  \x1b[0m\x1b[91;40mLOG_LEVEL\x1b[0m\x1b[97;40m:\x1b[0m\x1b[97;40m \x1b[0m\x1b[93;40m"\x1b[0m\x1b[93;40minfo\x1b[0m\x1b[93;40m"\x1b[0m\x1b[40m                                                           \x1b[0m\x1b[40m \x1b[0m',
  '\x1b[40m \x1b[0m\x1b[97;40m  \x1b[0m\x1b[91;40mOTEL_EXPORTER_OTLP_ENDPOINT\x1b[0m\x1b[97;40m:\x1b[0m\x1b[97;40m \x1b[0m\x1b[40m                                               \x1b[0m\x1b[40m \x1b[0m',
  '\x1b[40m \x1b[0m\x1b[93;40m"\x1b[0m\x1b[93;40mhttp://otel-collector.observability.svc.cluster.local:4317\x1b[0m\x1b[93;40m"\x1b[0m\x1b[40m                  \x1b[0m\x1b[40m \x1b[0m',
  '\x1b[40m \x1b[0m\x1b[97;40m---\x1b[0m\x1b[40m                                                                           \x1b[0m\x1b[40m \x1b[0m',
  '\x1b[40m \x1b[0m\x1b[91;40mapiVersion\x1b[0m\x1b[97;40m:\x1b[0m\x1b[97;40m \x1b[0m\x1b[40mv1                                                                \x1b[0m\x1b[40m \x1b[0m',
  '\x1b[40m \x1b[0m\x1b[91;40mkind\x1b[0m\x1b[97;40m:\x1b[0m\x1b[97;40m \x1b[0m\x1b[40mSecret                                                                  \x1b[0m\x1b[40m \x1b[0m',
  '\x1b[40m \x1b[0m\x1b[91;40mmetadata\x1b[0m\x1b[97;40m:\x1b[0m\x1b[40m                                                                     \x1b[0m\x1b[40m \x1b[0m',
  '\x1b[40m \x1b[0m\x1b[97;40m  \x1b[0m\x1b[91;40mname\x1b[0m\x1b[97;40m:\x1b[0m\x1b[97;40m \x1b[0m\x1b[40mdb-credentials                                                        \x1b[0m\x1b[40m \x1b[0m',
  '\x1b[40m \x1b[0m\x1b[91;40mtype\x1b[0m\x1b[97;40m:\x1b[0m\x1b[97;40m \x1b[0m\x1b[40mOpaque                                                                  \x1b[0m\x1b[40m \x1b[0m',
  '\x1b[40m \x1b[0m\x1b[91;40mstringData\x1b[0m\x1b[97;40m:\x1b[0m\x1b[40m                                                                   \x1b[0m\x1b[40m \x1b[0m',
  '\x1b[40m \x1b[0m\x1b[97;40m  \x1b[0m\x1b[91;40mPOSTGRES_USER\x1b[0m\x1b[97;40m:\x1b[0m\x1b[97;40m \x1b[0m\x1b[93;40m"\x1b[0m\x1b[93;40mappuser\x1b[0m\x1b[93;40m"\x1b[0m\x1b[40m                                                     \x1b[0m\x1b[40m \x1b[0m',
  '\x1b[40m \x1b[0m\x1b[97;40m  \x1b[0m\x1b[91;40mPOSTGRES_PASSWORD\x1b[0m\x1b[97;40m:\x1b[0m\x1b[97;40m \x1b[0m\x1b[93;40m"\x1b[0m\x1b[93;40mreplace-me\x1b[0m\x1b[93;40m"\x1b[0m\x1b[40m                                             \x1b[0m\x1b[40m \x1b[0m',
  '\x1b[40m                                                                                \x1b[0m',
  '',
  'If you want it even more "realistic complicated", tell me what stack you want   ',
  "included (Istio/Linkerd, Kafka, etc.) and I'll tailor the example.              ",
  '',
  '\x1b[?2004hroot@aks-agent-649f94dbb9-whtf8:/app# ',
].join('\r\n');

describe('debug microservice YAML', () => {
  it('shows extractAIAnswer output', () => {
    const result = extractAIAnswer(rawMicroserviceYaml);
    console.log('=== extractAIAnswer output ===');
    result.split('\n').forEach((l: string, i: number) => console.log(`${i}: [${l}]`));
    expect(result.length).toBeGreaterThan(0);
  });
});
