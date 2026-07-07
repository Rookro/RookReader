import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch } from "../../../store/store";
import {
  findFieldViolation,
  type SettingsFieldPath,
  violationMessage,
} from "../settingsFieldErrors";
import { type UpdateSettingsPayload, updateSettings } from "../slice";

/**
 * Wires a single numeric settings input to inline, field-specific validation feedback.
 *
 * `commit` dispatches `updateSettings`; if the backend rejects the value with a
 * structured violation for `path`, it surfaces a localized message (range / whole-number
 * / number) as `helperText`. The message is cleared on a successful commit and whenever
 * `watchedValue` changes (e.g. the persisted value syncs in from another window).
 *
 * @param path - The backend field path this input edits (e.g. `"reader.rendering.maxImageHeight"`).
 * @param watchedValue - The currently persisted value; a change clears a stale inline error.
 * @returns `error`/`helperText` to pass to the spinner and a `commit` to call on change.
 */
export function useSettingsFieldError(path: SettingsFieldPath, watchedValue?: number) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [helperText, setHelperText] = useState("");

  // Clear the inline error when the persisted value changes. A rejected commit leaves the
  // persisted value untouched, so the message lingers until the value is actually fixed.
  // biome-ignore lint/correctness/useExhaustiveDependencies: clear on external value change
  useEffect(() => {
    setHelperText("");
  }, [watchedValue]);

  const commit = useCallback(
    async (payload: UpdateSettingsPayload) => {
      const result = await dispatch(updateSettings(payload));
      if (updateSettings.rejected.match(result)) {
        const violation = findFieldViolation(result.payload?.details, path);
        if (violation) {
          setHelperText(violationMessage(t, violation));
          return;
        }
      }
      setHelperText("");
    },
    [dispatch, path, t],
  );

  return { error: helperText !== "", helperText, commit };
}
