import { describe, expect, it } from 'vitest';
import { _testing } from './aksAgentManager';

const {
  stripAnsi,
  normalizeBullets,
  looksLikeYaml,
  wrapBareYamlBlocks,
  cleanTerminalFormatting,
  stripAgentNoise,
  isAgentNoiseLine,
  extractAIAnswer,
  ThinkingStepTracker,
  extractTaskRow,
  friendlyToolLabel,
} = _testing;

describe('stripAnsi', () => {
  it('removes color escape sequences', () => {
    expect(stripAnsi('\x1b[31mred text\x1b[0m')).toBe('red text');
  });

  it('removes cursor movement sequences', () => {
    expect(stripAnsi('\x1b[2Jhello\x1b[H')).toBe('hello');
  });

  it('removes character set selection', () => {
    expect(stripAnsi('\x1b(Bhello\x1b)0')).toBe('hello');
  });

  it('removes carriage returns', () => {
    expect(stripAnsi('line1\rline2')).toBe('line1line2');
  });

  it('handles text with no ANSI codes', () => {
    expect(stripAnsi('plain text')).toBe('plain text');
  });

  it('handles empty string', () => {
    expect(stripAnsi('')).toBe('');
  });

  it('removes multiple sequences', () => {
    expect(stripAnsi('\x1b[1m\x1b[32mbold green\x1b[0m')).toBe('bold green');
  });

  it('removes bracketed paste sequences', () => {
    expect(stripAnsi('\x1b[?2004h text \x1b[?2004l')).toBe(' text ');
  });
});

describe('normalizeBullets', () => {
  it('converts bullet character (•) to markdown list', () => {
    expect(normalizeBullets('• item one')).toBe('- item one');
  });

  it('converts middle dot (·) to markdown list', () => {
    expect(normalizeBullets('· item one')).toBe('- item one');
  });

  it('converts black square (▪) to markdown list', () => {
    expect(normalizeBullets('▪ item one')).toBe('- item one');
  });

  it('converts right-pointing triangle (▸) to markdown list', () => {
    expect(normalizeBullets('▸ item one')).toBe('- item one');
  });

  it('converts en-dash (–) to markdown list', () => {
    expect(normalizeBullets('– item one')).toBe('- item one');
  });

  it('preserves leading indentation', () => {
    expect(normalizeBullets('  • nested item')).toBe('  - nested item');
  });

  it('converts multiple bullets', () => {
    const input = '• first\n• second\n  • nested';
    const expected = '- first\n- second\n  - nested';
    expect(normalizeBullets(input)).toBe(expected);
  });

  it('does not convert bullet without trailing space', () => {
    expect(normalizeBullets('•text')).toBe('•text');
  });

  it('does not modify existing markdown list markers', () => {
    expect(normalizeBullets('- existing item')).toBe('- existing item');
  });

  it('handles empty string', () => {
    expect(normalizeBullets('')).toBe('');
  });

  it('handles text with no bullets', () => {
    expect(normalizeBullets('plain text')).toBe('plain text');
  });
});

