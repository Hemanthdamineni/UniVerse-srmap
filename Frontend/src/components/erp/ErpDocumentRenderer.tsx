import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { SectionCard } from "./ErpPrimitives";
import {
  sendErpDocumentRequest,
  type ErpDocument,
  type ErpNode,
  type ErpNodeType,
} from "../../lib/erpApi";
import {
  ActionHandlerContext,
  isRecord,
  readString,
  type ActionExecutionContext,
  type ActionHandlerContextValue,
  type ButtonAction,
  type NodeRendererProps,
} from "./documentRenderer/model";
import {
  assertSafeAction,
  buildExamApplicationPrintTarget,
  buildRouteTarget,
  formatActionError,
  resolveDebugFlag,
} from "./documentRenderer/actions";
import { TextRenderer } from "./documentRenderer/display";
import { TableRenderer } from "./documentRenderer/table";
import { ButtonRenderer, FieldRenderer, FormRenderer } from "./documentRenderer/controls";

function ContainerRenderer({ node, renderChildren }: NodeRendererProps) {
  const title = readString(node.props.title);
  const children = renderChildren(node.children);

  if (!title) {
    return <div className="space-y-4">{children}</div>;
  }

  return (
    <SectionCard title={title}>
      <div className="space-y-6">{children}</div>
    </SectionCard>
  );
}

const registry: Record<ErpNodeType, (props: NodeRendererProps) => ReactNode> = {
  container: ContainerRenderer,
  text: TextRenderer,
  table: TableRenderer,
  form: FormRenderer,
  field: FieldRenderer,
  button: ButtonRenderer,
};

function UnsupportedBlock({ node, renderChildren }: NodeRendererProps) {
  const actionHandler = useContext(ActionHandlerContext);

  useEffect(() => {
    if (!actionHandler?.debugEnabled) return;
    console.warn("[ERP document] Unsupported node rendered as placeholder", node);
  }, [actionHandler?.debugEnabled, node]);

  return (
    <div className="space-y-3 rounded-xl border border-dashed border-[color-mix(in_srgb,var(--border)_70%,transparent)] bg-[color-mix(in_srgb,var(--surface)_50%,transparent)] p-4">
      <div className="text-sm text-[var(--text-secondary)]">Unsupported content.</div>
      {actionHandler?.debugEnabled ? (
        <div className="mt-2 space-y-2 text-xs text-[var(--text-secondary)]">
          <div>
            <span className="font-semibold">PROPS: </span>
            <span>{Object.keys(node.props || {}).length} props</span>
          </div>
          <pre className="text-xs overflow-auto max-h-40 rounded bg-[var(--comp-surface-hover)] p-2">
            {JSON.stringify(node.props, null, 2)}
          </pre>
          <div>
            <span className="font-semibold">CHILDREN: </span>
            <span>
              {Array.isArray(node.children)
                ? `${node.children.length} nodes`
                : "-"}
            </span>
          </div>
        </div>
      ) : null}
      {Array.isArray(node.children) && node.children.length > 0 ? (
        <div className="space-y-3">{renderChildren(node.children)}</div>
      ) : null}
    </div>
  );
}

/**
 * Safely renders a single value for debug display.
 * Objects → JSON.stringify, primitives → String(), never raw object interpolation.
 */
function safeDebugValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "[unserializable]";
  }
}

