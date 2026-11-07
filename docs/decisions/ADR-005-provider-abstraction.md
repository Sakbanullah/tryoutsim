# ADR-005 — Provider abstraction

- **Status**: Accepted
- **Date**: 2026-11-07

## Context

The user runs a DeepSeek-backed gateway, not a fixed Claude endpoint. Hard-coding one provider would make model/provider swapping a code change, which the plan forbids as a runtime concern.

## Decision

One OpenAI-compatible `ProviderTransport` interface — `{listModels, chat, test}` — behind every AI call. Providers are config rows, not code. Task→model mapping and capability flags are data, not code.

## Consequences

- Adding/switching a provider is a configuration change, never a code change ([AI_PROVIDER_ARCHITECTURE.md](../ai/AI_PROVIDER_ARCHITECTURE.md) §2–4).
- Provider keys are write-only secrets ([SECRETS.md](../backend/SECRETS.md)); no provider-specific SDK leaks into the domain.
- Non-AI flows degrade cleanly with no provider configured (FR-C7).