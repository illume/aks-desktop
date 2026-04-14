# GitHub Copilot Integration Options for ai-assistant Plugin

This document compares the available approaches for integrating GitHub Copilot capabilities into the ai-assistant plugin.

## Option 1: GitHub Models API (OpenAI-compatible) ✅ Implemented

**Status:** Implemented as `copilot` provider

**How it works:**
- Uses the GitHub Models inference endpoint (`https://models.inference.ai.azure.com`)
- Authenticates with a GitHub Personal Access Token (PAT) with `models:read` scope
- The API is OpenAI-compatible, so we reuse LangChain's `ChatOpenAI` with a custom `baseURL`
- Available models include GPT-4o, GPT-4o-mini, o3-mini, o1, and more

**Pros:**
- Already integrated — no new dependencies needed
- OpenAI-compatible API means full tool-calling / function-calling support via LangChain
- Free tier available for experimentation (rate-limited)
- Supports many models beyond just OpenAI (Llama, Mistral, Cohere, etc. available in marketplace)
- PAT-based auth works well in desktop apps

**Cons:**
- Requires a GitHub PAT (not automatic from `gh` CLI without user action)
- Rate limits on free tier (more generous with Copilot Pro/Pro+ subscriptions)
- Production usage requires enterprise opt-in for higher limits

**Detection:**
- Can detect `gh` CLI: run `gh auth token` to get an active token
- Can validate token against `https://api.github.com/user` to confirm auth
- Can test Models API access with the retrieved token

---

## Option 2: GitHub Copilot Chat API (Copilot Extensions)

**How it works:**
- Copilot Extensions allow third-party apps to integrate with Copilot Chat
- Extensions are GitHub Apps that receive user messages, can call external services, and return responses
- They work within GitHub.com Copilot Chat, VS Code Copilot Chat, and other supported IDEs

**Pros:**
- Deep integration with GitHub's Copilot ecosystem
- Can use MCP (Model Context Protocol) for tool-calling
- Enterprise-grade security and policy management

**Cons:**
- Designed for server-side integrations (requires a hosted service to receive webhooks)
- Not suitable for a desktop Electron app — extensions are GitHub Apps, not local tools
- Cannot be used as a standalone LLM provider
- User interacts through GitHub's Copilot Chat UI, not our custom UI

**Verdict:** Not applicable for our use case. Extensions are for building server-side integrations that plug into GitHub's Copilot Chat, not for using Copilot as an LLM provider in third-party apps.

---

## Option 3: `gh copilot` CLI

**How it works:**
- The `gh copilot` CLI extension provides `gh copilot suggest` and `gh copilot explain` commands
- It sends prompts to GitHub's Copilot backend and returns responses in the terminal
- Installed via `gh extension install github/gh-copilot`

**Pros:**
- Works locally, no server needed
- Uses the user's existing Copilot subscription
- No API key management — uses `gh` auth automatically

**Cons:**
- CLI-only interface — designed for terminal workflows, not programmatic use
- No streaming API or structured JSON output
- No tool-calling / function-calling support
- Cannot be used as a LangChain model provider
- Interactive mode makes it hard to parse responses programmatically
- Limited to `suggest` (shell commands) and `explain` (code explanation) — no freeform chat

**Verdict:** Not suitable as an LLM backend. The CLI is designed for human terminal interaction, not as a programmatic API. It would require fragile output parsing and lacks the features we need (streaming, tool-calling, structured responses).

---

## Option 4: Model Context Protocol (MCP)

**How it works:**
- MCP is an open standard for connecting AI models to data sources and tools
- GitHub provides a GitHub MCP Server that gives Copilot access to GitHub APIs
- MCP servers can be local or remote, and are supported in VS Code, JetBrains, CLI, etc.

**Pros:**
- Open standard with growing ecosystem
- Excellent for adding tools/context to an existing LLM (e.g., "give Copilot access to K8s APIs")
- Could be used to expose our Kubernetes tools to any MCP-compatible client

**Cons:**
- MCP is a tool/context protocol, not an LLM provider — it doesn't give us a model to chat with
- We already have our own tool system (LangChain tools) that serves the same purpose
- Adding MCP support would mean becoming an MCP server, not using Copilot as a model

**Verdict:** MCP is complementary, not a replacement. It's about giving context to models, not providing models. A future enhancement could expose our Kubernetes tools as an MCP server, but that's a separate concern from using Copilot as an LLM provider.

---

## Option 5: Azure OpenAI via `az` CLI (Azure AI detection) ✅ Implemented

**Status:** Implemented as auto-detection in `providerAutoDetect.ts`