function DocumentNode({ node }: { node: ErpNode }) {
  const actionHandler = useContext(ActionHandlerContext);
  const safeNode =
    node && typeof node === "object"
      ? {
        ...node,
        props: isRecord(node.props) ? node.props : {},
        children: Array.isArray(node.children) ? node.children.filter(Boolean) : [],
      }
      : {
        id: "erp-invalid-node",
        type: "text" as const,
        props: { text: "Unsupported content." },
        children: [],
      };
  const Renderer = registry[safeNode.type];

  if (!Renderer) {
    if (actionHandler?.debugEnabled) {
      console.warn("[ERP document] Unrenderable node", safeNode);
    }
    return (
      <UnsupportedBlock
        node={safeNode}
        renderChildren={(children) => {
          const grouped = groupConsecutiveCheckboxes(children);
          return grouped.map((item, index) => {
            if (Array.isArray(item)) {
              return (
                <div key={`group-${index}`} className="flex flex-col overflow-hidden rounded-xl border border-[color-mix(in_srgb,var(--border)_85%,transparent)] bg-[color-mix(in_srgb,var(--surface)_75%,transparent)] backdrop-blur-md shadow-sm divide-y divide-[color-mix(in_srgb,var(--border)_40%,transparent)]">
                  {item.map(child => (
                    <DocumentNode key={child.id} node={{ ...child, props: { ...child.props, isGrouped: true } }} />
                  ))}
                </div>
              );
            }
            return <DocumentNode key={item.id} node={item} />;
          });
        }}
      />
    );
  }

function groupConsecutiveCheckboxes(children: ErpNode[]): Array<ErpNode | ErpNode[]> {
  const grouped: Array<ErpNode | ErpNode[]> = [];
  let currentGroup: ErpNode[] = [];

  for (const child of children) {
    if (child.type === "field") {
      const inputType = String(child.props.inputType || "text").toLowerCase();
      if (inputType === "checkbox" || inputType === "radio") {
        currentGroup.push(child);
        continue;
      }
    }
    if (currentGroup.length > 0) {
      if (currentGroup.length === 1) {
        grouped.push(currentGroup[0]);
      } else {
        grouped.push(currentGroup);
      }
      currentGroup = [];
    }
    grouped.push(child);
  }
  if (currentGroup.length > 0) {
    if (currentGroup.length === 1) {
      grouped.push(currentGroup[0]);
    } else {
      grouped.push(currentGroup);
    }
  }
  return grouped;
}

  return (
    <>
      <Renderer
        node={safeNode}
        renderChildren={(children) => {
          const grouped = groupConsecutiveCheckboxes(children);
          return grouped.map((item, index) => {
            if (Array.isArray(item)) {
              const firstChild = item[0];
              const firstProps = firstChild?.props || {};
              const firstLabel = readString(firstProps.label);
              
              const isTitle = 
                firstLabel.trim().endsWith("*") || 
                ((!firstProps.name || firstProps.name === firstProps.id) && !firstProps.value && firstLabel);

              const titleNode = isTitle ? firstChild : null;
              const checkboxNodes = isTitle ? item.slice(1) : item;

              if (checkboxNodes.length === 0) {
                return titleNode ? <DocumentNode key={titleNode.id} node={titleNode} /> : null;
              }

              return (
                <div key={`group-${index}`} className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
                  {titleNode ? (
                    <div className="border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--text-primary)_3%,transparent)] px-5 py-4 text-sm font-semibold tracking-wide text-[var(--text-primary)]">
                      {firstLabel.replace(/\*$/, "").trim()}
                      {firstLabel.trim().endsWith("*") ? <span className="ml-1 text-[var(--error)]">*</span> : null}
                    </div>
                  ) : null}
                  <div className="flex flex-col divide-y divide-[var(--border)]">
                    {checkboxNodes.map((child) => (
                      <DocumentNode key={child.id} node={{ ...child, props: { ...child.props, isGrouped: true } }} />
                    ))}
                  </div>
                </div>
              );
            }
            return <DocumentNode key={item.id} node={item} />;
          });
        }}
      />
      {actionHandler?.debugEnabled ? (
        <details className="mt-1 rounded border border-[var(--border)] bg-[var(--comp-surface)] p-2 text-xs">
          <summary className="cursor-pointer font-semibold text-[var(--text-secondary)]">
            🔍 {safeNode.type} #{safeNode.id} —{" "}
            <span className="text-[var(--text-secondary)]">
              {Object.keys(safeNode.props).length} props
            </span>
            {" / "}
            <span className="text-[var(--text-secondary)]">
              {Array.isArray(safeNode.children)
                ? `${safeNode.children.length} children`
                : "-"}
            </span>
          </summary>
          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-[var(--comp-surface-hover)] p-2 text-xs">
            {safeDebugValue(safeNode.props)}
          </pre>
        </details>
      ) : null}
    </>
  );
}

export function renderNode(node: ErpNode): ReactNode {
  return <DocumentNode node={node} />;
}

