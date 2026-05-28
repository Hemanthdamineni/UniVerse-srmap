import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { SectionCard } from "../ErpPrimitives";
import {
  ActionHandlerContext,
  FormContext,
  buildDefaultSubmitAction,
  collectInitialFormState,
  findSubmitAction,
  getFieldInitialValue,
  readAction,
  readBoolean,
  readOptions,
  readString,
  type FormContextValue,
  type FormValues,
  type NodeRendererProps,
} from "./model";
import { isSingleNestedFormWrapper, readDisplayFormTitle } from "./display";

export function FormRenderer({ node, renderChildren }: NodeRendererProps) {
  const actionHandler = useContext(ActionHandlerContext);
  const title = readDisplayFormTitle(node);
  const [values, setValues] = useState<FormValues>(() => collectInitialFormState(node.children));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const submitAction = useMemo(() => findSubmitAction(node.children) || buildDefaultSubmitAction(node), [node]);

  useEffect(() => {
    setValues(collectInitialFormState(node.children));
    setSubmitting(false);
    setError("");
  }, [node]);

  const setValue = useCallback((name: string, value: string) => {
    setValues((current) => {
      if (current[name] === value) return current;
      return { ...current, [name]: value };
    });
  }, []);

  const clearError = useCallback(() => {
    setError("");
  }, []);

  const submit = useCallback(async () => {
    if (!submitAction || !actionHandler) return;

    clearError();
    actionHandler.clearGlobalError();

    try {
      await actionHandler.handleAction(submitAction, {
        node,
        formState: values,
        setPending: setSubmitting,
        setError,
      });
    } catch {
      return;
    }
  }, [actionHandler, clearError, node, submitAction, values]);

  const contextValue = useMemo<FormContextValue>(
    () => ({
      values,
      setValue,
      submitting,
      error,
      clearError,
      setError,
      submit,
    }),
    [clearError, error, setValue, submit, submitting, values]
  );

  if (!title && Array.isArray(node.children) && node.children.length === 0) {
    return null;
  }

  if (!title && isSingleNestedFormWrapper(node)) {
    return <div className="space-y-4">{renderChildren(node.children)}</div>;
  }

  if (!title) {
    return (
      <FormContext.Provider value={contextValue}>
        <form
          data-page-contrast="true"
          className="space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="space-y-4">{renderChildren(node.children)}</div>
          {error ? <p className="text-sm text-[var(--error)]">{error}</p> : null}
        </form>
      </FormContext.Provider>
    );
  }

  return (
    <FormContext.Provider value={contextValue}>
      <SectionCard title={title}>
        <form
          data-page-contrast="true"
          className="space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="space-y-4">{renderChildren(node.children)}</div>
          {error ? <p className="text-sm text-[var(--error)]">{error}</p> : null}
        </form>
      </SectionCard>
    </FormContext.Provider>
  );
}

