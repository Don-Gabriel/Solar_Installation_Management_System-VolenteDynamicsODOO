import { useId, useEffect, type ReactNode } from "react";
import { useForm, Controller } from "react-hook-form";
import { Link } from "react-router";
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  LoaderCircle,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
} from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useCommand, human, projectNumber, date, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
export const stages = [
  "enquiry",
  "survey",
  "quoted",
  "confirmed",
  "dispatched",
  "delivered",
  "completed",
];
export function Status({ value }: { value: string }) {
  return (
    <Badge variant="secondary" className={cn("status", `status-${value}`)}>
      {["completed", "approved", "closed", "delivered"].includes(value) && (
        <CheckCircle2 aria-hidden="true" />
      )}
      {human(value)}
    </Badge>
  );
}
export function ErrorNotice({ error }: { error: Error | null }) {
  return error ? (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertDescription>
        {error.message}
        {error instanceof ApiError && error.fields && (
          <ul>
            {error.fields.map((f, i) => (
              <li key={i}>
                {human(f.path.replaceAll("/", " "))}: {f.message}
              </li>
            ))}
          </ul>
        )}
      </AlertDescription>
    </Alert>
  ) : null;
}
export function Loading() {
  return (
    <div role="status" aria-label="Loading records" className="loading">
      <Skeleton className="h-8 w-52" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-60 w-full" />
    </div>
  );
}
export function Blank({
  title = "No records yet",
  children,
}: {
  title?: string;
  children?: ReactNode;
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>
          {children || "Records will appear here as work progresses."}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
export function PageHead({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="head-actions">{children}</div>
    </div>
  );
}
export function Panel({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("panel", className)}>
      <header className="panel-head">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {action}
      </header>
      <div className="panel-body">{children}</div>
    </section>
  );
}
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="form-dialog">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
export type FormField = {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number | string;
  hint?: string;
  money?: boolean;
  full?: boolean;
};
export function SmartForm({
  fields,
  defaults = {},
  submit = "Save changes",
  onSubmit,
  pending = false,
  error = null,
  children,
}: {
  fields: FormField[];
  defaults?: any;
  submit?: string;
  onSubmit: (data: any) => void;
  pending?: boolean;
  error?: Error | null;
  children?: ReactNode;
}) {
  const prefix = useId();
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isDirty },
  } = useForm({ defaultValues: defaults });
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (isDirty && !pending) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty, pending]);
  return (
    <form
      onSubmit={handleSubmit((values) => {
        const body = { ...values };
        fields.forEach((f) => {
          if (f.money && body[f.name] !== undefined)
            body[f.name] = Math.round(Number(body[f.name]) * 100);
        });
        onSubmit(body);
      })}
      className="smart-form"
    >
      <FieldGroup className="form-grid">
        {fields.map((f) => {
          const id = `${prefix}-${f.name}`,
            invalid = errors[f.name];
          return (
            <Field
              key={f.name}
              data-invalid={!!invalid}
              className={cn(
                f.full && "field-full",
                f.type === "checkbox" && "check-field",
              )}
              orientation={f.type === "checkbox" ? "horizontal" : "vertical"}
            >
              {f.type !== "checkbox" && (
                <FieldLabel htmlFor={id}>
                  {f.label}
                  {f.required !== false && <span aria-hidden="true"> *</span>}
                </FieldLabel>
              )}
              {f.type === "checkbox" ? (
                <Controller
                  control={control}
                  name={f.name}
                  defaultValue={false}
                  render={({ field }) => (
                    <Checkbox
                      id={id}
                      checked={!!field.value}
                      onCheckedChange={field.onChange}
                      disabled={pending}
                    />
                  )}
                />
              ) : f.type === "select" ? (
                <NativeSelect
                  id={id}
                  aria-invalid={!!invalid}
                  {...register(f.name, {
                    required:
                      f.required !== false ? "Choose an option." : false,
                  })}
                >
                  {f.options?.map((o) => (
                    <NativeSelectOption key={o.value} value={o.value}>
                      {o.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              ) : f.type === "textarea" ? (
                <Textarea
                  id={id}
                  aria-invalid={!!invalid}
                  {...register(f.name, {
                    required:
                      f.required !== false ? "Enter this information." : false,
                  })}
                />
              ) : (
                <Input
                  id={id}
                  type={f.type || "text"}
                  autoComplete={
                    f.type === "password"
                      ? "current-password"
                      : f.type === "email"
                        ? "username"
                        : f.name === "phone"
                          ? "tel"
                          : f.name === "name"
                            ? "name"
                            : "off"
                  }
                  spellCheck={
                    f.type === "email" || f.type === "password"
                      ? false
                      : undefined
                  }
                  inputMode={
                    f.type === "number"
                      ? "decimal"
                      : f.type === "tel"
                        ? "tel"
                        : undefined
                  }
                  step={
                    f.step ||
                    (f.type === "number" || f.money ? "any" : undefined)
                  }
                  min={f.min}
                  max={f.max}
                  aria-invalid={!!invalid}
                  {...register(f.name, {
                    required:
                      f.required !== false ? "Enter this information." : false,
                    ...(f.type === "number" ? { valueAsNumber: true } : {}),
                    ...(f.min !== undefined
                      ? { min: { value: f.min, message: `Minimum ${f.min}.` } }
                      : {}),
                    ...(f.max !== undefined
                      ? { max: { value: f.max, message: `Maximum ${f.max}.` } }
                      : {}),
                  })}
                />
              )}
              {f.type === "checkbox" && (
                <FieldLabel htmlFor={id}>{f.label}</FieldLabel>
              )}
              {f.hint && <p className="field-hint">{f.hint}</p>}
              {invalid && <FieldError>{String(invalid.message)}</FieldError>}
            </Field>
          );
        })}
      </FieldGroup>
      {children}
      <ErrorNotice error={error} />
      <Button type="submit" disabled={pending} className="submit-button">
        {pending && <LoaderCircle className="spin" data-icon="inline-start" />}
        {pending ? "Saving…" : submit}
      </Button>
    </form>
  );
}
export function CommandForm({
  path,
  onDone,
  transform,
  ...props
}: { path: string; onDone?: () => void; transform?: (data: any) => any } & Omit<
  Parameters<typeof SmartForm>[0],
  "onSubmit" | "pending" | "error"
>) {
  const mutation = useCommand(path, onDone);
  return (
    <SmartForm
      {...props}
      onSubmit={(d) => mutation.mutate(transform ? transform(d) : d)}
      pending={mutation.isPending}
      error={mutation.error}
    />
  );
}
export function Action({
  path,
  label,
  body = {},
  onDone,
  variant = "default",
  disabled = false,
}: {
  path: string;
  label: string;
  body?: any;
  onDone?: () => void;
  variant?: "default" | "outline" | "destructive" | "secondary";
  disabled?: boolean;
}) {
  const mutation = useCommand(path, onDone);
  return (
    <div className="action">
      <Button
        variant={variant}
        disabled={disabled || mutation.isPending}
        onClick={() => mutation.mutate(body)}
      >
        {mutation.isPending ? (
          <LoaderCircle className="spin" data-icon="inline-start" />
        ) : null}
        {label}
      </Button>
      <ErrorNotice error={mutation.error} />
      {mutation.isSuccess && (
        <span role="status" className="saved-feedback">
          Saved
        </span>
      )}
    </div>
  );
}
export function ProjectList({
  items,
  compact = false,
}: {
  items: any[];
  compact?: boolean;
}) {
  if (!items.length)
    return (
      <Blank title="No matching projects">
        Try a different search or add a new enquiry.
      </Blank>
    );
  return (
    <div className={cn("project-table", compact && "compact")}>
      <div className="table-labels">
        <span>Customer / site</span>
        <span>System</span>
        <span>Stage</span>
        <span>Owner / crew</span>
        <span />
      </div>
      {items.map((p) => (
        <Link className="project-row" key={p.id} to={`/projects/${p.id}`}>
          <div className="customer-cell">
            <span className="initials">
              {p.customer_name
                .split(" ")
                .map((s: string) => s[0])
                .slice(0, 2)
                .join("")}
            </span>
            <div>
              <strong>{p.customer_name}</strong>
              <small>
                {projectNumber(p.number)} · {p.address}
              </small>
            </div>
          </div>
          <div className="system-cell">
            <strong>{p.capacity_kw} kW</strong>
            <small>{human(p.system_type)}</small>
          </div>
          <div>
            <Status value={p.stage} />
          </div>
          <div className="owner-cell">
            <span>{p.technician_name || p.owner_name || "Unassigned"}</span>
            <small>{p.scheduled_at ? date(p.scheduled_at) : p.source}</small>
          </div>
          <ArrowUpRight className="row-arrow" aria-hidden="true" />
        </Link>
      ))}
    </div>
  );
}
export function NewProjectLink() {
  return (
    <Button render={<Link to="/projects/new" />} nativeButton={false}>
      <Plus data-icon="inline-start" />
      New enquiry
    </Button>
  );
}
