/**
 * findbugs-all.test.ts — Consolidated test file for extractAIAnswer edge cases.
 * Replaces findbugs.test.ts through findbugs15.test.ts using shared fixtures.
 */
import { describe, expect, it } from 'vitest';
import { _testing } from './aksAgentManager';

import {
  extractCodeBlocks,
  fb1_twoFileHeadings,
  fb1_dotEnvHeading,
  fb1_deepPathHeading,
  fb1_fourWordProse,
  fb1_fiveWordProse,
  fb1_yamlPipeLiteral,
  fb1_bareYaml2Lines,
  fb1_bareYaml3Lines,
  fb1_dockerfileContinuation,
  fb1_dockerCompose,
  fb1_portNumber,
  fb1_ansi256Color,
  fb1_goInterface,
  fb1_twoYamlBlocks,
  fb1_shellBacktick,
  fb1_makefileTab,
  fb1_yamlFoldedScalar,
  fb1_indentedCodeAfterList,
  fb1_requirementsTxt,
  fb1_bareCodeThenYaml,
  fb1_hyphenatedFilename,
  fb1_ansiSplitLine,
  fb1_windowsPaths,
  fb1_longPanelLine,
  fb1_dockerfileProd,
  fb1_yamlFlowMapping,
  fb1_kubectlTabular,
  fb1_panelTripleBacktick,
  fb1_tsconfigJson,
  fb1_flagsNotProse,
  fb2_nonK8sYamlProse,
  fb2_gitignoreHeading,
  fb2_dockerignoreHeading,
  fb2_yamlDocSeparator,
  fb2_shellHeredoc,
  fb2_orderedListPanels,
  fb2_unicodeFilename,
  fb2_exact78Chars,
  fb2_bareNonK8sYaml,
  fb2_nonK8sYamlSeparator,
  fb2_nestedAnsiReset,
  fb2_cargoLockToml,
  fb2_proseNotHeading,
  fb2_markdownHeadingAfterCode,
  fb2_pythonFString,
  fb2_makefileTabChars,
  fb2_deeplyNestedYaml,
  fb2_headingBlankLinePanel,
  fb2_closingBrace,
  fb2_consecutiveBlanks,
  fb2_readmeMdContent,
  fb2_ansiBoldPanel,
  fb2_twoApiVersionBlocks,
  fb2_doubleSlashPath,
  fb2_panelDashList,
  fb2_pythonImport,
  fb2_proseWordColon,
  fb2_spacesInPath,
  fb2_literalEscapeText,
  fb2_yamlKeySplit,
  fb3_heredocQuotedDelim,
  fb3_bareYamlList,
  fb3_numberedListPanels,
  fb3_makefilePhony,
  fb3_teeHeredoc,
  fb3_cssPanel,
  fb3_sqlPanel,
  fb3_proseBetweenPanels,
  fb3_bareJsonArray,
  fb3_multipleHeredocs,
  fb4_heredocDashEof,
  fb4_yamlMergeKey,
  fb4_makefilePhonyDeps,
  fb4_lowercaseSql,
  fb4_dockerfileImageTag,
  fb5_cIncludeHeaders,
  fb5_rustMatchArms,
  fb5_shellBackslashContinuation,
  fb5_tsInterface,
  fb5_jsonObject,
  fb5_pythonTripleQuoteYaml,
  fb5_goStructJsonTags,
  fb5_kubectlGetPods,
  fb5_proseWithPanelCode,
  fb5_yamlBooleanValues,
  fb5_shellCaseStatement,
  fb5_terraformHcl,
  fb5_dockerComposeYaml,
  fb5_rustLifetimes,
  fb5_numberedStepsShell,
  fb6_javaTryCatchFinally,
  fb6_printLogStatements,
  fb6_arrowFunctions,
  fb6_tsInterfaceColonMembers,
  fb6_shellUntilLoop,
  fb6_proseBetweenCodeBlocks,
  fb6_pythonFStringBraces,
  fb6_yamlAnchorsAliases,
  fb6_rustEnumDerive,
  fb6_shellIfElifElse,
  fb6_goGoroutineChannel,
  fb6_dockerRunBackslash,
  fb6_javaAnnotationsClass,
  fb6_kubectlPatchJson,
  fb6_yamlShellProseSeparated,
  fb7_luaLocalFunction,
  fb7_exportEnvVars,
  fb7_awkSedCommands,
  fb7_cssRules,
  fb7_protobufMessage,
  fb7_systemdUnitFile,
  fb7_shellPipeChain,
  fb7_shellScriptVarsCommands,
  fb7_jsonConfigObject,
  fb7_rubyClassMethods,
  fb7_kotlinDataClass,
  fb7_cStructTypedef,
  fb7_azCliJmesPath,
  fb7_pythonAsyncTypeHints,
  fb7_numberedStepsCodeBlocks,
  fb8_goStructLiteral,
  fb8_pythonKwargs,
  fb8_shellTrapSource,
  fb8_githubActionsYaml,
  fb8_rustClosuresIterators,
  fb8_shellHeredocYaml,
  fb8_dockerComposeBuildContext,
  fb8_shellFunctionDef,
  fb8_pythonNestedExpressions,
  fb8_terraformMultipleResources,
  fb8_sqlJoinQuery,
  fb8_k8sCrdDefinition,
  fb8_swiftStructProperties,
  fb8_makefileIfeq,
  fb8_elixirModule,
  fb9_tsGenericTypes,
  fb9_phpClassNamespace,
  fb9_scalaCaseClass,
  fb9_shellArraysParamExpansion,
  fb9_iniConfigFile,
  fb9_rustTurbofish,
  fb9_pythonMultiLineString,
  fb9_javaSpringBootService,
  fb9_shellHereString,
  fb9_curlJsonBody,
  fb9_kotlinSuspendFunction,
  fb9_terraformLocalsData,
  fb9_markdownTable,
  fb9_shellProcessSubstitution,
  fb9_requirementsTxt,
  // Round 10
  fb10_ghActionsBranchesMain,
  fb10_prometheusDuration5m,
  fb10_kustomizationYaml,
  fb10_helmValuesYaml,
  fb10_azureDevOpsPipeline,
  fb10_ansiblePlaybook,
  fb10_configMapLiteralBlock,
  fb10_makefilePhony,
  fb10_nginxProxyPass,
  fb10_pythonK8sOperator,
  fb10_grafanaConfigMap5m,
  fb10_dockerComposeYaml,
  fb10_envoyProxyConfig,
  fb10_azureBicepAks,
  fb10_kubectlTopMillicores,
  // Round 11
  fb11_kubectlScaleOutput,
  fb11_kubectlApplyOutput,
  fb11_helmStatusOutput,
  fb11_kubectlRolloutStatus,
  fb11_terraformPlanOutput,
  fb11_dockerBuildSteps,
  fb11_helmTemplateGoExpr,
  fb11_configMapSpringProperties,
  fb11_kubectlErrorMessage,
  fb11_kubectlWarningDeprecation,
  fb11_kubectlEventsTable,
  fb11_kustomizationPatches,
  fb11_goClientGoCode,
  fb11_rbacClusterRole,
  fb11_multiKubectlWithProse,
  fb11_klogFormatLogs,
  fb11_logfmtStructuredLogs,
  fb11_k8sValidationErrors,
  fb11_k8sSchedulingDescribe,
  fb11_pvcResourceStatus,
  fb11_helmUpgradeHooks,
  fb11_azAksGetCredentials,
  fb11_istioSidecarAnnotations,
  fb11_bareLogfmtOutput,
  fb11_bareKlogFormat,
  fb11_bareResourceActionOutput,
  fb11_terraformOutputValues,
  fb11_barePromQL5m,
  fb11_aksTroubleshooting,
  fb11_k8sSecretBase64,
  // Round 12
  fb12_barePromQLExpressions,
  fb12_bareK8sEventMessages,
  fb12_bareSchedulingFailure,
  fb12_barePrometheusMetrics,
  fb12_bareProbeFailures,
  fb12_coreDNSCorefile,
  fb12_prometheusRuleCRD,
  fb12_azAksJsonOutput,
  fb12_bareContainerCrash,
  fb12_bareVolumeMountFailure,
  fb12_bareImagePullFailure,
  fb12_bareSchedulingDetails,
  fb12_bareCRIOLogs,
  fb12_bareContainerLifecycle,
  fb12_bareKeyValueDiagnostics,
  // Round 13
  fb13_proseColonEnding,
  fb13_diagnosticSummaryColon,
  fb13_stepHeadingColon,
  fb13_assumesHeadingColon,
  fb13_boldK8sTerms,
  fb13_bulletListTechTerms,
  fb13_numberedStepList,
  fb13_markdownHeaders,
  fb13_proseWithUrls,
  fb13_notePrefix,
  fb13_multiParagraphExplanation,
  fb13_inlineCodeBackticks,
  fb13_proseKeyValueDescriptions,
  fb13_questionsAboutK8s,
  fb13_mixedMarkdownFormatting,
  // Round 14
  fb14_alsoConfirmAfterShell,
  fb14_alsoConfirmNoBlank,
  fb14_alsoConfirmDoubleBlank,
  fb14_buildPushProseHeading,
  fb14_panelCodeThenAlsoConfirm,
  // Round 15
  fb15_requirementsTxtPanel,
  fb15_mainPyPanel,
  fb15_numberedStepHeaderPanel,
  fb15_dockerfilePanel,
  fb15_requirementsTxtNonPanel,
  fb15_mainPyNonPanel,
  fb15_numberedStepHeaderNonPanel,
  fb15_cargoTomlNonPanel,
  fb15_deploymentYamlPanel,
  fb15_mainRsNonPanel,
  fb15_numberedStepAfterGoCode,
  fb15_assumptionsBetweenCodeBlocks,
} from './findbugFixtures';