describe('looksLikeYaml', () => {
  it('identifies key: value pairs', () => {
    expect(looksLikeYaml('name: my-pod')).toBe(true);
  });

  it('identifies keys with dots', () => {
    expect(looksLikeYaml('app.kubernetes.io/name: test')).toBe(true);
  });

  it('identifies keys with slashes', () => {
    expect(looksLikeYaml('kubernetes.io/name: test')).toBe(true);
  });

  it('identifies key with no value', () => {
    expect(looksLikeYaml('metadata:')).toBe(true);
  });

  it('identifies YAML list items', () => {
    expect(looksLikeYaml('- item')).toBe(true);
  });

  it('identifies bare list markers', () => {
    expect(looksLikeYaml('-')).toBe(true);
  });

  it('identifies YAML comments', () => {
    expect(looksLikeYaml('# this is a comment')).toBe(true);
  });

  it('identifies empty lines', () => {
    expect(looksLikeYaml('')).toBe(true);
  });

  it('identifies flow mappings', () => {
    expect(looksLikeYaml('{key: value}')).toBe(true);
  });

  it('identifies flow sequences', () => {
    expect(looksLikeYaml('[1, 2, 3]')).toBe(true);
  });

  it('identifies quoted keys', () => {
    expect(looksLikeYaml('"key with spaces": value')).toBe(true);
  });

  it('rejects plain text sentences', () => {
    expect(looksLikeYaml('This is a sentence about pods.')).toBe(false);
  });

  it('treats markdown headers starting with # as YAML comments', () => {
    // looksLikeYaml treats any line starting with # as a YAML comment
    expect(looksLikeYaml('## Header')).toBe(true);
    expect(looksLikeYaml('# Single')).toBe(true);
  });
});

