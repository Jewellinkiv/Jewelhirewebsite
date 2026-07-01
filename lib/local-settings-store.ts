import { CalProvider, INVITE_SETTINGS, InviteSettings } from "./invite-settings";
import { MANAGER_USERS, ManagerUser, UserRole } from "./users";

export interface NotificationRule {
  label: string;
  channel: string;
  owner: string;
}

export interface StoreSettingsRecord {
  storeId: string;
  organization: {
    company: string;
    primaryStore: string;
    defaultManager: string;
  };
  workflow: string[];
  notifications: NotificationRule[];
  updatedAt: string;
}

export interface StoreIntegration {
  provider: CalProvider;
  label: string;
  account: string;
  status: "connected" | "disconnected";
  scopes: string[];
  connectedAt?: string;
}

interface SettingsState {
  usersByStoreId: Record<string, ManagerUser[]>;
  settingsByStoreId: Record<string, StoreSettingsRecord>;
  inviteSettingsByStoreId: Record<string, InviteSettings>;
  integrationsByStoreId: Record<string, StoreIntegration[]>;
}

declare global {
  // eslint-disable-next-line no-var
  var __jewelhireSettingsStore: SettingsState | undefined;
}

const DEFAULT_WORKFLOW = ["Applied", "Cert sent", "GemMatch done", "In review", "Interview", "Offer", "Hired"];

const DEFAULT_NOTIFICATIONS: NotificationRule[] = [
  { label: "Candidate completes GemMatch", channel: "Email + in-app", owner: "Hiring manager" },
  { label: "Assessment package expires", channel: "In-app", owner: "Store admin" },
  { label: "Training assignment overdue", channel: "Email", owner: "Manager" },
  { label: "New strong-fit candidate", channel: "Email + in-app", owner: "Manager" },
];

const PROVIDER_META: Record<CalProvider, { label: string; scopes: string[] }> = {
  google: { label: "Google Calendar", scopes: ["calendar.events", "calendar.readonly", "gmail.send"] },
  microsoft: { label: "Microsoft Outlook", scopes: ["Calendars.ReadWrite", "Mail.Send", "offline_access"] },
};

function state(): SettingsState {
  if (!globalThis.__jewelhireSettingsStore) {
    globalThis.__jewelhireSettingsStore = {
      usersByStoreId: {},
      settingsByStoreId: {},
      inviteSettingsByStoreId: {},
      integrationsByStoreId: {},
    };
  }
  return globalThis.__jewelhireSettingsStore;
}

function cloneUser(user: ManagerUser): ManagerUser {
  return { ...user };
}

function cloneInviteSettings(settings: InviteSettings): InviteSettings {
  return { ...settings };
}

function cloneStoreSettings(settings: StoreSettingsRecord): StoreSettingsRecord {
  return {
    ...settings,
    organization: { ...settings.organization },
    workflow: [...settings.workflow],
    notifications: settings.notifications.map((notification) => ({ ...notification })),
  };
}

function ensureUsers(storeId: string) {
  const settings = state();
  settings.usersByStoreId[storeId] ??= MANAGER_USERS.map(cloneUser);
  return settings.usersByStoreId[storeId];
}

function ensureInviteSettings(storeId: string) {
  const settings = state();
  settings.inviteSettingsByStoreId[storeId] ??= cloneInviteSettings(INVITE_SETTINGS);
  return settings.inviteSettingsByStoreId[storeId];
}

function ensureStoreSettings(storeId: string) {
  const settings = state();
  settings.settingsByStoreId[storeId] ??= {
    storeId,
    organization: {
      company: "Sissy's Log Cabin",
      primaryStore: "Little Rock, Arkansas",
      defaultManager: "William Jones",
    },
    workflow: [...DEFAULT_WORKFLOW],
    notifications: DEFAULT_NOTIFICATIONS.map((notification) => ({ ...notification })),
    updatedAt: new Date().toISOString(),
  };
  return settings.settingsByStoreId[storeId];
}

function ensureIntegrations(storeId: string) {
  const settings = state();
  const inviteSettings = ensureInviteSettings(storeId);
  settings.integrationsByStoreId[storeId] ??= (["google", "microsoft"] as CalProvider[]).map((provider) => ({
    provider,
    label: PROVIDER_META[provider].label,
    account: provider === inviteSettings.calendarProvider ? inviteSettings.account : "",
    status: provider === inviteSettings.calendarProvider ? "connected" : "disconnected",
    scopes: [...PROVIDER_META[provider].scopes],
    connectedAt: provider === inviteSettings.calendarProvider ? new Date().toISOString() : undefined,
  }));
  return settings.integrationsByStoreId[storeId];
}

export function listStoreUsers(storeId: string) {
  return ensureUsers(storeId).map(cloneUser);
}