export default function ErpDocumentRenderer({
  document,
  debug,
  refreshDocument,
}: {
  document: ErpDocument;
  debug?: boolean;
  refreshDocument?: () => Promise<ErpDocument | null>;
}) {
  const navigate = useNavigate();
  const [activeDocument, setActiveDocument] = useState(document);
  const [pendingNodeId, setPendingNodeId] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState("");
  const debugEnabled = resolveDebugFlag(debug);

  useEffect(() => {
    setActiveDocument(document);
  }, [document]);

  useEffect(() => {
    if (!debugEnabled) return;
    console.info("[ERP document] Parsed document", activeDocument);
  }, [activeDocument, debugEnabled]);

  const clearGlobalError = useCallback(() => {
    setGlobalError("");
  }, []);

  const handleAction = useCallback(
    async (action: ButtonAction, context: ActionExecutionContext) => {
      if (debugEnabled) {
        console.info("[ERP document] Action triggered", {
          action,
          nodeId: context.node.id,
          formState: context.formState || {},
        });
      }

      clearGlobalError();
      context.setError?.("");
      context.setPending?.(true);
      setPendingNodeId(context.node.id);

      try {
        const safeAction = assertSafeAction(action);

        if (safeAction.type === "navigate") {
          navigate(buildRouteTarget(safeAction));
          return null;
        }

        if (safeAction.type === "print_exam_application") {
          const printTarget = buildExamApplicationPrintTarget(safeAction, context.formState);
          if (typeof window !== "undefined") {
            window.open(
              printTarget,
              "Exam Application",
              "width=950,height=650,scrollbars=yes,left=40,top=150"
            );
          }
          return { success: true, printReady: true, target: printTarget };
        }

        if (safeAction.type === "submit_form" || safeAction.type === "api_call") {
          const response = await sendErpDocumentRequest({
            url: safeAction.target,
            method: safeAction.method,
            data: context.formState || {},
          });

          if (debugEnabled) {
            console.info("[ERP document] Action response", {
              action: safeAction,
              nodeId: context.node.id,
              response,
            });
          }

          const nextStep = safeAction.onSuccess || "reload_page";
          if (nextStep !== "no_update" && refreshDocument) {
            const refreshedDocument = await refreshDocument();
            if (refreshedDocument) {
              setActiveDocument((currentDocument) => {
                if (nextStep === "update_section" && currentDocument?.root) {
                  return {
                    ...currentDocument,
                    title: refreshedDocument.title || currentDocument.title,
                    root: {
                      ...currentDocument.root,
                      children: Array.isArray(refreshedDocument.root?.children)
                        ? refreshedDocument.root.children
                        : currentDocument.root.children,
                    },
                  };
                }
                return refreshedDocument;
              });
            }
          }

          return response;
        }

        if (debugEnabled) {
          console.warn("[ERP document] Unsupported action", safeAction);
        }
        return null;
      } catch (error) {
        const message = formatActionError(error);
        if (context.setError) {
          context.setError(message);
        } else {
          setGlobalError(message);
        }

        if (debugEnabled) {
          console.error("[ERP document] Action failed", {
            action,
            nodeId: context.node.id,
            error,
          });
        }

        throw error;
      } finally {
        context.setPending?.(false);
        setPendingNodeId((current) => (current === context.node.id ? null : current));
      }
    },
    [clearGlobalError, debugEnabled, navigate, refreshDocument]
  );

  const actionContextValue = useMemo<ActionHandlerContextValue>(
    () => ({
      debugEnabled,
      pendingNodeId,
      globalError,
      clearGlobalError,
      handleAction,
    }),
    [clearGlobalError, debugEnabled, globalError, handleAction, pendingNodeId]
  );

  return (
    <ActionHandlerContext.Provider value={actionContextValue}>
      <div className="space-y-4 pb-6">
        {globalError ? (
          <div className="rounded-xl border border-[color-mix(in_srgb,var(--error)_30%,transparent)] bg-[color-mix(in_srgb,var(--error)_10%,transparent)] px-4 py-3 text-sm text-[var(--error)]">{globalError}</div>
        ) : null}
        <DocumentNode node={activeDocument.root} />
      </div>
    </ActionHandlerContext.Provider>
  );
}