export function FieldRenderer({ node }: NodeRendererProps) {
  const form = useContext(FormContext);
  const actionHandler = useContext(ActionHandlerContext);
  const name = readString(node.props.name);
  let label = readString(node.props.label || node.props.name, "Field");
  
  if (/^select$/i.test(label) && name && name.toLowerCase() !== "select") {
    const strippedName = name.replace(/^(cmb|txt|rad|chk|hdn|sel)/i, "");
    label = strippedName
      .replace(/([A-Z])/g, " $1")
      .replace(/[-_]+/g, " ")
      .trim();
    label = label.charAt(0).toUpperCase() + label.slice(1);
    if (!label) label = "Selection";
  }

  const inputType = readString(node.props.inputType, "text").toLowerCase();
  const value = getFieldInitialValue(node);
  const placeholder = readString(node.props.placeholder);
  const required = readBoolean(node.props.required);
  const disabled = readBoolean(node.props.disabled) || form?.submitting === true;
  const readOnly = readBoolean(node.props.readOnly);
  const options = readOptions(node.props.options);
  const boundForm = form && name ? form : null;
  const isBound = Boolean(boundForm);
  const currentValue = boundForm ? boundForm.values[name] ?? value : value;

  useEffect(() => {
    if (form && !name && actionHandler?.debugEnabled) {
      console.warn("[ERP document] Field inside form is missing name", node);
    }
  }, [actionHandler?.debugEnabled, form, name, node]);

  const handleChange = useCallback(
    (nextValue: string) => {
      if (!form || !name) return;
      form.clearError();
      form.setValue(name, nextValue);
    },
    [form, name]
  );

  if (inputType === "hidden") {
    return <input type="hidden" name={name || undefined} value={currentValue} readOnly />;
  }

  if (inputType === "checkbox" || inputType === "radio") {
    const controlValue = readString(node.props.value, "on") || "on";
    const defaultChecked = readBoolean(node.props.checked);
    const selectedValues = currentValue
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
    const checked = isBound
      ? inputType === "radio"
        ? currentValue === controlValue
        : selectedValues.includes(controlValue)
      : defaultChecked;

    const handleToggle = (nextChecked: boolean) => {
      if (!form || !name) return;
      form.clearError();

      if (inputType === "radio") {
        form.setValue(name, nextChecked ? controlValue : "");
        return;
      }

      const nextValues = new Set(selectedValues);
      if (nextChecked) {
        nextValues.add(controlValue);
      } else {
        nextValues.delete(controlValue);
      }
      form.setValue(name, Array.from(nextValues).join("\n"));
    };

    const isGrouped = readBoolean(node.props.isGrouped);

    return (
      <label
        className={`group inline-flex w-full cursor-pointer items-start gap-3 px-4 py-3 text-sm text-[var(--comp-text-primary)] transition ${
          !isGrouped ? "rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm" : ""
        } ${
          disabled
            ? "cursor-not-allowed opacity-60"
            : "hover:bg-[color-mix(in_srgb,var(--comp-accent)_6%,var(--surface))]"
        } ${!isGrouped && !disabled ? "hover:border-[var(--comp-accent)]" : ""}`}
      >
        <input
          type={inputType}
          name={name || undefined}
          value={controlValue}
          checked={isBound ? checked : undefined}
          defaultChecked={isBound ? undefined : defaultChecked}
          required={required}
          disabled={disabled}
          readOnly={readOnly}
          onChange={(event) => handleToggle(event.currentTarget.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_92%,transparent)] text-white transition peer-focus-visible:ring-2 peer-focus-visible:ring-[color-mix(in_srgb,var(--comp-accent)_30%,transparent)] peer-checked:border-[var(--comp-accent)] peer-checked:bg-[var(--comp-accent)] peer-checked:[&>span]:opacity-100 peer-checked:[&>svg]:opacity-100 ${
            inputType === "radio" ? "rounded-full" : "rounded-md"
          }`}
        >
          {inputType === "checkbox" ? (
            <Check className="h-3.5 w-3.5 opacity-0 transition" />
          ) : (
            <span className="h-2 w-2 rounded-full bg-white opacity-0 transition" />
          )}
        </span>
        <span className="min-w-0 leading-5 text-[var(--comp-text-primary)]">{label}</span>
      </label>
    );
  }

  if (inputType === "select" && options.length > 0) {
    return (
      <label className="flex flex-col gap-2 text-sm">
        <span data-page-contrast="true" className="page-contrast-fg font-medium">{label}</span>
        <select
          name={name || undefined}
          value={isBound ? currentValue : undefined}
          defaultValue={isBound ? undefined : value}
          disabled={disabled}
          onChange={(event) => handleChange(event.currentTarget.value)}
          className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-[var(--comp-text-primary)] shadow-sm outline-none transition focus:border-[var(--comp-accent)] focus:ring-1 focus:ring-[var(--comp-accent)]"
        >
          <option value="">Select</option>
          {options.map((option) => (
            <option key={`${node.id}-${option.value}-${option.label}`} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (inputType === "textarea") {
    return (
      <label className="flex flex-col gap-2 text-sm">
        <span data-page-contrast="true" className="page-contrast-fg font-medium">{label}</span>
        <textarea
          name={name || undefined}
          value={isBound ? currentValue : undefined}
          defaultValue={isBound ? undefined : value}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          readOnly={readOnly}
          onChange={(event) => handleChange(event.currentTarget.value)}
          className="min-h-24 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--comp-text-primary)] shadow-sm outline-none transition focus:border-[var(--comp-accent)] focus:ring-1 focus:ring-[var(--comp-accent)]"
        />
      </label>
    );
  }

  return (
    <label className="flex flex-col gap-2 text-sm">
      <span data-page-contrast="true" className="page-contrast-fg font-medium">{label}</span>
      <input
        type={inputType || "text"}
        name={name || undefined}
        value={isBound ? currentValue : undefined}
        defaultValue={isBound ? undefined : value}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        readOnly={readOnly}
        onChange={(event) => handleChange(event.currentTarget.value)}
        className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-[var(--comp-text-primary)] shadow-sm outline-none transition focus:border-[var(--comp-accent)] focus:ring-1 focus:ring-[var(--comp-accent)]"
      />
    </label>
  );
}

export function ButtonRenderer({ node }: NodeRendererProps) {
  const form = useContext(FormContext);
  const actionHandler = useContext(ActionHandlerContext);
  const label = readString(node.props.label, "Button");
  const inputType = readString(node.props.inputType, "button").toLowerCase();
  const disabled = readBoolean(node.props.disabled);
  let action = readAction(node.props.action);

  if (!action && inputType === "submit" && form) {
    action = { type: "submit_form", target: "", method: "POST", onSuccess: "reload_page" };
  }

  const actionType = readString(action?.type);
  const actionTarget = readString(action?.targetRoute || action?.target);
  const hasRunnableAction =
    actionType === "submit_form"
      ? Boolean(form || actionTarget)
      : actionType === "print_exam_application"
        ? Boolean(actionTarget)
      : actionType === "navigate" || actionType === "api_call"
        ? Boolean(actionTarget)
        : false;
  const isPending = actionHandler?.pendingNodeId === node.id || (form?.submitting === true && actionType === "submit_form");
  const actionHint =
    !hasRunnableAction
      ? "This action is unavailable in the current ERP snapshot."
      : actionType === "submit_form"
        ? "Submits this form"
      : actionType === "navigate"
        ? `Navigates to ${actionTarget || "linked page"}`
        : actionType === "print_exam_application"
          ? "Opens the printable exam application"
        : actionType === "api_call"
          ? `Calls ${actionTarget || "ERP endpoint"}`
          : "";

  useEffect(() => {
    if (!actionHandler?.debugEnabled) return;
    if (node.props.action && !action) {
      console.warn("[ERP document] Button action schema mismatch", node);
      return;
    }
    if (action && !actionTarget && action.type !== "navigate") {
      console.warn("[ERP document] Button action is missing target", node);
    }
  }, [action, actionHandler?.debugEnabled, actionTarget, node]);

  const onClick = useCallback(async () => {
    if (!action || !actionHandler) return;

    form?.clearError();
    actionHandler.clearGlobalError();

    if (action.type === "submit_form" && form) {
      await form.submit();
      return;
    }

    try {
      await actionHandler.handleAction(action, {
        node,
        formState: form?.values,
        setError: form?.setError,
      });
    } catch {
      return;
    }
  }, [action, actionHandler, form, node]);

  return (
    <button
      type={inputType === "submit" ? "submit" : "button"}
      disabled={disabled || isPending || !hasRunnableAction}
      title={actionHint || undefined}
      data-action-type={actionType || undefined}
      data-action-target={actionTarget || undefined}
      onClick={(event) => {
        if (!action || !hasRunnableAction) return;
        event.preventDefault();
        void onClick();
      }}
      className="rounded bg-[var(--comp-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
    >
      {isPending ? "Loading..." : label}
    </button>
  );
}