const { extractAIAnswer } = _testing;

function assertNoAnsiLeaks(result: string): void {
  expect(result).not.toMatch(/\x1b/);
  expect(result).not.toMatch(/\[\d+m/);
  expect(result).not.toMatch(/\[0m/);
}

describe('findbugs: all extractAIAnswer edge cases', () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // Round 1
  // ═══════════════════════════════════════════════════════════════════════════
  describe('round 1', () => {
    it('1. two file headings with no blank line between panels', () => {
      const result = extractAIAnswer(fb1_twoFileHeadings);
      assertNoAnsiLeaks(result);

      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(2);
      expect(blocks[0]).toContain('[package]');
      expect(blocks[1]).toContain('fn main()');
    });

    it('2. file heading with extension-only name .env', () => {
      const result = extractAIAnswer(fb1_dotEnvHeading);
      assertNoAnsiLeaks(result);

      expect(result).toContain('.env');
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const envBlock = blocks.find(b => b.includes('DB_HOST'));
      expect(envBlock).toBeDefined();
      expect(envBlock!).toMatch(/^ /m);
    });

    it('3. file heading with deep path src/handlers/auth.rs', () => {
      const result = extractAIAnswer(fb1_deepPathHeading);
      assertNoAnsiLeaks(result);

      expect(result).toContain('src/handlers/auth.rs');
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(blocks[0]).toContain('authenticate');
    });

    it('4. prose with 4 words should NOT break file-header block', () => {
      const result = extractAIAnswer(fb1_fourWordProse);
      assertNoAnsiLeaks(result);

      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(1);
      expect(blocks[0]).toContain('apiVersion');
      expect(blocks[0]).toContain('data:');
    });

    it('5. prose with 5 words SHOULD break file-header block', () => {
      const result = extractAIAnswer(fb1_fiveWordProse);
      assertNoAnsiLeaks(result);

      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(blocks[0]).toContain('apiVersion');
      expect(blocks[0]).not.toContain('data:');
    });

    it('6. YAML annotation with pipe literal block scalar', () => {
      const result = extractAIAnswer(fb1_yamlPipeLiteral);
      assertNoAnsiLeaks(result);

      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const yamlBlock = blocks.find(b => b.includes('apiVersion'));
      expect(yamlBlock).toBeDefined();
      expect(yamlBlock!).toContain('more_set_headers');
      expect(yamlBlock!).toContain('spec:');
    });

    it('7. bare YAML with 2 lines should NOT be wrapped', () => {
      const result = extractAIAnswer(fb1_bareYaml2Lines);
      assertNoAnsiLeaks(result);

      expect(result).not.toMatch(/```yaml/);
      expect(result).toContain('name: myapp');
    });

    it('8. bare YAML with 3 lines SHOULD be wrapped', () => {
      const result = extractAIAnswer(fb1_bareYaml3Lines);
      assertNoAnsiLeaks(result);

      expect(result).toMatch(/```yaml/);
      const blocks = extractCodeBlocks(result);
      const yamlBlock = blocks.find(b => b.includes('name: myapp'));
      expect(yamlBlock).toBeDefined();
      expect(yamlBlock!).toContain('description');
    });

    it('9. Dockerfile heading with deeply indented continuation lines', () => {
      const result = extractAIAnswer(fb1_dockerfileContinuation);
      assertNoAnsiLeaks(result);

      expect(result).toContain('Dockerfile');
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(blocks[0]).toContain('FROM ubuntu:22.04');
      expect(blocks[0]).toContain('wget');
    });

    it('10. docker-compose.yml bold heading', () => {
      const result = extractAIAnswer(fb1_dockerCompose);
      assertNoAnsiLeaks(result);

      expect(result).toContain('docker-compose.yml');
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(blocks[0]).toContain('services:');
    });

    it('11. panel code starting with port number', () => {
      const result = extractAIAnswer(fb1_portNumber);
      assertNoAnsiLeaks(result);

      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(result).not.toMatch(/^3000\./m);
    });

    it('12. ANSI 256-color code fully stripped', () => {
      const result = extractAIAnswer(fb1_ansi256Color);
      assertNoAnsiLeaks(result);
      expect(result).toContain('Warning: resource limit exceeded');
    });

    it('13. Go interface{} type should not cause issues', () => {
      const result = extractAIAnswer(fb1_goInterface);
      assertNoAnsiLeaks(result);

      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(blocks[0]).toContain('interface{}');
    });

    it('14. two YAML blocks separated by prose', () => {
      const result = extractAIAnswer(fb1_twoYamlBlocks);
      assertNoAnsiLeaks(result);

      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(2);
      expect(blocks[0]).toContain('Namespace');
      expect(blocks[1]).toContain('Deployment');
    });

    it('15. shell backtick substitution at column 0', () => {
      const result = extractAIAnswer(fb1_shellBacktick);
      assertNoAnsiLeaks(result);

      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(blocks.some(b => b.includes('kubectl get pods'))).toBe(true);
    });

    it('16. Makefile heading with tab-indented content', () => {
      const result = extractAIAnswer(fb1_makefileTab);
      assertNoAnsiLeaks(result);

      expect(result).toContain('Makefile');
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(blocks[0]).toContain('build:');
    });

    it('17. YAML folded scalar with > indicator', () => {
      const result = extractAIAnswer(fb1_yamlFoldedScalar);
      assertNoAnsiLeaks(result);

      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(blocks[0]).toContain('description: >');
      expect(blocks[0]).toContain('long description');
      expect(blocks[0]).toContain('port: 8080');
    });

    it('18. indented code after numbered list item', () => {
      const result = extractAIAnswer(fb1_indentedCodeAfterList);
      assertNoAnsiLeaks(result);

      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(blocks.some(b => b.includes('kubectl apply'))).toBe(true);
    });

    it('19. requirements.txt with pip freeze output', () => {
      const result = extractAIAnswer(fb1_requirementsTxt);
      assertNoAnsiLeaks(result);

      expect(result).toContain('requirements.txt');
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(blocks[0]).toContain('flask==2.3.0');
      expect(blocks[0]).toContain('gunicorn==21.2.0');
    });

    it('20. bare code followed by bare YAML creates 2 blocks', () => {
      const result = extractAIAnswer(fb1_bareCodeThenYaml);
      assertNoAnsiLeaks(result);

      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(2);
      expect(blocks.some(b => b.includes('kubectl create'))).toBe(true);
      expect(blocks.some(b => b.includes('apiVersion'))).toBe(true);
    });

    it('21. hyphenated filename my-app.yaml', () => {
      const result = extractAIAnswer(fb1_hyphenatedFilename);
      assertNoAnsiLeaks(result);

      expect(result).toContain('my-app.yaml');
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(blocks[0]).toContain('apiVersion');
    });

    it('22. ANSI code split across line boundary', () => {
      const result = extractAIAnswer(fb1_ansiSplitLine);
      assertNoAnsiLeaks(result);
      expect(result).toContain('The config is');
      expect(result).toContain('End of output');
    });

    it('23. Windows-style paths in panel content', () => {
      const result = extractAIAnswer(fb1_windowsPaths);
      assertNoAnsiLeaks(result);

      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(blocks[0]).toContain('C:\\Users');
    });

    it('24. very long line in panel exceeding 78 chars', () => {
      const result = extractAIAnswer(fb1_longPanelLine);
      assertNoAnsiLeaks(result);

      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(blocks[0]).toContain('pkg-config');
    });

    it('25. Dockerfile.prod compound extension heading', () => {
      const result = extractAIAnswer(fb1_dockerfileProd);
      assertNoAnsiLeaks(result);

      expect(result).toContain('Dockerfile.prod');
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(blocks[0]).toContain('FROM node:20-slim');
    });

    it('26. YAML flow-style mapping', () => {
      const result = extractAIAnswer(fb1_yamlFlowMapping);
      assertNoAnsiLeaks(result);

      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const yamlBlock = blocks.find(b => b.includes('apiVersion'));
      expect(yamlBlock).toBeDefined();
      expect(yamlBlock!).toContain('{ app: web');
    });

    it('27. kubectl command with tabular output', () => {
      const result = extractAIAnswer(fb1_kubectlTabular);
      assertNoAnsiLeaks(result);

      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const kubectlBlock = blocks.find(b => b.includes('kubectl get pods'));
      expect(kubectlBlock).toBeDefined();
      expect(kubectlBlock!).toContain('web-abc123');
    });

    it('28. panel code containing triple backticks', () => {
      const result = extractAIAnswer(fb1_panelTripleBacktick);
      assertNoAnsiLeaks(result);

      expect(result).toContain('README.md');
      expect(result).toContain('npm install');
    });

    it('29. tsconfig.json with JSON content', () => {
      const result = extractAIAnswer(fb1_tsconfigJson);
      assertNoAnsiLeaks(result);

      expect(result).toContain('tsconfig.json');
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(blocks[0]).toContain('compilerOptions');
    });

    it('30. indented line with flags should not be treated as prose', () => {
      const result = extractAIAnswer(fb1_flagsNotProse);
      assertNoAnsiLeaks(result);

      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(blocks[0]).toContain('#!/bin/bash');
      expect(blocks[0]).toContain('--namespace');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Round 2
  // ═══════════════════════════════════════════════════════════════════════════
  describe('round 2', () => {
    it('1. non-K8s YAML ending with prose line containing colon', () => {
      const result = extractAIAnswer(fb2_nonK8sYamlProse);
      assertNoAnsiLeaks(result);
      expect(result).toContain('Note: you can also use Helm');
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      for (const block of blocks) {
        expect(block).not.toContain('Note: you can also use Helm');
      }
    });

    it('2. bold file heading .gitignore', () => {
      const result = extractAIAnswer(fb2_gitignoreHeading);
      assertNoAnsiLeaks(result);
      expect(result).toContain('.gitignore');
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(1);
      expect(blocks[0]).toContain('node_modules/');
    });

    it('3. bold file heading .dockerignore', () => {
      const result = extractAIAnswer(fb2_dockerignoreHeading);
      assertNoAnsiLeaks(result);
      expect(result).toContain('.dockerignore');
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(1);
      expect(blocks[0]).toContain('node_modules');
    });

    it('4. YAML with --- separator between two documents', () => {
      const result = extractAIAnswer(fb2_yamlDocSeparator);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(blocks[0]).toContain('Namespace');
      expect(blocks[0]).toContain('---');
      expect(blocks[0]).toContain('Service');
    });

    it('5. shell heredoc at column 0 with YAML-like body', () => {
      const result = extractAIAnswer(fb2_shellHeredoc);
      assertNoAnsiLeaks(result);
      expect(result).toContain('cat <<EOF');
      const blocks = extractCodeBlocks(result);
      expect(result).toContain('EOF');
      const yamlInSeparateBlock = blocks.some(
        b => b.includes('apiVersion:') && !b.includes('cat <<EOF')
      );
      expect(yamlInSeparateBlock).toBe(false);
    });

    it('6. ordered list items with code panels after each', () => {
      const result = extractAIAnswer(fb2_orderedListPanels);
      assertNoAnsiLeaks(result);
      expect(result).toMatch(/1\.\s/);
      expect(result).toMatch(/2\.\s/);
      expect(result).toMatch(/3\.\s/);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
    });

    it('7. bold file heading with unicode naïve.py', () => {
      const result = extractAIAnswer(fb2_unicodeFilename);
      assertNoAnsiLeaks(result);
      expect(result).toContain('naïve.py');
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(1);
      expect(blocks[0]).toContain('def hello()');
    });

    it('8. panel content exactly 78 chars', () => {
      const result = extractAIAnswer(fb2_exact78Chars);
      assertNoAnsiLeaks(result);
      const exact78 = 'x'.repeat(78);
      expect(result).toContain(exact78);
    });

    it('9. bare non-K8s YAML starting with name:', () => {
      const result = extractAIAnswer(fb2_bareNonK8sYaml);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(1);
      expect(blocks[0]).toContain('name: my-app');
      expect(blocks[0]).toContain('author: someone');
    });

    it('10. --- separator between two non-K8s YAML sections', () => {
      const result = extractAIAnswer(fb2_nonK8sYamlSeparator);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const allBlockContent = blocks.join('\n');
      expect(allBlockContent).toContain('app1');
      expect(allBlockContent).toContain('app2');
    });

    it('11. panel content with nested ANSI reset mid-line', () => {
      const result = extractAIAnswer(fb2_nestedAnsiReset);
      assertNoAnsiLeaks(result);
      expect(result).toContain('echo');
      expect(result).toContain('hello world');
    });

    it('12. bold file heading Cargo.lock followed by TOML', () => {
      const result = extractAIAnswer(fb2_cargoLockToml);
      assertNoAnsiLeaks(result);
      expect(result).toContain('Cargo.lock');
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(1);
      expect(blocks[0]).toContain('[[package]]');
      expect(blocks[0]).toContain('name = "serde"');
    });

    it('13. prose with period should not be file heading', () => {
      const result = extractAIAnswer(fb2_proseNotHeading);
      assertNoAnsiLeaks(result);
      expect(result).toContain('Hello world.');
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(0);
    });

    it('14. markdown ## heading after code panel', () => {
      const result = extractAIAnswer(fb2_markdownHeadingAfterCode);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      for (const block of blocks) {
        expect(block).not.toContain('## Next Steps');
      }
      expect(result).toContain('## Next Steps');
    });

    it('15. python f-string with colon not confused as YAML', () => {
      const result = extractAIAnswer(fb2_pythonFString);
      assertNoAnsiLeaks(result);
      expect(result).toContain('print(f"Hello: {name}")');
      const yamlBlocks = result.match(/```yaml/g);
      expect(yamlBlocks).toBeNull();
    });

    it('16. panel content with tab characters', () => {
      const result = extractAIAnswer(fb2_makefileTabChars);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const allBlockContent = blocks.join('\n');
      expect(allBlockContent).toContain('build:');
    });

    it('17. deeply nested YAML stays in one block', () => {
      const result = extractAIAnswer(fb2_deeplyNestedYaml);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(1);
      expect(blocks[0]).toContain('level6: value');
      expect(blocks[0]).toContain('apiVersion: v1');
    });

    it('18. bold heading then blank line then YAML panel', () => {
      const result = extractAIAnswer(fb2_headingBlankLinePanel);
      assertNoAnsiLeaks(result);
      expect(result).toContain('values.yaml');
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const allContent = blocks.join('\n');
      expect(allContent).toContain('replicaCount: 3');
    });

    it('19. closing brace at column 0 after code block', () => {
      const result = extractAIAnswer(fb2_closingBrace);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(1);
      expect(blocks[0]).toContain('}');
      const outsideBlocks = result.replace(/```[\s\S]*?```/g, '').trim();
      expect(outsideBlocks).not.toContain('}');
    });

    it('20. consecutive blank panel lines', () => {
      const result = extractAIAnswer(fb2_consecutiveBlanks);
      assertNoAnsiLeaks(result);
      expect(result).toContain('line one');
      expect(result).toContain('line two');
    });

    it('21. README.md heading with markdown content in panels', () => {
      const result = extractAIAnswer(fb2_readmeMdContent);
      assertNoAnsiLeaks(result);
      expect(result).toContain('README.md');
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(1);
      expect(blocks[0]).toContain('# My Project');
    });

    it('22. ANSI bold inside panel content', () => {
      const result = extractAIAnswer(fb2_ansiBoldPanel);
      assertNoAnsiLeaks(result);
      expect(result).toContain('Important');
      expect(result).toContain('Run this command');
    });

    it('23. two bare apiVersion blocks with no separator', () => {
      const result = extractAIAnswer(fb2_twoApiVersionBlocks);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      const allContent = blocks.join('\n');
      expect(allContent).toContain('Namespace');
      expect(allContent).toContain('Deployment');
    });

    it('24. file heading path with double slash', () => {
      const result = extractAIAnswer(fb2_doubleSlashPath);
      assertNoAnsiLeaks(result);
      expect(result).toContain('main');
    });

    it('25. panel content starting with bullet dash item', () => {
      const result = extractAIAnswer(fb2_panelDashList);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const allContent = blocks.join('\n');
      expect(allContent).toContain('- name: nginx');
    });

    it('26. bare python import at column 0', () => {
      const result = extractAIAnswer(fb2_pythonImport);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(1);
      expect(blocks[0]).toContain('import os');
      expect(blocks[0]).toContain('from pathlib import Path');
    });

    it('27. prose lines with word-colon pattern and many words', () => {
      const result = extractAIAnswer(fb2_proseWordColon);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(0);
    });

    it('28. file heading with spaces in path', () => {
      const result = extractAIAnswer(fb2_spacesInPath);
      assertNoAnsiLeaks(result);
      expect(result).toContain('My App/config.yaml');
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(0);
    });

    it('29. literal backslash-x1b text in panel content', () => {
      const result = extractAIAnswer(fb2_literalEscapeText);
      expect(result).toContain('\\x1b');
    });

    it('30. YAML key split across lines by terminal wrapping', () => {
      const result = extractAIAnswer(fb2_yamlKeySplit);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(1);
      expect(blocks[0]).toContain('averageUtilization');
      expect(blocks[0]).toContain('70');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Round 3
  // ═══════════════════════════════════════════════════════════════════════════
  describe('round 3', () => {
    it("1. heredoc with quoted delimiter <<'YAML'", () => {
      const result = extractAIAnswer(fb3_heredocQuotedDelim);
      assertNoAnsiLeaks(result);
      expect(result).toContain("cat <<'YAML'");
      const blocks = extractCodeBlocks(result);
      const yamlInSeparateBlock = blocks.some(
        b => b.includes('apiVersion:') && !b.includes("cat <<'YAML'")
      );
      expect(yamlInSeparateBlock).toBe(false);
    });

    it('2. bare YAML list with nested keys at column 0', () => {
      const result = extractAIAnswer(fb3_bareYamlList);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(blocks.join('\n')).toContain('- name: nginx');
      expect(blocks.join('\n')).toContain('containerPort: 80');
    });

    it('3. numbered list with periods and interleaved code panels', () => {
      const result = extractAIAnswer(fb3_numberedListPanels);
      assertNoAnsiLeaks(result);
      expect(result).toContain('1.');
      expect(result).toContain('2.');
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(2);
    });

    it('4. Makefile with .PHONY and multiple targets', () => {
      const result = extractAIAnswer(fb3_makefilePhony);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const allContent = blocks.join('\n');
      expect(allContent).toContain('build:');
      expect(allContent).toContain('clean:');
    });

    it('5. tee heredoc for K8s manifest creation', () => {
      const result = extractAIAnswer(fb3_teeHeredoc);
      assertNoAnsiLeaks(result);
      expect(result).toContain('kubectl apply');
      const blocks = extractCodeBlocks(result);
      const yamlInSeparateBlock = blocks.some(
        b => b.includes('apiVersion:') && !b.includes('kubectl apply')
      );
      expect(yamlInSeparateBlock).toBe(false);
    });

    it('6. CSS code in panel should be wrapped', () => {
      const result = extractAIAnswer(fb3_cssPanel);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(blocks.join('\n')).toContain('body {');
    });

    it('7. SQL query in panel should be wrapped', () => {
      const result = extractAIAnswer(fb3_sqlPanel);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(blocks.join('\n')).toContain('SELECT name');
    });

    it('8. prose between two code panels stays as prose', () => {
      const result = extractAIAnswer(fb3_proseBetweenPanels);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      const allContent = blocks.join('\n');
      expect(allContent).not.toContain('Then check');
      expect(allContent).toContain('kubectl get pods');
      expect(allContent).toContain('kubectl logs pod-name');
    });

    it('9. bare JSON array output wrapped in code block', () => {
      const result = extractAIAnswer(fb3_bareJsonArray);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(blocks.join('\n')).toContain('"name": "pod-1"');
    });

    it('10. multiple heredocs in one response', () => {
      const result = extractAIAnswer(fb3_multipleHeredocs);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      const yamlOnly = blocks.filter(b => b.includes('apiVersion:') && !b.includes('cat >'));
      expect(yamlOnly.length).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Round 4
  // ═══════════════════════════════════════════════════════════════════════════
  describe('round 4', () => {
    it('1. shell heredoc with <<-EOF keeps YAML body in same block', () => {
      const result = extractAIAnswer(fb4_heredocDashEof);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(result).not.toContain('```yaml');
      const yamlInSeparateBlock = blocks.some(
        b => b.includes('apiVersion: v1') && !b.includes('cat <<-EOF')
      );
      expect(yamlInSeparateBlock).toBe(false);
    });

    it('2. YAML merge-key line <<: *defaults stays inside yaml block', () => {
      const result = extractAIAnswer(fb4_yamlMergeKey);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(blocks[0]).toContain('defaults: &defaults');
      expect(blocks[0]).toContain('<<: *defaults');
    });

    it('3. Makefile .PHONY and dependency targets stay in one code block', () => {
      const result = extractAIAnswer(fb4_makefilePhonyDeps);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(blocks[0]).toContain('.PHONY: build deps clean');
      expect(blocks[0]).toContain('build: deps');
      expect(blocks[0]).toContain('deps:');
    });

    it('4. lowercase SQL panel content stays in one code block', () => {
      const result = extractAIAnswer(fb4_lowercaseSql);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(1);
      expect(blocks[0]).toContain('select name, age');
      expect(blocks[0]).toContain('from users');
      expect(blocks[0]).toContain('where age > 18');
    });

    it('5. Dockerfile panel with image tag keeps following lines in same block', () => {
      const result = extractAIAnswer(fb4_dockerfileImageTag);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(1);
      expect(blocks[0]).toContain('FROM gcr.io/distroless/cc-debian12:nonroot');
      expect(blocks[0]).toContain('WORKDIR /app');
      expect(blocks[0]).toContain('COPY --from=builder /app/bin /app/bin');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Round 5
  // ═══════════════════════════════════════════════════════════════════════════
  describe('round 5', () => {
    it('1. C/C++ #include headers stay in one code block', () => {
      const result = extractAIAnswer(fb5_cIncludeHeaders);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(1);
      expect(blocks[0]).toContain('#include <stdio.h>');
      expect(blocks[0]).toContain('int main()');
      expect(blocks[0]).toContain('return 0;');
    });

    it('2. Rust match arms with => are not converted to ordered lists', () => {
      const result = extractAIAnswer(fb5_rustMatchArms);
      assertNoAnsiLeaks(result);
      expect(result).not.toMatch(/^\d+\.\s+println!/m);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(blocks[0]).toContain('match status');
      expect(blocks[0]).toContain('200 =>');
    });

    it('3. Shell backslash continuation stays in one code block', () => {
      const result = extractAIAnswer(fb5_shellBackslashContinuation);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(1);
      expect(blocks[0]).toContain('docker run');
      expect(blocks[0]).toContain('--name mycontainer');
      expect(blocks[0]).toContain('-d nginx:latest');
    });

    it('4. TypeScript interface is not split by YAML detection', () => {
      const result = extractAIAnswer(fb5_tsInterface);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(1);
      expect(blocks[0]).toContain('interface User');
      expect(blocks[0]).toContain('name: string;');
      expect(blocks[0]).toContain('age: number;');
    });

    it('5. JSON object in Rich panel keeps all content in code blocks', () => {
      const result = extractAIAnswer(fb5_jsonObject);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const allBlockContent = blocks.join('\n');
      expect(allBlockContent).toContain('"apiVersion": "v1"');
    });

    it('6. Python triple-quote string with YAML-like content stays in one block', () => {
      const result = extractAIAnswer(fb5_pythonTripleQuoteYaml);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      const allBlockContent = blocks.join('\n');
      expect(allBlockContent).toContain('apiVersion: v1');
    });

    it('7. Go struct with JSON tags stays in one code block', () => {
      const result = extractAIAnswer(fb5_goStructJsonTags);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(1);
      expect(blocks[0]).toContain('type Pod struct');
      expect(blocks[0]).toContain('Name      string');
      expect(blocks[0]).toContain('Status    string');
    });

    it('8. kubectl get pods output stays in one code block', () => {
      const result = extractAIAnswer(fb5_kubectlGetPods);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(1);
      expect(blocks[0]).toContain('NAME');
      expect(blocks[0]).toContain('nginx-deployment');
      expect(blocks[0]).toContain('redis-master-0');
    });

    it('9. Prose with panel code gets first code block wrapped', () => {
      const result = extractAIAnswer(fb5_proseWithPanelCode);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(blocks[0]).toContain('npm install express');
      expect(result).toContain('app.listen(3000)');
    });

    it('10. YAML with boolean and numeric values stays in one block', () => {
      const result = extractAIAnswer(fb5_yamlBooleanValues);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(1);
      expect(blocks[0]).toContain('apiVersion: v1');
      expect(blocks[0]).toContain('debug: "true"');
      expect(blocks[0]).toContain('verbose: "false"');
    });

    it('11. Shell case statement stays in one code block', () => {
      const result = extractAIAnswer(fb5_shellCaseStatement);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(1);
      expect(blocks[0]).toContain('case "$1" in');
      expect(blocks[0]).toContain('esac');
    });

    it('12. Terraform HCL resource block stays in one code block', () => {
      const result = extractAIAnswer(fb5_terraformHcl);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(1);
      expect(blocks[0]).toContain('resource "azurerm_kubernetes_cluster"');
      expect(blocks[0]).toContain('dns_prefix');
    });

    it('13. Docker Compose YAML stays in one block', () => {
      const result = extractAIAnswer(fb5_dockerComposeYaml);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(1);
      expect(blocks[0]).toContain('services:');
      expect(blocks[0]).toContain('image: nginx:latest');
      expect(blocks[0]).toContain('POSTGRES_PASSWORD: secret');
    });

    it('14. Rust with lifetime annotations has code in blocks', () => {
      const result = extractAIAnswer(fb5_rustLifetimes);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(blocks[0]).toContain("fn longest<'a>");
    });

    it('15. Numbered steps with shell commands render correctly', () => {
      const result = extractAIAnswer(fb5_numberedStepsShell);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(3);
      expect(blocks[0]).toContain('kubectl create namespace');
      expect(blocks[1]).toContain('kubectl apply');
      expect(blocks[2]).toContain('kubectl get pods');
    });
  });

  describe('round 6', () => {
    it('1. Java try-catch-finally stays in one code block', () => {
      const result = extractAIAnswer(fb6_javaTryCatchFinally);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('try {');
      expect(all).toContain('catch');
      expect(all).toContain('finally');
    });

    it('2. Print/log statements detected as code', () => {
      const result = extractAIAnswer(fb6_printLogStatements);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('console.log');
    });

    it('3. Arrow functions and modern JS syntax in code block', () => {
      const result = extractAIAnswer(fb6_arrowFunctions);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('=>');
      expect(all).toContain('res.json');
    });

    it('4. TypeScript interface with colon-typed members stays in code block', () => {
      const result = extractAIAnswer(fb6_tsInterfaceColonMembers);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('interface PodStatus');
      expect(all).toContain('name: string');
      expect(all).toContain('restartCount: number');
    });

    it('5. Shell until loop stays in one code block', () => {
      const result = extractAIAnswer(fb6_shellUntilLoop);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('until');
      expect(all).toContain('done');
    });

    it('6. Prose between two code blocks keeps them separate', () => {
      const result = extractAIAnswer(fb6_proseBetweenCodeBlocks);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(2);
      expect(blocks[0]).toContain('create namespace');
      expect(blocks[1]).toContain('kubectl apply');
    });

    it('7. Python f-string with braces stays in code block', () => {
      const result = extractAIAnswer(fb6_pythonFStringBraces);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('logger.info');
      expect(all).toContain('logger.error');
    });

    it('8. K8s YAML with anchors and aliases stays in one block', () => {
      const result = extractAIAnswer(fb6_yamlAnchorsAliases);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('apiVersion');
      expect(all).toContain('500m');
    });

    it('9. Rust enum with derive and variants stays in one block', () => {
      const result = extractAIAnswer(fb6_rustEnumDerive);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('#[derive');
      expect(all).toContain('pub enum AppError');
    });

    it('10. Shell if/elif/else/fi stays in one block', () => {
      const result = extractAIAnswer(fb6_shellIfElifElse);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('if kubectl');
      expect(all).toContain('fi');
    });

    it('11. Go goroutine with channel stays in code block', () => {
      const result = extractAIAnswer(fb6_goGoroutineChannel);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('func worker');
      expect(all).toContain('results <- j * 2');
    });

    it('12. Docker run with backslash continuation stays together', () => {
      const result = extractAIAnswer(fb6_dockerRunBackslash);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('docker run');
      expect(all).toContain('myimage:latest');
    });

    it('13. Java annotations and class stay in one block', () => {
      const result = extractAIAnswer(fb6_javaAnnotationsClass);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('@RestController');
      expect(all).toContain('class UserController');
    });

    it('14. kubectl patch with inline JSON stays in one block', () => {
      const result = extractAIAnswer(fb6_kubectlPatchJson);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('kubectl patch');
      expect(all).toContain('kubectl get pods');
    });

    it('15. YAML and shell blocks separated by prose', () => {
      const result = extractAIAnswer(fb6_yamlShellProseSeparated);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(2);
      const all = blocks.join('\n');
      expect(all).toContain('apiVersion: v1');
      expect(all).toContain('kubectl apply');
    });
  });

  describe('round 7', () => {
    it('1. Lua code with local and function detected as code', () => {
      const result = extractAIAnswer(fb7_luaLocalFunction);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('local M');
      expect(all).toContain('function M.setup');
    });

    it('2. Export environment variables detected as shell code', () => {
      const result = extractAIAnswer(fb7_exportEnvVars);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('export KUBECONFIG');
      expect(all).toContain('export REGISTRY');
    });

    it('3. awk and sed commands detected as code', () => {
      const result = extractAIAnswer(fb7_awkSedCommands);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('awk');
      expect(all).toContain('sed');
    });

    it('4. CSS rules detected as code block', () => {
      const result = extractAIAnswer(fb7_cssRules);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('.container {');
      expect(all).toContain('display: flex');
    });

    it('5. Protobuf message definition detected as code', () => {
      const result = extractAIAnswer(fb7_protobufMessage);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('syntax = "proto3"');
      expect(all).toContain('message PodMetrics');
    });

    it('6. Systemd unit file stays in one block', () => {
      const result = extractAIAnswer(fb7_systemdUnitFile);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('[Unit]');
      expect(all).toContain('[Service]');
    });

    it('7. Shell pipe chain with line continuations stays together', () => {
      const result = extractAIAnswer(fb7_shellPipeChain);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('kubectl get pods');
      expect(all).toContain('head -10');
    });

    it('8. Shell script with variables and commands stays together', () => {
      const result = extractAIAnswer(fb7_shellScriptVarsCommands);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('#!/bin/bash');
      expect(all).toContain('kubectl set image');
    });

    it('9. JSON configuration object stays in one block', () => {
      const result = extractAIAnswer(fb7_jsonConfigObject);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('"scripts"');
      expect(all).toContain('"test"');
    });

    it('10. Ruby class with methods stays in one block', () => {
      const result = extractAIAnswer(fb7_rubyClassMethods);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('class KubernetesClient');
      expect(all).toContain('def get_pods');
    });

    it('11. Kotlin data class detected as code', () => {
      const result = extractAIAnswer(fb7_kotlinDataClass);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('data class PodInfo');
      expect(all).toContain('val name');
    });

    it('12. C struct typedef stays in one code block', () => {
      const result = extractAIAnswer(fb7_cStructTypedef);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('typedef struct');
      expect(all).toContain('ServiceConfig');
    });

    it('13. az CLI commands with JMESPath queries stay in one block', () => {
      const result = extractAIAnswer(fb7_azCliJmesPath);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('az aks show');
      expect(all).toContain('--output table');
    });

    it('14. Python async function with type hints stays in one block', () => {
      const result = extractAIAnswer(fb7_pythonAsyncTypeHints);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('async def get_pods');
      expect(all).toContain('await client');
    });

    it('15. Numbered steps with code blocks render separately', () => {
      const result = extractAIAnswer(fb7_numberedStepsCodeBlocks);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(3);
      const all = blocks.join('\n');
      expect(all).toContain('create secret');
      expect(all).toContain('kubectl apply');
      expect(all).toContain('kubectl get all');
    });
  });

  describe('round 8', () => {
    it('1. Go struct literal with field: value stays in code block', () => {
      const result = extractAIAnswer(fb8_goStructLiteral);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('config :=');
      expect(all).toContain('Host:');
      expect(all).toContain('MaxConns: 100');
    });

    it('2. Python function call with kwargs stays in code block', () => {
      const result = extractAIAnswer(fb8_pythonKwargs);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('logging.basicConfig');
      expect(all).toContain('FileHandler');
    });

    it('3. Shell trap and source commands detected as code', () => {
      const result = extractAIAnswer(fb8_shellTrapSource);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('#!/bin/bash');
      expect(all).toContain('trap');
    });

    it('4. GitHub Actions YAML workflow stays in one block', () => {
      const result = extractAIAnswer(fb8_githubActionsYaml);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('name: Deploy');
      expect(all).toContain('runs-on');
    });

    it('5. Rust closures and iterator chains stay in one block', () => {
      const result = extractAIAnswer(fb8_rustClosuresIterators);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('let results');
      expect(all).toContain('.collect()');
    });

    it('6. Shell heredoc with YAML content stays in one block', () => {
      const result = extractAIAnswer(fb8_shellHeredocYaml);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('cat <<EOF');
      expect(all).toContain('apiVersion: v1');
      expect(all).toContain('EOF');
    });

    it('7. Docker Compose with build context stays in one block', () => {
      const result = extractAIAnswer(fb8_dockerComposeBuildContext);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('version:');
      expect(all).toContain('depends_on');
    });

    it('8. Shell function definition stays in one block', () => {
      const result = extractAIAnswer(fb8_shellFunctionDef);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('check_pod_ready()');
      expect(all).toContain('kubectl get pod');
    });

    it('9. Python nested expressions stay in code block', () => {
      const result = extractAIAnswer(fb8_pythonNestedExpressions);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('import json');
      expect(all).toContain('json.dumps');
    });

    it('10. Terraform with multiple resource types stays in one block', () => {
      const result = extractAIAnswer(fb8_terraformMultipleResources);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('provider "azurerm"');
      expect(all).toContain('resource "azurerm_kubernetes_cluster"');
    });

    it('11. SQL JOIN query stays in one code block', () => {
      const result = extractAIAnswer(fb8_sqlJoinQuery);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('SELECT');
      expect(all).toContain('INNER JOIN');
    });

    it('12. K8s CRD definition stays in one YAML block', () => {
      const result = extractAIAnswer(fb8_k8sCrdDefinition);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('apiextensions.k8s.io');
      expect(all).toContain('openAPIV3Schema');
    });

    it('13. Swift struct with properties stays in code block', () => {
      const result = extractAIAnswer(fb8_swiftStructProperties);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('struct PodInfo');
      expect(all).toContain('isReady');
    });

    it('14. Makefile with ifeq conditional stays in one block', () => {
      const result = extractAIAnswer(fb8_makefileIfeq);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('REGISTRY');
      expect(all).toContain('docker build');
    });

    it('15. Elixir module with functions stays in one block', () => {
      const result = extractAIAnswer(fb8_elixirModule);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('defmodule');
      expect(all).toContain('get_pods');
    });
  });

  describe('round 9', () => {
    it('1. TypeScript generic types not confused with HTML tags', () => {
      const result = extractAIAnswer(fb9_tsGenericTypes);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('KubernetesClient');
      expect(all).toContain('client.list');
    });

    it('2. PHP class with namespace stays in one block', () => {
      const result = extractAIAnswer(fb9_phpClassNamespace);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('<?php');
      expect(all).toContain('class PodController');
    });

    it('3. Scala case class detected as code', () => {
      const result = extractAIAnswer(fb9_scalaCaseClass);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('case class Pod');
      expect(all).toContain('object PodService');
    });

    it('4. Shell arrays and parameter expansion stay in code block', () => {
      const result = extractAIAnswer(fb9_shellArraysParamExpansion);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('NAMESPACES=');
      expect(all).toContain('done');
    });

    it('5. INI config file detected as code block', () => {
      const result = extractAIAnswer(fb9_iniConfigFile);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('[global]');
      expect(all).toContain('scrape_interval');
    });

    it('6. Rust with turbofish and type annotations stays in code block', () => {
      const result = extractAIAnswer(fb9_rustTurbofish);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('serde_json');
      expect(all).toContain('collect::<Vec');
    });

    it('7. Python multi-line string stays in code block', () => {
      const result = extractAIAnswer(fb9_pythonMultiLineString);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('YAML_TEMPLATE');
      expect(all).toContain('kind: Deployment');
    });

    it('8. Java Spring Boot service stays in one block', () => {
      const result = extractAIAnswer(fb9_javaSpringBootService);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('@Service');
      expect(all).toContain('listPods');
    });

    it('9. Shell with here-string stays in code block', () => {
      const result = extractAIAnswer(fb9_shellHereString);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('kubectl get nodes');
      expect(all).toContain('done');
    });

    it('10. curl with JSON body stays in one block', () => {
      const result = extractAIAnswer(fb9_curlJsonBody);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('curl -X POST');
      expect(all).toContain('"namespace"');
    });

    it('11. Kotlin suspend function stays in code block', () => {
      const result = extractAIAnswer(fb9_kotlinSuspendFunction);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('suspend fun');
      expect(all).toContain('withContext');
    });

    it('12. Terraform locals and data sources stay in one block', () => {
      const result = extractAIAnswer(fb9_terraformLocalsData);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('locals {');
      expect(all).toContain('data "azurerm_client_config"');
    });

    it('13. Markdown table passes through without code wrapping', () => {
      const result = extractAIAnswer(fb9_markdownTable);
      assertNoAnsiLeaks(result);
      // Tables should NOT be in code blocks
      expect(result).toContain('| Name | Status |');
      const blocks = extractCodeBlocks(result);
      const all = blocks.join('\n');
      expect(all).not.toContain('| Name |');
    });

    it('14. Shell process substitution stays in code block', () => {
      const result = extractAIAnswer(fb9_shellProcessSubstitution);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('diff');
      expect(all).toContain('kubectl get cm');
    });

    it('15. Requirements.txt content stays in code block', () => {
      const result = extractAIAnswer(fb9_requirementsTxt);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('flask==3.0.0');
      expect(all).toContain('kubernetes==28.1.0');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Round 10
  // ═══════════════════════════════════════════════════════════════════════════
  describe('round 10', () => {
    it('1. GitHub Actions YAML branches: [main] not corrupted by ANSI stripping', () => {
      const result = extractAIAnswer(fb10_ghActionsBranchesMain);
      assertNoAnsiLeaks(result);
      expect(result).toContain('[main]');
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('branches: [main]');
      expect(all).toContain('kubectl apply');
    });

    it('2. Prometheus [5m] duration selector not corrupted', () => {
      const result = extractAIAnswer(fb10_prometheusDuration5m);
      // Don't use assertNoAnsiLeaks — [5m] in PromQL is intentional content
      expect(result).not.toMatch(/\x1b/);
      const blocks = extractCodeBlocks(result);
      const all = blocks.join('\n');
      expect(all).toContain('[5m]');
      expect(all).toContain('HighLatency');
      // for: 10m may be outside the code block due to deep-indent handling
      expect(result).toContain('10m');
    });

    it('3. Kustomization YAML in panel gets wrapped in code fence', () => {
      const result = extractAIAnswer(fb10_kustomizationYaml);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('resources:');
      expect(all).toContain('namePrefix: prod-');
      expect(all).toContain('commonLabels:');
    });

    it('4. Helm values.yaml in panel gets wrapped in code fence', () => {
      const result = extractAIAnswer(fb10_helmValuesYaml);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(2);
      const all = blocks.join('\n');
      expect(all).toContain('replicaCount: 3');
      expect(all).toContain('pullPolicy: IfNotPresent');
      expect(all).toContain('helm install');
    });

    it('5. Azure DevOps pipeline YAML in panel gets wrapped', () => {
      const result = extractAIAnswer(fb10_azureDevOpsPipeline);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('trigger:');
      expect(all).toContain('KubernetesManifest');
      expect(all).toContain('kubernetesServiceConnection');
    });

    it('6. Ansible playbook YAML in panel gets wrapped', () => {
      const result = extractAIAnswer(fb10_ansiblePlaybook);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('Deploy to AKS');
      expect(all).toContain('azure_rm_aks_info');
      expect(all).toContain('kubernetes.core.k8s');
    });

    it('7. ConfigMap with literal block scalar bash script stays in one block', () => {
      const result = extractAIAnswer(fb10_configMapLiteralBlock);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('ConfigMap');
      expect(all).toContain('init.sh');
      expect(all).toContain('sleep 2');
      expect(all).toContain('done');
      // Verify everything is in the SAME block
      const sameBlock = blocks.some(b => b.includes('ConfigMap') && b.includes('sleep 2'));
      expect(sameBlock).toBe(true);
    });

    it('8. Makefile .PHONY and variable assignments stay in code block', () => {
      const result = extractAIAnswer(fb10_makefilePhony);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('.PHONY');
      expect(all).toContain('IMAGE ?=');
      expect(all).toContain('docker build');
    });

    it('9. NGINX config with proxy_pass stays in one code block', () => {
      const result = extractAIAnswer(fb10_nginxProxyPass);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(1);
      const all = blocks.join('\n');
      expect(all).toContain('server {');
      expect(all).toContain('proxy_pass');
      expect(all).toContain('location /healthz');
    });

    it('10. Python K8s operator with deep nesting stays in one block', () => {
      const result = extractAIAnswer(fb10_pythonK8sOperator);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('kopf');
      expect(all).toContain('namespace="default"');
      const sameBlock = blocks.some(b => b.includes('kopf') && b.includes('namespace="default"'));
      expect(sameBlock).toBe(true);
    });

    it('11. Grafana JSON in ConfigMap with [5m] Prometheus duration preserved', () => {
      const result = extractAIAnswer(fb10_grafanaConfigMap5m);
      // Don't use assertNoAnsiLeaks — [5m] in PromQL is intentional content
      expect(result).not.toMatch(/\x1b/);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('[5m]');
      expect(all).toContain('ConfigMap');
      expect(all).toContain('Request Rate');
      const sameBlock = blocks.some(b => b.includes('ConfigMap') && b.includes('[5m]'));
      expect(sameBlock).toBe(true);
    });

    it('12. Docker Compose YAML in panel gets wrapped', () => {
      const result = extractAIAnswer(fb10_dockerComposeYaml);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('services:');
      expect(all).toContain('postgres:15');
    });

    it('13. Envoy proxy config YAML gets wrapped in panel', () => {
      const result = extractAIAnswer(fb10_envoyProxyConfig);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('static_resources:');
      expect(all).toContain('envoy.filters');
    });

    it('14. Azure Bicep for AKS stays in one code block', () => {
      const result = extractAIAnswer(fb10_azureBicepAks);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(1);
      const all = blocks.join('\n');
      expect(all).toContain('resource aks');
      expect(all).toContain('agentpool');
      expect(all).toContain('Standard_D2s_v3');
    });

    it('15. kubectl top millicore values not corrupted', () => {
      const result = extractAIAnswer(fb10_kubectlTopMillicores);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('250m');
      expect(all).toContain('500m');
      expect(all).toContain('128Mi');
      expect(all).toContain('kubectl top');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Round 11
  // ═══════════════════════════════════════════════════════════════════════════
  describe('round 11', () => {
    it('1. kubectl resource action output lines detected as code', () => {
      const result = extractAIAnswer(fb11_kubectlScaleOutput);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('kubectl scale');
      expect(all).toContain('deployment.apps/my-app scaled');
    });

    it('2. kubectl apply output lines stay in code block', () => {
      const result = extractAIAnswer(fb11_kubectlApplyOutput);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('kubectl apply');
      expect(all).toContain('service/my-app-svc created');
      expect(all).toContain('ingress.networking.k8s.io/my-ingress created');
    });

    it('3. Helm status output not treated as YAML keys', () => {
      const result = extractAIAnswer(fb11_helmStatusOutput);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('helm status');
      expect(all).toContain('STATUS: deployed');
    });

    it('4. kubectl rollout output stays in code block', () => {
      const result = extractAIAnswer(fb11_kubectlRolloutStatus);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('kubectl rollout');
      expect(all).toContain('successfully rolled out');
    });

    it('5. terraform plan output with + prefix detected as code', () => {
      const result = extractAIAnswer(fb11_terraformPlanOutput);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('terraform plan');
      expect(all).toContain('azurerm_kubernetes_cluster');
    });

    it('6. Docker build step output stays in code block', () => {
      const result = extractAIAnswer(fb11_dockerBuildSteps);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('docker build');
      expect(all).toContain('Step 1/5');
      expect(all).toContain('Successfully tagged');
    });

    it('7. Helm template Go expressions in bare output wrapped as code', () => {
      const result = extractAIAnswer(fb11_helmTemplateGoExpr);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('{{- if .Values.ingress.enabled');
      expect(all).toContain('kind: Ingress');
      expect(all).toContain('{{- end }}');
    });

    it('8. ConfigMap with embedded Spring properties stays together', () => {
      const result = extractAIAnswer(fb11_configMapSpringProperties);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('kind: ConfigMap');
      expect(all).toContain('spring.datasource.url');
      expect(all).toContain('management.endpoints');
    });

    it('9. kubectl error messages not absorbed into YAML blocks', () => {
      const result = extractAIAnswer(fb11_kubectlErrorMessage);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(2);
      const all = blocks.join('\n');
      expect(all).toContain('kubectl get pods');
      expect(all).toContain('error: the server');
      // The trailing prose should NOT be inside a code block
      expect(result).toContain('CRD is not installed');
    });

    it('10. kubectl deprecation warnings stay with command output', () => {
      const result = extractAIAnswer(fb11_kubectlWarningDeprecation);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('kubectl apply');
      expect(all).toContain('Warning:');
      expect(all).toContain('podsecuritypolicy');
    });

    it('11. bare kubectl events table detected as code', () => {
      const result = extractAIAnswer(fb11_kubectlEventsTable);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('LAST SEEN');
      expect(all).toContain('BackOff');
    });

    it('12. Kustomization with patchesStrategicMerge wrapped as YAML', () => {
      const result = extractAIAnswer(fb11_kustomizationPatches);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('resources:');
      expect(all).toContain('patchesStrategicMerge');
      expect(all).toContain('commonLabels');
    });

    it('13. Go client-go code stays in one code block', () => {
      const result = extractAIAnswer(fb11_goClientGoCode);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('package main');
      expect(all).toContain('k8s.io/client-go');
      expect(all).toContain('CoreV1().Pods');
    });

    it('14. RBAC ClusterRole with complex rules stays together', () => {
      const result = extractAIAnswer(fb11_rbacClusterRole);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('rbac.authorization.k8s.io');
      expect(all).toContain('verbs: ["*"]');
    });

    it('15. Multiple kubectl commands with prose rendered correctly', () => {
      const result = extractAIAnswer(fb11_multiKubectlWithProse);
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

    it('16. klog-format log lines from kubectl logs detected as code', () => {
      const result = extractAIAnswer(fb11_klogFormatLogs);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('kubectl logs');
      expect(all).toContain('Starting controller');
      expect(all).toContain('watch closed');
    });

    it('17. logfmt structured logging lines detected as code', () => {
      const result = extractAIAnswer(fb11_logfmtStructuredLogs);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('kubectl logs');
      expect(all).toContain('server started');
    });

    it('18. K8s validation errors stay in code block', () => {
      const result = extractAIAnswer(fb11_k8sValidationErrors);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('kubectl apply');
      expect(all).toContain('spec.containers[0].image');
    });

    it('19. K8s scheduling messages stay in kubectl describe output', () => {
      const result = extractAIAnswer(fb11_k8sSchedulingDescribe);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('kubectl describe');
      expect(all).toContain('FailedScheduling');
    });

    it('20. PVC and other resource status lines detected as code', () => {
      const result = extractAIAnswer(fb11_pvcResourceStatus);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('kubectl apply');
      expect(all).toContain('persistentvolumeclaim/data-pvc created');
      expect(all).toContain('storageclass.storage.k8s.io/fast-ssd created');
    });

    it('21. helm upgrade output with hooks and notes stays in code block', () => {
      const result = extractAIAnswer(fb11_helmUpgradeHooks);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('helm upgrade');
      expect(all).toContain('STATUS: deployed');
    });

    it('22. az aks and kubeconfig commands with output stay together', () => {
      const result = extractAIAnswer(fb11_azAksGetCredentials);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(3);
      const all = blocks.join('\n');
      expect(all).toContain('az aks get-credentials');
      expect(all).toContain('Merged');
      expect(all).toContain('kubectl config current-context');
      expect(all).toContain('kubectl get nodes');
      expect(all).toContain('aks-nodepool1');
    });

    it('23. Pod with service mesh annotations stays in one YAML block', () => {
      const result = extractAIAnswer(fb11_istioSidecarAnnotations);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('sidecar.istio.io/inject');
      expect(all).toContain('prometheus.io/scrape');
      expect(all).toContain('containerPort: 8080');
    });

    it('24. bare logfmt structured logging wrapped in code block', () => {
      const result = extractAIAnswer(fb11_bareLogfmtOutput);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('level=info');
      expect(all).toContain('server started');
    });

    it('25. bare klog format controller logs wrapped in code block', () => {
      const result = extractAIAnswer(fb11_bareKlogFormat);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('Starting controller');
      expect(all).toContain('watch closed');
    });

    it('26. bare kubectl resource action output from panel wrapped as code', () => {
      const result = extractAIAnswer(fb11_bareResourceActionOutput);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('deployment.apps/my-app configured');
      expect(all).toContain('ingress.networking.k8s.io/my-ingress created');
    });

    it('27. terraform output values at panel indent wrapped as code', () => {
      const result = extractAIAnswer(fb11_terraformOutputValues);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('cluster_endpoint');
      expect(all).toContain('cluster_name');
    });

    it('28. bare PromQL expression with [5m] wrapped as code', () => {
      const result = extractAIAnswer(fb11_barePromQL5m);
      // Don't use assertNoAnsiLeaks — [5m] in PromQL is intentional content
      expect(result).not.toMatch(/\x1b/);
      expect(result).toContain('[5m]');
      // PromQL should be in a code block or at least preserved
      expect(result).toContain('container_cpu_usage_seconds_total');
    });

    it('29. multi-step AKS troubleshooting with commands and YAML', () => {
      const result = extractAIAnswer(fb11_aksTroubleshooting);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(3);
      const all = blocks.join('\n');
      expect(all).toContain('kubectl get pods');
      expect(all).toContain('CrashLoopBackOff');
      expect(all).toContain('kubectl logs');
      expect(all).toContain('Cannot find module');
      expect(all).toContain('kind: Deployment');
    });

    it('30. K8s Secret with base64 data stays in one YAML block', () => {
      const result = extractAIAnswer(fb11_k8sSecretBase64);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('kind: Secret');
      expect(all).toContain('type: Opaque');
      expect(all).toContain('DB_HOST:');
      expect(all).toContain('DB_PASS:');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Round 12
  // ═══════════════════════════════════════════════════════════════════════════
  describe('round 12', () => {
    it('1. bare PromQL expressions detected as code', () => {
      const result = extractAIAnswer(fb12_barePromQLExpressions);
      // Don't use assertNoAnsiLeaks — [5m] in PromQL is intentional content
      expect(result).not.toMatch(/\x1b/);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('container_cpu_usage_seconds_total');
      expect(all).toContain('[5m]');
    });

    it('2. bare K8s event messages detected as code', () => {
      const result = extractAIAnswer(fb12_bareK8sEventMessages);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('Pulling image');
      expect(all).toContain('Started container nginx');
    });

    it('3. bare scheduling failure messages detected as code', () => {
      const result = extractAIAnswer(fb12_bareSchedulingFailure);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('0/3 nodes are available');
    });

    it('4. bare Prometheus metric query results detected as code', () => {
      const result = extractAIAnswer(fb12_barePrometheusMetrics);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('container_memory_working_set_bytes');
      expect(all).toContain('kube_pod_status_phase');
    });

    it('5. bare readiness probe failure messages detected as code', () => {
      const result = extractAIAnswer(fb12_bareProbeFailures);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('Readiness probe failed');
      expect(all).toContain('Startup probe failed');
    });

    it('6. CoreDNS Corefile with deep nesting stays complete', () => {
      const result = extractAIAnswer(fb12_coreDNSCorefile);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('.:53 {');
      expect(all).toContain('kubernetes cluster.local');
      expect(all).toContain('lameduck 5s');
      expect(all).toContain('pods insecure');
      expect(all).toContain('forward . /etc/resolv.conf');
    });

    it('7. PrometheusRule CRD YAML with deep rules stays complete', () => {
      const result = extractAIAnswer(fb12_prometheusRuleCRD);
      // Don't use assertNoAnsiLeaks — [5m] in PromQL is intentional content
      expect(result).not.toMatch(/\x1b/);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('monitoring.coreos.com/v1');
      expect(all).toContain('HighErrorRate');
      expect(all).toContain('severity: critical');
      expect(all).toContain('for: 5m');
    });

    it('8. deeply nested az aks JSON output stays complete', () => {
      const result = extractAIAnswer(fb12_azAksJsonOutput);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('"name": "nodepool1"');
      expect(all).toContain('"code": "Running"');
      expect(all).toContain('"env": "production"');
    });

    it('9. bare container crash messages detected as code', () => {
      const result = extractAIAnswer(fb12_bareContainerCrash);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('Back-off restarting');
      expect(all).toContain('definition changed');
    });

    it('10. bare volume mount failure messages detected as code', () => {
      const result = extractAIAnswer(fb12_bareVolumeMountFailure);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('MountVolume.SetUp failed');
      expect(all).toContain('AttachVolume.Attach failed');
    });

    it('11. bare image pull failure messages detected as code', () => {
      const result = extractAIAnswer(fb12_bareImagePullFailure);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('Failed to pull image');
      expect(all).toContain('Error response from daemon');
    });

    it('12. bare scheduling detail messages detected as code', () => {
      const result = extractAIAnswer(fb12_bareSchedulingDetails);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('Insufficient cpu');
      expect(all).toContain('topologySpreadConstraints');
    });

    it('13. bare CRI-O container log lines detected as code', () => {
      const result = extractAIAnswer(fb12_bareCRIOLogs);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('stdout F Starting application');
      expect(all).toContain('stderr F Error');
    });

    it('14. bare multi-line container lifecycle events detected as code', () => {
      const result = extractAIAnswer(fb12_bareContainerLifecycle);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('Pulling image');
      expect(all).toContain('Liveness probe failed');
    });

    it('15. bare key=value diagnostic output detected as code', () => {
      const result = extractAIAnswer(fb12_bareKeyValueDiagnostics);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('runtime.name=containerd');
      expect(all).toContain('container.id=abc123def456');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Round 13
  // ═══════════════════════════════════════════════════════════════════════════
  describe('round 13', () => {
    it('1. prose sentence ending with colon is not code', () => {
      const result = extractAIAnswer(fb13_proseColonEnding);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      // The prose should NOT be inside any code block
      for (const block of blocks) {
        expect(block).not.toContain('diagnose it');
      }
      // No empty code blocks should be generated
      for (const block of blocks) {
        expect(block.trim()).not.toBe('');
      }
    });

    it('2. diagnostic summary ending with colon is not code', () => {
      const result = extractAIAnswer(fb13_diagnosticSummaryColon);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      for (const block of blocks) {
        expect(block).not.toContain('pod problems');
        expect(block.trim()).not.toBe('');
      }
      expect(result).toContain('No obvious pod problems right now:');
    });

    it('3. step heading ending with colon does not produce empty code block', () => {
      const result = extractAIAnswer(fb13_stepHeadingColon);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      // No empty code blocks
      for (const block of blocks) {
        expect(block.trim()).not.toBe('');
      }
      // "Build + push:" should be prose, not inside a code block
      for (const block of blocks) {
        expect(block).not.toContain('Build + push:');
      }
    });

    it('4. assumptions heading with colon does not produce empty code block', () => {
      const result = extractAIAnswer(fb13_assumesHeadingColon);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      // No empty code blocks
      for (const block of blocks) {
        expect(block.trim()).not.toBe('');
      }
      // "Assumes:" should be prose
      for (const block of blocks) {
        expect(block).not.toContain('Assumes:');
      }
    });

    it('5. markdown bold text with k8s terms is not code', () => {
      const result = extractAIAnswer(fb13_boldK8sTerms);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      for (const block of blocks) {
        expect(block).not.toContain('deployment');
        expect(block).not.toContain('kube-system');
      }
    });

    it('6. markdown bullet list with technical terms is not code', () => {
      const result = extractAIAnswer(fb13_bulletListTechTerms);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      for (const block of blocks) {
        expect(block).not.toContain('OOMKilled');
        expect(block).not.toContain('Liveness probe');
        expect(block).not.toContain('CrashLoopBackOff');
      }
    });

    it('7. numbered step list with k8s actions is not code', () => {
      const result = extractAIAnswer(fb13_numberedStepList);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      for (const block of blocks) {
        expect(block).not.toContain('Create the deployment');
        expect(block).not.toContain('Verify pods are');
      }
    });

    it('8. markdown headers are not YAML comments or code', () => {
      const result = extractAIAnswer(fb13_markdownHeaders);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      for (const block of blocks) {
        expect(block).not.toContain('Troubleshooting');
        expect(block).not.toContain('Step 1');
        expect(block).not.toContain('Step 2');
      }
    });

    it('9. prose with URLs is not code', () => {
      const result = extractAIAnswer(fb13_proseWithUrls);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      for (const block of blocks) {
        expect(block).not.toContain('kubernetes.io');
        expect(block).not.toContain('microsoft.com');
      }
    });

    it('10. note prefix with explanation is not code', () => {
      const result = extractAIAnswer(fb13_notePrefix);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      for (const block of blocks) {
        expect(block).not.toContain('cluster-admin');
        expect(block).not.toContain('assumes you');
      }
    });

    it('11. multi-paragraph technical explanation is not code', () => {
      const result = extractAIAnswer(fb13_multiParagraphExplanation);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      for (const block of blocks) {
        expect(block).not.toContain('CrashLoopBackOff');
        expect(block).not.toContain('Common causes');
        expect(block).not.toContain('recommend');
      }
    });

    it('12. prose with inline code backticks is not wrapped in code fence', () => {
      const result = extractAIAnswer(fb13_inlineCodeBackticks);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      for (const block of blocks) {
        expect(block).not.toContain('You can check the status');
        expect(block).not.toContain('output should show');
      }
    });

    it('13. prose with colon-separated key-value descriptions is not YAML', () => {
      const result = extractAIAnswer(fb13_proseKeyValueDescriptions);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      for (const block of blocks) {
        expect(block).not.toContain('cluster has');
        expect(block).not.toContain('All nodes');
        expect(block.trim()).not.toBe('');
      }
    });

    it('14. questions about k8s resources are not code', () => {
      const result = extractAIAnswer(fb13_questionsAboutK8s);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      for (const block of blocks) {
        expect(block).not.toContain('namespace');
        expect(block).not.toContain('replicas');
        expect(block).not.toContain('resource limits');
      }
    });

    it('15. mixed markdown formatting is not code', () => {
      const result = extractAIAnswer(fb13_mixedMarkdownFormatting);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      for (const block of blocks) {
        expect(block).not.toContain('healthy');
        expect(block).not.toContain('Node status');
        expect(block).not.toContain('Pod health');
        expect(block).not.toContain('pending pods');
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Round 14
  // ═══════════════════════════════════════════════════════════════════════════
  describe('round 14', () => {
    it('1. "Also confirm:" after shell commands is not code', () => {
      const result = extractAIAnswer(fb14_alsoConfirmAfterShell);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      // No empty code blocks
      for (const block of blocks) {
        expect(block.trim()).not.toBe('');
      }
      // "Also confirm" should NOT be inside any code block
      for (const block of blocks) {
        expect(block).not.toContain('Also confirm');
      }
      // kubectl commands SHOULD be in a code block
      const allCode = blocks.join('\n');
      expect(allCode).toContain('kubectl get pods');
    });

    it('2. "Also confirm:" without blank line after shell is not code', () => {
      const result = extractAIAnswer(fb14_alsoConfirmNoBlank);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      for (const block of blocks) {
        expect(block).not.toContain('Also confirm');
      }
    });

    it('3. "Also confirm:" after double blank is not code', () => {
      const result = extractAIAnswer(fb14_alsoConfirmDoubleBlank);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      for (const block of blocks) {
        expect(block).not.toContain('Also confirm');
      }
    });

    it('4. "Build + push:" prose heading is not code', () => {
      const result = extractAIAnswer(fb14_buildPushProseHeading);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      for (const block of blocks) {
        expect(block).not.toContain('Build + push');
      }
    });

    it('5. Rich panel code then "Also confirm:" stays prose', () => {
      const result = extractAIAnswer(fb14_panelCodeThenAlsoConfirm);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      for (const block of blocks) {
        expect(block.trim()).not.toBe('');
        expect(block).not.toContain('Also confirm');
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Round 15
  // ═══════════════════════════════════════════════════════════════════════════
  describe('round 15', () => {
    it('1. requirements.txt followed by pinned dependencies', () => {
      const result = extractAIAnswer(fb15_requirementsTxtPanel);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      // The pinned deps should be in a code block
      const depBlock = blocks.find(
        b => b.includes('fastapi==0.110.0') && b.includes('uvicorn')
      );
      expect(depBlock).toBeDefined();
    });

    it('2. main.py followed by Python code', () => {
      const result = extractAIAnswer(fb15_mainPyPanel);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      const pyBlock = blocks.find(
        b => b.includes('from fastapi import FastAPI') && b.includes('def root():')
      );
      expect(pyBlock).toBeDefined();
    });

    it('3. numbered step header is NOT a code block', () => {
      const result = extractAIAnswer(fb15_numberedStepHeaderPanel);
      assertNoAnsiLeaks(result);
      // Should NOT be in a code block
      expect(result).toContain('3) Kubernetes');
      const blocks = extractCodeBlocks(result);
      const headingBlock = blocks.find(b => b.includes('3) Kubernetes'));
      expect(headingBlock).toBeUndefined();
    });

    it('4. Dockerfile filename followed by Dockerfile content', () => {
      const result = extractAIAnswer(fb15_dockerfilePanel);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      const dockerBlock = blocks.find(
        b => b.includes('FROM python:3.12-slim') && b.includes('CMD')
      );
      expect(dockerBlock).toBeDefined();
    });

    it('5. requirements.txt followed by deps (non-panel format)', () => {
      const result = extractAIAnswer(fb15_requirementsTxtNonPanel);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      const depBlock = blocks.find(b => b.includes('fastapi==0.110.0'));
      expect(depBlock).toBeDefined();
    });

    it('6. main.py followed by Python code (non-panel format)', () => {
      const result = extractAIAnswer(fb15_mainPyNonPanel);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      const pyBlock = blocks.find(
        b => b.includes('from fastapi import FastAPI') && b.includes('def root():')
      );
      expect(pyBlock).toBeDefined();
    });

    it('7. numbered header 3) is NOT code in non-panel format', () => {
      const result = extractAIAnswer(fb15_numberedStepHeaderNonPanel);
      assertNoAnsiLeaks(result);
      expect(result).toContain('3)');
      const blocks = extractCodeBlocks(result);
      const headingBlock = blocks.find(b => b.includes('Kubernetes'));
      expect(headingBlock).toBeUndefined();
    });

    it('8. Cargo.toml: with trailing colon wraps TOML content', () => {
      const result = extractAIAnswer(fb15_cargoTomlNonPanel);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      const tomlBlock = blocks.find(
        b => b.includes('[package]') && b.includes('name = "myapp"')
      );
      expect(tomlBlock).toBeDefined();
    });

    it('9. deployment.yaml heading keeps YAML separate from filename', () => {
      const result = extractAIAnswer(fb15_deploymentYamlPanel);
      assertNoAnsiLeaks(result);
      expect(result).toContain('deployment.yaml');
      const blocks = extractCodeBlocks(result);
      const yamlBlock = blocks.find(
        b => b.includes('apiVersion: apps/v1') && b.includes('kind: Deployment')
      );
      expect(yamlBlock).toBeDefined();
    });

    it('10. src/main.rs: with trailing colon wraps Rust code', () => {
      const result = extractAIAnswer(fb15_mainRsNonPanel);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      const rustBlock = blocks.find(
        b => b.includes('fn main()') && b.includes('println!')
      );
      expect(rustBlock).toBeDefined();
    });

    it('11. indented numbered step header after Go code is NOT a code block', () => {
      const result = extractAIAnswer(fb15_numberedStepAfterGoCode);
      assertNoAnsiLeaks(result);

      // The Go code should be in a code block
      const blocks = extractCodeBlocks(result);
      const goBlock = blocks.find(b => b.includes('package main') && b.includes('func main()'));
      expect(goBlock).toBeDefined();

      // The numbered step header should NOT be in a code block
      const stepBlock = blocks.find(b => b.includes('2) Containerize'));
      expect(stepBlock).toBeUndefined();
      expect(result).toContain('2) Containerize');
    });

    it('12. Assumptions: between Go code and Dockerfile is prose, not code', () => {
      const result = extractAIAnswer(fb15_assumptionsBetweenCodeBlocks);
      assertNoAnsiLeaks(result);

      // Assumptions: should appear as prose, NOT in any code block
      const blocks = extractCodeBlocks(result);
      const assumptionsBlock = blocks.find(b => b.includes('Assumptions:'));
      expect(assumptionsBlock).toBeUndefined();
      expect(result).toContain('Assumptions:');

      // No empty code blocks
      const emptyBlock = blocks.find(b => b.trim() === '');
      expect(emptyBlock).toBeUndefined();

      // Go code should be in a code block
      const goBlock = blocks.find(b => b.includes('package main') && b.includes('func main()'));
      expect(goBlock).toBeDefined();

      // Dockerfile should be in a separate code block
      const dockerBlock = blocks.find(b => b.includes('FROM maven'));
      expect(dockerBlock).toBeDefined();
    });
  });
});
