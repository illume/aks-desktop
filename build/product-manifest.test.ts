// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { test } from "node:test";

const rootDir = path.resolve(__dirname, "..");
const project = JSON.parse(
  fs.readFileSync(path.join(rootDir, "package.json"), "utf8"),
);
const { createProductTemplate } = require(
  "../packages/headlamp-source/scripts/product-manifest.ts"
);
const manifest = createProductTemplate(project);

test("declares AKS product identity and policy outside Headlamp", () => {
  assert.deepEqual(
    {
      name: manifest.product.name,
      productName: manifest.product.productName,
      appId: manifest.product.appId,
      protocols: manifest.product.protocols,
      executableNames: Object.fromEntries(
        Object.entries(manifest.platforms).map(
          ([platform, metadata]: [string, { executableName: string }]) => [
            platform,
            metadata.executableName,
          ],
        ),
      ),
      checkForUpdates: manifest.checkForUpdates,
    },
    {
      name: "aks-desktop",
      productName: "AKS Desktop",
      appId: "com.microsoft.aksdesktop",
      protocols: { name: "AKS Desktop", schemes: ["aks-desktop"] },
      executableNames: {
        linux: "aks-desktop",
        mac: "aks-desktop",
        win: "aks-desktop",
      },
      checkForUpdates: false,
    },
  );
  assert.equal(manifest.product.version, project.version);
});

test("references packaged legal documents", () => {
  for (const document of manifest.legalDocuments) {
    assert.equal(path.basename(document.file), document.file);
  }
  assert.equal(fs.existsSync(path.join(rootDir, "LICENSE.txt")), true);
  assert.equal(fs.existsSync(path.join(rootDir, "NOTICE.md")), true);
});

test("declares plugin defaults and external tool integrity generation", () => {
  assert.deepEqual(
    manifest.plugins.map((plugin: { packageName: string }) => plugin.packageName),
    ["aks-desktop", "@headlamp-k8s/ai-assistant", "insights-plugin"],
  );
  assert.deepEqual(
    project.headlamp.plugins.map((plugin: { source: string }) => plugin.source),
    [
      "plugins/aks-desktop",
      "plugins/ai-assistant",
      "plugins/insights-plugin",
    ],
  );
  assert.equal(
    manifest.plugins.some((plugin: { source?: string }) => "source" in plugin),
    false,
  );
  assert.equal("build" in manifest, false);
  const aksPlugin = manifest.plugins.find(
    (plugin: { packageName: string }) =>
      plugin.packageName === "aks-desktop",
  );
  assert.equal(aksPlugin.enabledByDefault, true);
  const pluginPackage = JSON.parse(
    fs.readFileSync(
      path.join(rootDir, "plugins", "aks-desktop", "package.json"),
      "utf8",
    ),
  );
  assert.deepEqual(
    aksPlugin.capabilities.runCommands,
    pluginPackage.headlamp.runCommands,
  );
  assert.equal("external-tools" in manifest, false);
});