describe('wrapBareYamlBlocks', () => {
  it('wraps a bare YAML block starting with apiVersion:', () => {
    const input = 'Here is the YAML:\napiVersion: v1\nkind: Pod\nmetadata:\n  name: test';
    const result = wrapBareYamlBlocks(input);
    expect(result).toContain('```yaml');
    expect(result).toContain('apiVersion: v1');
    expect(result).toContain('```');
  });

  it('wraps apiVersion with no value after colon', () => {
    const input = 'apiVersion:\nkind: Pod';
    const result = wrapBareYamlBlocks(input);
    expect(result).toContain('```yaml');
    expect(result).toContain('apiVersion:');
  });

  it('does not double-wrap YAML already in code fences', () => {
    const input = '```yaml\napiVersion: v1\nkind: Pod\n```';
    const result = wrapBareYamlBlocks(input);
    // Should not add extra fences
    const fenceCount = (result.match(/```/g) || []).length;
    expect(fenceCount).toBe(2);
  });

  it('wraps bare YAML even when another block is already fenced', () => {
    const input =
      '```yaml\napiVersion: v1\nkind: Pod\n```\n\nHere is another:\napiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: test';
    const result = wrapBareYamlBlocks(input);
    // Should have the original fences plus new ones
    const fenceCount = (result.match(/```/g) || []).length;
    expect(fenceCount).toBe(4); // original 2 + new 2
    expect(result).toContain('kind: Deployment');
  });

  it('stops at two consecutive blank lines', () => {
    const input = 'apiVersion: v1\nkind: Pod\n\n\nSome text after';
    const result = wrapBareYamlBlocks(input);
    expect(result).toContain('```yaml');
    expect(result).not.toContain('Some text after\n```');
  });

  it('stops at non-YAML lines', () => {
    const input = 'apiVersion: v1\nkind: Pod\nThis is not YAML';
    const result = wrapBareYamlBlocks(input);
    expect(result).toContain('```yaml');
    // The "This is not YAML" should be outside the fence
    const lines = result.split('\n');
    const closingFenceIdx = lines.lastIndexOf('```');
    const nonYamlIdx = lines.indexOf('This is not YAML');
    expect(nonYamlIdx).toBeGreaterThan(closingFenceIdx);
  });

  it('handles text with no YAML at all', () => {
    const input = 'Hello world\nThis is some text\nNo YAML here';
    expect(wrapBareYamlBlocks(input)).toBe(input);
  });

  it('handles empty string', () => {
    expect(wrapBareYamlBlocks('')).toBe('');
  });

  it('dedents indented YAML', () => {
    const input = '  apiVersion: v1\n  kind: Pod\n  metadata:\n    name: test';
    const result = wrapBareYamlBlocks(input);
    expect(result).toContain('apiVersion: v1');
    // The 2-space indent should be removed from the first level
    expect(result).toContain('kind: Pod');
  });

  it('preserves content inside existing code fences', () => {
    const input = '```bash\napiVersion: v1\n```\nSome text';
    const result = wrapBareYamlBlocks(input);
    // apiVersion inside bash fence should not be re-wrapped
    expect(result).toBe(input);
  });

  it('handles YAML with list items', () => {
    const input =
      'apiVersion: v1\nkind: Pod\nspec:\n  containers:\n  - name: test\n    image: nginx';
    const result = wrapBareYamlBlocks(input);
    expect(result).toContain('```yaml');
    expect(result).toContain('- name: test');
  });

  it('handles multiple bare YAML blocks', () => {
    const input =
      'First resource:\napiVersion: v1\nkind: Pod\n\n\nSecond resource:\napiVersion: v1\nkind: Service';
    const result = wrapBareYamlBlocks(input);
    const yamlFences = (result.match(/```yaml/g) || []).length;
    expect(yamlFences).toBe(2);
  });
});

describe('cleanTerminalFormatting', () => {
  it('removes Rich panel top border', () => {
    const input = '┏━━━━━━━━━━┓\nContent\n┗━━━━━━━━━━┛';
    const result = cleanTerminalFormatting(input);
    expect(result).toBe('Content');
  });

  it('unwraps Rich panel content lines', () => {
    const input = '┃ Hello World ┃';
    const result = cleanTerminalFormatting(input);
    expect(result).toBe('Hello World');
  });

  it('removes horizontal rule lines', () => {
    const input = 'Before\n────────────\nAfter';
    const result = cleanTerminalFormatting(input);
    expect(result).toBe('Before\nAfter');
  });

  it('removes double-line horizontal rules', () => {
    const input = 'Before\n════════════\nAfter';
    const result = cleanTerminalFormatting(input);
    expect(result).toBe('Before\nAfter');
  });

  it('does not remove short horizontal lines', () => {
    const input = 'Before\n───\nAfter';
    const result = cleanTerminalFormatting(input);
    expect(result).toBe('Before\n───\nAfter');
  });

  it('preserves content inside code fences', () => {
    const input = '```\n┃ inside fence ┃\n```';
    const result = cleanTerminalFormatting(input);
    expect(result).toContain('┃ inside fence ┃');
  });

  it('trims trailing whitespace', () => {
    const input = 'text with trailing spaces     ';
    const result = cleanTerminalFormatting(input);
    expect(result).toBe('text with trailing spaces');
  });

  it('handles empty panel content', () => {
    const input = '┃  ┃';
    const result = cleanTerminalFormatting(input);
    expect(result).toBe('');
  });

  it('handles empty string', () => {
    expect(cleanTerminalFormatting('')).toBe('');
  });

  it('handles nested Rich panel content', () => {
    const input = '┃ outer ┃\n┃   inner content ┃';
    const result = cleanTerminalFormatting(input);
    expect(result).toContain('outer');
    expect(result).toContain('inner content');
  });
});

describe('isAgentNoiseLine', () => {
  it('detects shell prompt lines', () => {
    expect(isAgentNoiseLine('root@aks-agent-abc123:/app# ')).toBe(true);
  });

  it('detects python command lines', () => {
    expect(isAgentNoiseLine('python /app/aks-agent.py')).toBe(true);
  });

  it('detects Task List header', () => {
    expect(isAgentNoiseLine('Task List:')).toBe(true);
  });

  it('detects table borders', () => {
    expect(isAgentNoiseLine('+------+------+')).toBe(true);
  });

  it('detects table header rows', () => {
    expect(isAgentNoiseLine('| ID | Description | Status |')).toBe(true);
  });

  it('detects table data rows', () => {
    expect(isAgentNoiseLine('| t1 | Some task | [~] in_progress |')).toBe(true);
  });

  it('detects show hints', () => {
    expect(isAgentNoiseLine(' - /show 1 to view contents')).toBe(true);
  });

  it('detects user echo', () => {
    expect(isAgentNoiseLine('User: what pods are running?')).toBe(true);
  });

  it('does not match plain text', () => {
    expect(isAgentNoiseLine('Here are the running pods:')).toBe(false);
  });

  it('does not match YAML list items', () => {
    expect(isAgentNoiseLine('- name: my-pod')).toBe(false);
  });

  it('does not match markdown horizontal rules', () => {
    expect(isAgentNoiseLine('---')).toBe(false);
  });

  it('does not match empty string', () => {
    expect(isAgentNoiseLine('')).toBe(false);
  });
});

describe('stripAgentNoise', () => {
  it('removes noise lines from output', () => {
    const lines = [
      'root@aks-agent-abc:/app# python /app/aks-agent.py',
      'Task List:',
      '+------+------+',
      '| ID | Description |',
      'AI response here',
    ];
    const result = stripAgentNoise(lines);
    expect(result).toEqual(['AI response here']);
  });

  it('collapses multiple blank lines', () => {
    const lines = ['line 1', '', '', '', 'line 2'];
    const result = stripAgentNoise(lines);
    expect(result).toEqual(['line 1', '', 'line 2']);
  });

  it('preserves content inside code fences', () => {
    const lines = [
      '```',
      'root@host:/# this should stay',
      'Task List:',
      '```',
      'root@host:/# prompt outside',
    ];
    const result = stripAgentNoise(lines);
    // Inside fence should be preserved
    expect(result).toContain('root@host:/# this should stay');
    expect(result).toContain('Task List:');
    // Outside fence noise should be removed (pattern matches ^root@)
    expect(result).not.toContain('root@host:/# prompt outside');
  });

  it('handles empty input', () => {
    expect(stripAgentNoise([])).toEqual([]);
  });

  it('preserves normal content', () => {
    const lines = ['Here are the pods:', '- pod-1', '- pod-2'];
    expect(stripAgentNoise(lines)).toEqual(lines);
  });
});

describe('extractAIAnswer', () => {
  it('extracts content after "AI:" prefix on same line', () => {
    const input = 'AI: Here is the answer.';
    expect(extractAIAnswer(input)).toBe('Here is the answer.');
  });

  it('extracts content after "AI:" on its own line', () => {
    const input = 'AI:\nHere is the answer.';
    expect(extractAIAnswer(input)).toBe('Here is the answer.');
  });

  it('strips ANSI codes from output', () => {
    const input = 'AI: \x1b[32mGreen text\x1b[0m';
    expect(extractAIAnswer(input)).toBe('Green text');
  });

  it('removes trailing bash prompts', () => {
    const input = 'AI: The answer is here.\nroot@aks-agent:/app#';
    expect(extractAIAnswer(input)).toBe('The answer is here.');
  });

  it('removes leading and trailing blank lines', () => {
    const input = 'AI:\n\n\nActual content\n\n\n';
    expect(extractAIAnswer(input)).toBe('Actual content');
  });

  it('strips agent noise from content', () => {
    const input = 'AI: The answer\nroot@host:/# echo done\n+------+\nMore content';
    const result = extractAIAnswer(input);
    expect(result).toContain('The answer');
    expect(result).toContain('More content');
    expect(result).not.toContain('root@host');
    expect(result).not.toContain('+------+');
  });

  it('normalizes Unicode bullets', () => {
    const input = 'AI:\n• first item\n• second item';
    const result = extractAIAnswer(input);
    expect(result).toContain('- first item');
    expect(result).toContain('- second item');
  });

  it('wraps bare YAML blocks', () => {
    const input = 'AI: Here is the YAML:\napiVersion: v1\nkind: Pod\nmetadata:\n  name: test';
    const result = extractAIAnswer(input);
    expect(result).toContain('```yaml');
  });

  it('cleans Rich terminal formatting', () => {
    const input = 'AI:\n┏━━━━━━━━━━┓\n┃ Content  ┃\n┗━━━━━━━━━━┛';
    const result = extractAIAnswer(input);
    expect(result).toContain('Content');
    expect(result).not.toContain('┏');
    expect(result).not.toContain('┗');
    expect(result).not.toContain('┃');
  });

  it('falls back to full output when no "AI:" line found', () => {
    const input = 'Some content without AI prefix';
    expect(extractAIAnswer(input)).toBe('Some content without AI prefix');
  });

  it('handles multiline AI response with mixed content', () => {
    const input = [
      'root@aks-agent:/app# python /app/aks-agent.py',
      'Task List:',
      '+------+------+',
      '| t1 | Check pods | [~] in_progress |',
      'AI: Here are the results:',
      '',
      '## Running Pods',
      '- pod-1',
      '- pod-2',
      '',
      'root@aks-agent:/app#',
    ].join('\n');
    const result = extractAIAnswer(input);
    expect(result).toContain('Here are the results:');
    expect(result).toContain('## Running Pods');
    expect(result).not.toContain('Task List');
    expect(result).not.toContain('root@aks-agent');
  });

  it('handles "AI:" with whitespace after colon but no content', () => {
    const input = 'AI:   \nThe answer starts here';
    const result = extractAIAnswer(input);
    expect(result).toBe('The answer starts here');
  });

  it('handles empty output', () => {
    expect(extractAIAnswer('')).toBe('');
  });

  it('handles output with only noise', () => {
    const input = 'root@host:/# python /app/aks-agent.py\nTask List:\n+----+';
    const result = extractAIAnswer(input);
    expect(result).toBe('');
  });
});

describe('ThinkingStepTracker', () => {
  it('tracks model loading', () => {
    const tracker = new ThinkingStepTracker();
    const changed = tracker.processLine("Loaded models: ['gpt-4']");
    expect(changed).toBe(true);
    expect(tracker.steps).toHaveLength(1);
    expect(tracker.steps[0].label).toContain('gpt-4');
    expect(tracker.steps[0].phase).toBe('init');
    expect(tracker.steps[0].status).toBe('completed');
  });

  it('tracks toolset loading', () => {
    const tracker = new ThinkingStepTracker();
    tracker.processLine('✅ Toolset kubernetes loaded');
    expect(tracker.steps).toHaveLength(1);
    expect(tracker.steps[0].label).toContain('kubernetes');
    expect(tracker.steps[0].phase).toBe('init');
  });

  it('tracks task list rows', () => {
    const tracker = new ThinkingStepTracker();
    tracker.processLine('| t1 | List pods | [ ] pending |');
    expect(tracker.steps).toHaveLength(1);
    expect(tracker.steps[0].label).toBe('List pods');
    expect(tracker.steps[0].status).toBe('pending');
    expect(tracker.steps[0].phase).toBe('planning');
  });

  it('updates task status from pending to in_progress', () => {
    const tracker = new ThinkingStepTracker();
    tracker.processLine('| t1 | List pods | [ ] pending |');
    tracker.processLine('| t1 | List pods | [~] in_progress |');
    expect(tracker.steps).toHaveLength(1);
    expect(tracker.steps[0].status).toBe('running');
  });

  it('updates task status to completed', () => {
    const tracker = new ThinkingStepTracker();
    tracker.processLine('| t1 | List pods | [ ] pending |');
    tracker.processLine('| t1 | List pods | [✓] completed |');
    expect(tracker.steps).toHaveLength(1);
    expect(tracker.steps[0].status).toBe('completed');
  });

  it('tracks multiple tasks', () => {
    const tracker = new ThinkingStepTracker();
    tracker.processLine('| t1 | List pods | [ ] pending |');
    tracker.processLine('| t2 | Check services | [ ] pending |');
    expect(tracker.steps).toHaveLength(2);
  });

  it('tracks running tool calls', () => {
    const tracker = new ThinkingStepTracker();
    tracker.processLine('Running tool #1 web_search: searching');
    expect(tracker.steps).toHaveLength(1);
    expect(tracker.steps[0].label).toBe('Searching the web');
    expect(tracker.steps[0].status).toBe('running');
    expect(tracker.steps[0].phase).toBe('executing');
  });

  it('marks tool calls as completed', () => {
    const tracker = new ThinkingStepTracker();
    tracker.processLine('Running tool #1 web_search: searching');
    tracker.processLine('Finished #1 in 2.3s');
    expect(tracker.steps[0].status).toBe('completed');
  });

  it('skips TodoWrite tool calls', () => {
    const tracker = new ThinkingStepTracker();
    tracker.processLine('Running tool #1 TodoWrite: updating tasks');
    expect(tracker.steps).toHaveLength(0);
  });

  it('skips call_kubectl tool calls', () => {
    const tracker = new ThinkingStepTracker();
    tracker.processLine('Running tool #1 call_kubectl: get pods');
    expect(tracker.steps).toHaveLength(0);
  });

  it('ignores empty lines', () => {
    const tracker = new ThinkingStepTracker();
    expect(tracker.processLine('')).toBe(false);
    expect(tracker.processLine('   ')).toBe(false);
  });

  it('ignores Thinking... indicator', () => {
    const tracker = new ThinkingStepTracker();
    expect(tracker.processLine('Thinking...')).toBe(false);
  });

  it('handles wrapped task table rows', () => {
    const tracker = new ThinkingStepTracker();
    // First line is partial
    tracker.processLine('| t1 | Very long task description that wraps');
    // Second line completes it
    tracker.processLine('across lines | [ ] pending |');
    expect(tracker.steps).toHaveLength(1);
    expect(tracker.steps[0].label).toBe('Very long task description that wraps across lines');
  });
});

describe('extractTaskRow', () => {
  it('parses pending task', () => {
    const result = extractTaskRow('| t1 | List pods | [ ] pending |');
    expect(result).toEqual({ content: 'List pods', status: 'pending' });
  });

  it('parses in_progress task', () => {
    const result = extractTaskRow('| t1 | Check services | [~] in_progress |');
    expect(result).toEqual({ content: 'Check services', status: 'in_progress' });
  });

  it('parses completed task', () => {
    const result = extractTaskRow('| t2 | Deploy app | [✓] completed |');
    expect(result).toEqual({ content: 'Deploy app', status: 'completed' });
  });

  it('returns null for non-task lines', () => {
    expect(extractTaskRow('regular text')).toBeNull();
  });

  it('returns null for table borders', () => {
    expect(extractTaskRow('+------+------+')).toBeNull();
  });

  it('returns null for header row', () => {
    expect(extractTaskRow('| ID | Description | Status |')).toBeNull();
  });
});

describe('friendlyToolLabel', () => {
  it('returns friendly label for web_search', () => {
    expect(friendlyToolLabel('Running tool #1 web_search: query')).toBe('Searching the web');
  });

  it('returns friendly label for read_file', () => {
    expect(friendlyToolLabel('Running tool #2 read_file: /path/to/file')).toBe('Reading file');
  });

  it('returns friendly label for file_read', () => {
    expect(friendlyToolLabel('Running tool #3 file_read: /path/to/file')).toBe('Reading file');
  });

  it('returns null for call_kubectl', () => {
    expect(friendlyToolLabel('Running tool #1 call_kubectl: get pods')).toBeNull();
  });

  it('returns null for TodoWrite', () => {
    expect(friendlyToolLabel('Running tool #1 TodoWrite: update')).toBeNull();
  });

  it('returns generic label for unknown tool', () => {
    expect(friendlyToolLabel('Running tool #1 custom_tool: args')).toBe('Running custom_tool');
  });

  it('returns fallback for non-matching input', () => {
    expect(friendlyToolLabel('some other text')).toBe('Running tool');
  });
});
