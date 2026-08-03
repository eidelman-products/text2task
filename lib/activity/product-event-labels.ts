import type { ProductEventName } from "@/lib/activity/product-event-contracts";

const PRODUCT_EVENT_LABELS: Readonly<Record<ProductEventName, string>> = {
  dashboard_viewed: "Dashboard viewed",
  extract_viewed: "Extract viewed",
  tasks_viewed: "Tasks viewed",
  calendar_viewed: "Calendar viewed",
  project_details_expanded: "Project details opened",
  project_resources_viewed: "Project resources viewed",
  project_history_viewed: "Project history viewed",
  client_update_opened: "Client update opened",
  calendar_day_viewed: "Calendar day viewed",
  calendar_event_viewed: "Calendar event viewed",
};

export function getProductEventLabel(eventName: ProductEventName | null) {
  return eventName === null ? "No views" : PRODUCT_EVENT_LABELS[eventName];
}
