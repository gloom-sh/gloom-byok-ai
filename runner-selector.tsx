import { useCallback, useEffect, useRef, type ReactNode, type RefObject } from "react";
import { Box, Text, type InputRenderable } from "gloomberb/ui";
import { Button } from "gloomberb/components";
import { ChoiceDialog } from "gloomberb/components";
import { useDialog, type PromptContext } from "gloomberb/dialog";
import { colors } from "gloomberb/theme";
import { getAiProviderUnavailableLabel, type AiProvider } from "./providers";
import {
  AI_AUTO_MODEL_VALUE,
  getAiModelSelectionOptions,
  isAiProviderReady,
  normalizeAiModelId,
} from "./runner-selection";
import { useAiRuntimeCatalog } from "./use-runtime-providers";

export function AiRunnerSelector({
  providers,
  providerId,
  modelId,
  description,
  onProviderChange,
  onModelChange,
  modelFocused,
  onModelFocusRequest,
  onModelBlur,
}: {
  providers: AiProvider[];
  providerId: string;
  modelId: string;
  description?: ReactNode;
  onProviderChange: (providerId: string) => void;
  onModelChange: (modelId: string) => void;
  modelInputRef?: RefObject<InputRenderable | null>;
  modelFocused?: boolean;
  onModelFocusRequest?: () => void;
  onModelBlur?: (modelId: string) => void;
}) {
  const dialog = useDialog();
  const catalog = useAiRuntimeCatalog();
  const openingRef = useRef<"provider" | "model" | null>(null);
  const wasModelFocusedRef = useRef(false);
  const selectedProvider = providers.find((provider) => provider.id === providerId) ?? providers[0] ?? null;
  const modelOptions = getAiModelSelectionOptions(providerId, modelId, catalog);
  const normalizedModelId = normalizeAiModelId(modelId);
  const selectedModel = modelOptions.find((option) => (
    option.value === (normalizedModelId ?? AI_AUTO_MODEL_VALUE)
  )) ?? modelOptions[0];

  const openProviderPicker = useCallback(async () => {
    if (openingRef.current || providers.length === 0) return;
    openingRef.current = "provider";
    try {
      const selected = await dialog.prompt<string>({
        content: (context: PromptContext<string>) => (
          <ChoiceDialog
            {...context}
            title="Choose AI provider"
            choices={providers.map((provider) => ({
              id: provider.id,
              label: isAiProviderReady(provider)
                ? provider.name
                : `${provider.name} · ${getAiProviderUnavailableLabel(provider)}`,
              description: isAiProviderReady(provider)
                ? `${provider.name} is connected and ready.`
                : provider.unavailableReason,
            }))}
            selectedChoiceId={selectedProvider?.id}
          />
        ),
      });
      if (selected) onProviderChange(selected);
    } finally {
      openingRef.current = null;
    }
  }, [dialog, onProviderChange, providers, selectedProvider?.id]);

  const openModelPicker = useCallback(async () => {
    if (openingRef.current || !selectedProvider) return;
    openingRef.current = "model";
    try {
      const selected = await dialog.prompt<string>({
        content: (context: PromptContext<string>) => (
          <ChoiceDialog
            {...context}
            title={`Choose ${selectedProvider.name} model`}
            choices={modelOptions.map((option) => ({
              id: option.value,
              label: option.label,
              description: option.description,
            }))}
            selectedChoiceId={normalizedModelId ?? AI_AUTO_MODEL_VALUE}
          />
        ),
      });
      const nextModelId = selected === AI_AUTO_MODEL_VALUE
        ? ""
        : selected || modelId;
      if (selected) onModelChange(nextModelId);
      onModelBlur?.(nextModelId);
    } finally {
      openingRef.current = null;
    }
  }, [
    dialog,
    modelId,
    modelOptions,
    normalizedModelId,
    onModelBlur,
    onModelChange,
    selectedProvider,
  ]);

  useEffect(() => {
    const becameFocused = !!modelFocused && !wasModelFocusedRef.current;
    wasModelFocusedRef.current = !!modelFocused;
    if (becameFocused) void openModelPicker();
  }, [modelFocused, openModelPicker]);

  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="column">
        <Text fg={colors.textDim}>Provider</Text>
        {/* A row, so the picker is as wide as its value rather than the pane. */}
        <Box flexDirection="row">
          <Button
            label={selectedProvider
              ? isAiProviderReady(selectedProvider)
                ? selectedProvider.name
                : `${selectedProvider.name} · ${getAiProviderUnavailableLabel(selectedProvider)}`
              : "Choose provider"}
            variant="secondary"
            onPress={() => {
              void openProviderPicker();
            }}
          />
        </Box>
      </Box>
      {description}
      <Box flexDirection="column">
        <Text fg={colors.textDim}>Model</Text>
        <Box flexDirection="row">
          <Button
            label={selectedModel?.label ?? "Auto · provider default"}
            variant="secondary"
            active={!!modelFocused}
            onPress={() => {
              onModelFocusRequest?.();
              void openModelPicker();
            }}
          />
        </Box>
      </Box>
    </Box>
  );
}