**How it works:**
- Detect Azure CLI (`az`) and check for existing Azure OpenAI deployments
- Query `az cognitiveservices account list` to find Azure OpenAI resources
- For each resource, query deployments and retrieve API keys automatically
- Auto-populate the Azure OpenAI provider config with detected endpoints and deployments

**Pros:**
- Many AKS Desktop users already have Azure subscriptions with OpenAI resources
- True zero-config experience for Azure users
- Leverages existing `az` CLI authentication

**Cons:**
- Requires Azure CLI installed and logged in
- Only works for Azure OpenAI, not other providers
- Requires listing and selecting from potentially many Azure resources
- Uses the first resource/deployment found (user can change in settings)

**Detection Flow:**
1. Run `az account show` to check login status
2. Run `az cognitiveservices account list --query "[?kind=='OpenAI']"` to find OpenAI resources
3. For each resource, run `az cognitiveservices account deployment list` to find model deployments
4. Run `az cognitiveservices account keys list` to retrieve an API key
5. Pre-fill the Azure OpenAI provider with detected endpoint, deployment name, model, and API key

---

## Option 6: Local Model Detection (Ollama)

**How it works:**
- Check if Ollama is running locally at `http://localhost:11434`
- Query `http://localhost:11434/api/tags` to get available models
- Auto-configure the `local` provider with detected models

**Pros:**
- Completely free, private, no API keys needed
- Many developers run Ollama for local AI experimentation

**Cons:**
- Requires Ollama installed and running
- Local models may be less capable than cloud models

**Detection:**
- HTTP GET `http://localhost:11434/api/tags` — if it responds, Ollama is running
- Response contains list of available models

---

## Recommendation: Auto-Detection Strategy

The implemented approach detects providers in this priority order:

1. **GitHub CLI (`gh auth token`)** → Auto-detect GitHub Models API access ✅
2. **Azure CLI (`az cognitiveservices`)** → Auto-detect Azure OpenAI deployments ✅
3. **Ollama (`localhost:11434`)** → Auto-detect local models ✅

When detected, a dialog shows the user what was found and lets them confirm with a single click, adding the detected configuration to their saved providers.

### Using `gh auth token` for the GitHub Models API

The `gh` CLI token obtained via `gh auth token` works directly with the GitHub Models API (`https://models.inference.ai.azure.com`). This is how the copilot provider auto-detection works:

1. Run `gh auth token` to get the user's GitHub CLI session token
2. Validate the token against `https://api.github.com/user`
3. Use the same token as the API key for `ChatOpenAI` with `baseURL: 'https://models.inference.ai.azure.com'`

The GitHub Models API accepts standard GitHub PATs (Personal Access Tokens) and CLI tokens for authentication. The token from `gh auth token` is the same format and works identically — no special scopes or permissions beyond the user's existing Copilot subscription are needed.

### Detection Flow

```
App Launch
  ├── Is running as desktop app?
  │     ├── Yes → Try `gh auth token`
  │     │     ├── Token found → Validate against GitHub API
  │     │     │     ├── Valid → Show "GitHub Copilot detected" dialog
  │     │     │     └── Invalid → Skip
  │     │     └── No token → Skip
  │     ├── Try `az account show`
  │     │     ├── Logged in → List Azure OpenAI resources
  │     │     │     ├── Resources found → Get deployments + keys → Show "Azure OpenAI detected"
  │     │     │     └── No resources → Skip
  │     │     └── Not logged in → Skip
  │     └── No → Try Ollama HTTP check only
  ├── Try Ollama at localhost:11434
  │     ├── Running → Show "Local models detected" dialog
  │     └── Not running → Skip
  └── No providers detected → Show existing "Configure AI" popover
```

### Security Considerations

- **GitHub CLI tokens are never written to disk.** When the copilot provider is auto-detected via `gh auth token`, a sentinel value (`__gh_cli__`) is stored in the plugin configuration instead of the real token. At model creation time the token is fetched once from `gh auth token` and kept in memory for the session. If the session is restarted, the token is re-fetched from the CLI.
- **Azure OpenAI API keys are never written to disk.** When the Azure provider is auto-detected via `az cognitiveservices account keys list`, a sentinel value (`__az_cli__`) is stored along with the resource group and account name. At model creation time the key is fetched fresh from `az cognitiveservices account keys list` and kept in memory for the session.
- **Manual PATs / API keys** — users can alternatively paste credentials in the settings UI. Manually entered keys are stored in plugin configuration like other provider API keys.
- **Ollama detection** is a simple HTTP health check to localhost — no credentials involved.
