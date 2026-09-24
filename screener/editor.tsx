import type { RefObject } from "react";
import { useEffect } from "react";
import { Box, Text, Textarea, useUiCapabilities, type InputRenderable, type TextareaRenderable } from "gloomberb/ui";
import { Button, Notice } from "gloomberb/components";
import { colors } from "gloomberb/theme";
import { t } from "gloomberb/i18n";
import {
  getAiProviderUnavailableReason,
  type AiProvider,
} from "../providers";
import type { ScreenerEditorState } from "./model";
import { AiRunnerSelector } from "../runner-selector";
import { isAiProviderReady } from "../runner-selection";

function ScreenerPromptEditor({
  editorKey,
  initialValue,
  focused,
  textareaRef,
  onFocusRequest,
}: {
  editorKey: string;
  initialValue: string;
  focused: boolean;
  textareaRef: RefObject<TextareaRenderable | null>;
  onFocusRequest: () => void;
}) {
  useEffect(() => {
    if (focused) {
      textareaRef.current?.focus?.();
    }
  }, [editorKey, focused, textareaRef]);

  return (
    <Box
      flexGrow={1}
      minHeight={3}
      border
      borderColor={colors.border}
      backgroundColor={colors.panel}
      onMouseDown={onFocusRequest}
    >
      <Textarea
        key={editorKey}
        ref={textareaRef}
        initialValue={initialValue}
        placeholder={t("Examples: humanoid robot suppliers, defense software compounders, EM payment rails, obesity-drug picks-and-shovels...")}
        focused={focused}
        textColor={colors.text}
        placeholderColor={colors.textDim}
        backgroundColor={colors.panel}
        flexGrow={1}
        wrapText
      />
    </Box>
  );
}

export function AiScreenerEditorView({
  editorProvider,
  editorFocusTarget,
  editorState,
  focused,
  modelInputRef,
  selectableProviders,
  textareaRef,
  onModelFocusRequest,
  onProviderChange,
  onModelChange,
  onPromptFocusRequest,
  onSave,
  onCancel,
}: {
  editorProvider: AiProvider | null;
  editorFocusTarget: "prompt" | "model";
  editorState: ScreenerEditorState;
  focused: boolean;
  modelInputRef: RefObject<InputRenderable | null>;
  selectableProviders: AiProvider[];
  textareaRef: RefObject<TextareaRenderable | null>;
  onModelFocusRequest: () => void;
  onProviderChange: (providerId: string) => void;
  onModelChange: (modelId: string) => void;
  onPromptFocusRequest: () => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const { nativePaneChrome } = useUiCapabilities();
  return (
    <>
      <Box flexDirection="column" paddingX={1} paddingTop={1}>
        <AiRunnerSelector
          providers={selectableProviders}
          providerId={editorState.providerId}
          modelId={editorState.modelId}
          description={editorProvider && !isAiProviderReady(editorProvider) ? (
            <Text fg={colors.warning}>
              {`${getAiProviderUnavailableReason(editorProvider)} Save and switch later.`}
            </Text>
          ) : null}
          modelInputRef={modelInputRef}
          modelFocused={focused && editorFocusTarget === "model"}
          onProviderChange={onProviderChange}
          onModelChange={onModelChange}
          onModelFocusRequest={onModelFocusRequest}
          onModelBlur={onPromptFocusRequest}
        />
      </Box>

      <Box flexGrow={1} minHeight={4} padding={1}>
        <ScreenerPromptEditor
          editorKey={editorState.key}
          initialValue={editorState.prompt}
          focused={focused && editorFocusTarget === "prompt"}
          textareaRef={textareaRef}
          onFocusRequest={onPromptFocusRequest}
        />
      </Box>

      {/* Ctrl+S saves and Esc cancels, like the buttons. On the desktop the
          pane's bottom edge clips buttons that sit flush against it. */}
      <Box flexDirection="column" paddingX={1} paddingBottom={nativePaneChrome ? 1 : 0} flexShrink={0}>
        {editorState.error && <Notice tone="negative">{editorState.error}</Notice>}
        <Box flexDirection="row" gap={1}>
          <Button label={t("Save")} variant="primary" onPress={onSave} />
          <Button label={t("Cancel")} variant="secondary" onPress={onCancel} />
        </Box>
      </Box>
    </>
  );
}
