// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { Meta, StoryFn } from '@storybook/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { _testing } from './agent/aksAgentManager';
import {
  fb1_dockerCompose,
  fb1_twoFileHeadings,
  fb2_bareNonK8sYaml,
  fb2_shellHeredoc,
  fb3_cssPanel,
  fb3_sqlPanel,
  fb4_yamlMergeKey,
  fb5_cIncludeHeaders,
  fb5_shellCaseStatement,
  fb5_terraformHcl,
  fb6_goGoroutineChannel,
  fb6_javaTryCatchFinally,
  fb7_kotlinDataClass,
  fb7_rubyClassMethods,
  fb8_githubActionsYaml,
  fb8_k8sCrdDefinition,
  fb9_phpClassNamespace,
  fb9_scalaCaseClass,
  fb10_configMapLiteralBlock,
  fb10_helmValuesYaml,
  fb11_aksTroubleshooting,
  fb11_dockerBuildSteps,
  fb11_helmTemplateGoExpr,
  fb12_barePrometheusMetrics,
  fb12_coreDNSCorefile,
  fb13_mixedMarkdownFormatting,
  fb13_proseColonEnding,
  fb14_panelCodeThenAlsoConfirm,
  fb15_assumptionsBetweenCodeBlocks,
  fb15_mainPyPanel,
} from './agent/findbugFixtures';
import ContentRenderer from './ContentRenderer';

const { extractAIAnswer } = _testing;

const meta: Meta<typeof ContentRenderer> = {
  title: 'AIAssistant/SyntheticFixtures',
  component: ContentRenderer,
  decorators: [
    (Story: any) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
};
export default meta;

// eslint-disable-next-line no-unused-vars
const noopYamlDetected = (_yaml: string, _resourceType: string) => {};

// ── Round-representative stories (one per round) ─────────────────────────────

export const Round01TwoFileHeadings: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(fb1_twoFileHeadings)}
  />
);

export const Round02ShellHeredoc: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer onYamlDetected={noopYamlDetected} content={extractAIAnswer(fb2_shellHeredoc)} />
);

export const Round03CssPanel: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer onYamlDetected={noopYamlDetected} content={extractAIAnswer(fb3_cssPanel)} />
);

export const Round04YamlMergeKey: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer onYamlDetected={noopYamlDetected} content={extractAIAnswer(fb4_yamlMergeKey)} />
);

export const Round05CIncludeHeaders: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(fb5_cIncludeHeaders)}
  />
);

export const Round06JavaTryCatchFinally: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(fb6_javaTryCatchFinally)}
  />
);

export const Round07RubyClassMethods: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(fb7_rubyClassMethods)}
  />
);

export const Round08K8sCrdDefinition: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(fb8_k8sCrdDefinition)}
  />
);

export const Round09ScalaCaseClass: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(fb9_scalaCaseClass)}
  />
);

export const Round10ConfigMapLiteralBlock: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(fb10_configMapLiteralBlock)}
  />
);

export const Round11AksTroubleshooting: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(fb11_aksTroubleshooting)}
  />
);

export const Round12CoreDnsCorefile: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(fb12_coreDNSCorefile)}
  />
);

export const Round13MixedMarkdownNegative: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(fb13_mixedMarkdownFormatting)}
  />
);

export const Round14PanelCodeThenAlsoConfirm: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(fb14_panelCodeThenAlsoConfirm)}
  />
);

export const Round15AssumptionsBetweenCodeBlocks: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(fb15_assumptionsBetweenCodeBlocks)}
  />
);

// ── Additional fixture stories ───────────────────────────────────────────────

export const DockerComposeYaml: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer onYamlDetected={noopYamlDetected} content={extractAIAnswer(fb1_dockerCompose)} />
);

export const BareNonK8sYaml: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(fb2_bareNonK8sYaml)}
  />
);

export const SqlPanel: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer onYamlDetected={noopYamlDetected} content={extractAIAnswer(fb3_sqlPanel)} />
);

export const TerraformHcl: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer onYamlDetected={noopYamlDetected} content={extractAIAnswer(fb5_terraformHcl)} />
);

export const ShellCaseStatement: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(fb5_shellCaseStatement)}
  />
);

export const GoGoroutineChannel: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(fb6_goGoroutineChannel)}
  />
);

export const KotlinDataClass: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(fb7_kotlinDataClass)}
  />
);

export const GitHubActionsYaml: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(fb8_githubActionsYaml)}
  />
);

export const PhpClassNamespace: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(fb9_phpClassNamespace)}
  />
);

export const HelmValuesYaml: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(fb10_helmValuesYaml)}
  />
);

export const DockerBuildSteps: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(fb11_dockerBuildSteps)}
  />
);

export const HelmTemplateGoExpr: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(fb11_helmTemplateGoExpr)}
  />
);

export const BarePrometheusMetrics: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(fb12_barePrometheusMetrics)}
  />
);

export const ProseColonEndingNegative: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(fb13_proseColonEnding)}
  />
);

export const MainPyFilenameHint: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer onYamlDetected={noopYamlDetected} content={extractAIAnswer(fb15_mainPyPanel)} />
);