export function inviteStoreUser(storeId: string, input: { name: string; email: string; role: UserRole }) {
  const users = ensureUsers(storeId);
  const user: ManagerUser = {
    id: `user-${Date.now().toString(36)}`,
    name: input.name.trim(),
    email: input.email.trim(),
    role: input.role,
    status: "Invited",
  };
  if (input.role === "Admin") {
    users.forEach((existing) => {
      if (existing.role === "Admin") existing.role = "Supervisor";
    });
  }
  users.push(user);
  return { user: cloneUser(user), users: users.map(cloneUser) };
}

export function updateStoreUser(userId: string, input: { role?: UserRole; status?: ManagerUser["status"] }) {
  const settings = state();
  for (const users of Object.values(settings.usersByStoreId)) {
    const user = users.find((candidate) => candidate.id === userId);
    if (!user) continue;
    if (input.role === "Admin") {
      users.forEach((existing) => {
        if (existing.role === "Admin") existing.role = "Supervisor";
      });
      user.role = "Admin";
    } else if (input.role) {
      user.role = input.role;
    }
    if (input.status) user.status = input.status;
    return { user: cloneUser(user), users: users.map(cloneUser) };
  }
  return undefined;
}

export function removeStoreUser(userId: string) {
  const settings = state();
  for (const [storeId, users] of Object.entries(settings.usersByStoreId)) {
    const user = users.find((candidate) => candidate.id === userId);
    if (!user || user.role === "Admin") continue;
    settings.usersByStoreId[storeId] = users.filter((candidate) => candidate.id !== userId);
    return { user: cloneUser(user), users: settings.usersByStoreId[storeId].map(cloneUser) };
  }
  return undefined;
}

export function transferStoreAdmin(storeId: string, toUserId: string) {
  const users = ensureUsers(storeId);
  const target = users.find((user) => user.id === toUserId);
  if (!target) return undefined;
  users.forEach((user) => {
    user.role = user.id === toUserId ? "Admin" : "Supervisor";
  });
  return { user: cloneUser(target), users: users.map(cloneUser) };
}

export function getStoreSettings(storeId: string) {
  return cloneStoreSettings(ensureStoreSettings(storeId));
}

export function updateStoreSettings(storeId: string, input: Partial<Omit<StoreSettingsRecord, "storeId" | "updatedAt">>) {
  const settings = ensureStoreSettings(storeId);
  if (input.organization) settings.organization = { ...settings.organization, ...input.organization };
  if (input.workflow) settings.workflow = [...input.workflow];
  if (input.notifications) settings.notifications = input.notifications.map((notification) => ({ ...notification }));
  settings.updatedAt = new Date().toISOString();
  return cloneStoreSettings(settings);
}

export function listStoreIntegrations(storeId: string) {
  return ensureIntegrations(storeId).map((integration) => ({ ...integration, scopes: [...integration.scopes] }));
}

export function connectStoreIntegration(storeId: string, provider: CalProvider) {
  const integrations = ensureIntegrations(storeId);
  const inviteSettings = ensureInviteSettings(storeId);
  integrations.forEach((integration) => {
    integration.status = integration.provider === provider ? "connected" : "disconnected";
    integration.account = integration.provider === provider ? inviteSettings.account : "";
    integration.connectedAt = integration.provider === provider ? new Date().toISOString() : undefined;
  });
  inviteSettings.calendarProvider = provider;
  return {
    integrations: listStoreIntegrations(storeId),
    inviteSettings: cloneInviteSettings(inviteSettings),
  };
}

export function disconnectStoreIntegration(storeId: string, provider: CalProvider) {
  const integrations = ensureIntegrations(storeId);
  const inviteSettings = ensureInviteSettings(storeId);
  const integration = integrations.find((item) => item.provider === provider);
  if (!integration) return undefined;
  integration.status = "disconnected";
  integration.account = "";
  integration.connectedAt = undefined;
  if (inviteSettings.calendarProvider === provider) inviteSettings.calendarProvider = null;
  return {
    integrations: listStoreIntegrations(storeId),
    inviteSettings: cloneInviteSettings(inviteSettings),
  };
}

export function getStoreInviteSettings(storeId: string) {
  return cloneInviteSettings(ensureInviteSettings(storeId));
}

export function updateStoreInviteSettings(storeId: string, input: Partial<InviteSettings>) {
  const current = ensureInviteSettings(storeId);
  const next = { ...current, ...input };
  state().inviteSettingsByStoreId[storeId] = next;
  const integrations = ensureIntegrations(storeId);
  integrations.forEach((integration) => {
    integration.status = integration.provider === next.calendarProvider ? "connected" : "disconnected";
    integration.account = integration.provider === next.calendarProvider ? next.account : "";
    integration.connectedAt = integration.provider === next.calendarProvider ? (integration.connectedAt ?? new Date().toISOString()) : undefined;
  });
  return cloneInviteSettings(next);
}
