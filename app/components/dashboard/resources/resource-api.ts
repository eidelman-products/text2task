export type TaskResourceType =
  | "link"
  | "image"
  | "logo"
  | "banner"
  | "document"
  | "brief"
  | "reference"
  | "file"
  | "note"
  | "website";

export type TaskResource = {
  id: string;
  user_id: string;
  project_id: string | null;
  task_id: number | null;
  resource_type: TaskResourceType;
  title: string | null;
  url: string | null;
  storage_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateTaskResourceInput = {
  project_id?: string | null;
  task_id?: number | null;
  resource_type?: TaskResourceType;
  title?: string | null;
  url?: string | null;
  notes?: string | null;
  storage_path?: string | null;
  file_name?: string | null;
  mime_type?: string | null;
  size_bytes?: number | null;
};

export type UpdateTaskResourceInput = {
  resource_id: string;
  resource_type?: TaskResourceType;
  title?: string | null;
  url?: string | null;
  notes?: string | null;
};

function buildQueryString(
  params: Record<string, string | number | boolean | null | undefined>
) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") return;
    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

async function readJsonResponse(res: Response) {
  const text = await res.text();

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return {
      error: text,
    };
  }
}

export async function fetchTaskResources(params: {
  project_id?: string | null;
  task_id?: number | null;
}): Promise<TaskResource[]> {
  const queryString = buildQueryString({
    project_id: params.project_id,
    task_id: params.task_id,
  });

  const res = await fetch(`/api/task-resources${queryString}`, {
    method: "GET",
  });

  const data = await readJsonResponse(res);

  if (!res.ok) {
    throw new Error(data?.error || "Failed to load resources");
  }

  return Array.isArray(data?.resources) ? data.resources : [];
}

export async function createTaskResource(
  input: CreateTaskResourceInput
): Promise<TaskResource> {
  const res = await fetch("/api/task-resources", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const data = await readJsonResponse(res);

  if (!res.ok) {
    throw new Error(data?.error || "Failed to create resource");
  }

  if (!data?.resource) {
    throw new Error("Resource was not returned by the server");
  }

  return data.resource;
}

export async function updateTaskResource(
  input: UpdateTaskResourceInput
): Promise<TaskResource> {
  const res = await fetch("/api/task-resources", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const data = await readJsonResponse(res);

  if (!res.ok) {
    throw new Error(data?.error || "Failed to update resource");
  }

  if (!data?.resource) {
    throw new Error("Updated resource was not returned by the server");
  }

  return data.resource;
}

export async function getTaskResourceFileUrl(
  resourceId: string,
  options?: {
    download?: boolean;
  }
): Promise<string> {
  const queryString = buildQueryString({
    resource_id: resourceId,
    download: options?.download ? "true" : "false",
  });

  const res = await fetch(`/api/task-resources/file-url${queryString}`, {
    method: "GET",
  });

  const data = await readJsonResponse(res);

  if (!res.ok) {
    throw new Error(data?.error || "Failed to open file");
  }

  if (!data?.url) {
    throw new Error("File URL was not returned by the server");
  }

  return data.url;
}

export async function deleteTaskResource(resourceId: string): Promise<void> {
  const res = await fetch("/api/task-resources", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      resource_id: resourceId,
    }),
  });

  const data = await readJsonResponse(res);

  if (!res.ok) {
    throw new Error(data?.error || "Failed to delete resource");
  }
}

export async function createLinkResource(input: {
  project_id?: string | null;
  task_id?: number | null;
  title?: string | null;
  url: string;
  notes?: string | null;
  resource_type?: TaskResourceType;
}) {
  return createTaskResource({
    project_id: input.project_id,
    task_id: input.task_id,
    resource_type: input.resource_type || "link",
    title: input.title || input.url,
    url: input.url,
    notes: input.notes || null,
  });
}

export async function createNoteResource(input: {
  project_id?: string | null;
  task_id?: number | null;
  title?: string | null;
  notes: string;
}) {
  return createTaskResource({
    project_id: input.project_id,
    task_id: input.task_id,
    resource_type: "note",
    title: input.title || "Note",
    notes: input.notes,
  });
}

export async function uploadAndCreateFileResource(input: {
  file: File;
  project_id?: string | null;
  task_id?: number | null;
  title?: string | null;
  notes?: string | null;
  resource_type?: TaskResourceType;
}): Promise<TaskResource> {
  const formData = new FormData();

  formData.append("file", input.file);

  if (input.project_id) {
    formData.append("project_id", input.project_id);
  }

  if (input.task_id) {
    formData.append("task_id", String(input.task_id));
  }

  if (input.resource_type) {
    formData.append("resource_type", input.resource_type);
  }

  if (input.title) {
    formData.append("title", input.title);
  }

  if (input.notes) {
    formData.append("notes", input.notes);
  }

  const res = await fetch("/api/task-resources/upload-and-create", {
    method: "POST",
    body: formData,
  });

  const data = await readJsonResponse(res);

  if (!res.ok) {
    throw new Error(data?.error || "Failed to upload file");
  }

  if (!data?.resource) {
    throw new Error("Created resource was not returned by the server");
  }

  return data.resource;
}

export function formatResourceFileSize(sizeBytes?: number | null) {
  if (!sizeBytes || sizeBytes <= 0) return "";

  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getResourceTypeLabel(type: TaskResourceType) {
  const labels: Record<TaskResourceType, string> = {
    link: "Link",
    image: "Image",
    logo: "Logo",
    banner: "Banner",
    document: "Document",
    brief: "Brief",
    reference: "Reference",
    file: "File",
    note: "Note",
    website: "Website",
  };

  return labels[type] || "Resource";
}

export function getResourceIcon(type: TaskResourceType) {
  const icons: Record<TaskResourceType, string> = {
    link: "🔗",
    image: "🖼️",
    logo: "◇",
    banner: "▭",
    document: "📄",
    brief: "📝",
    reference: "✦",
    file: "📎",
    note: "✍",
    website: "🌐",
  };

  return icons[type] || "📎";
}

export function isFileResource(resource: TaskResource) {
  return Boolean(resource.storage_path || resource.file_name);
}

export function isLinkResource(resource: TaskResource) {
  return Boolean(resource.url);
}

export function isNoteResource(resource: TaskResource) {
  return resource.resource_type === "note";
}
