import { CalProvider, InviteSettings } from "@/lib/invite-settings";
import {
  connectStoreIntegration,
  disconnectStoreIntegration,
  getStoreInviteSettings,
  getStoreSettings,
  inviteStoreUser,
  listStoreIntegrations,
  listStoreUsers,
  removeStoreUser,
  StoreSettingsRecord,
  transferStoreAdmin,
  updateStoreInviteSettings,
  updateStoreSettings,
  updateStoreUser,
} from "@/lib/local-settings-store";
import { ManagerUser, UserRole } from "@/lib/users";
import { requireStoreAccess } from "@/lib/server/access-control";
import {
  connectPostgresStoreIntegration,
  disconnectPostgresStoreIntegration,
  getPostgresStoreInviteSettings,
  getPostgresStoreSettings,
  getPostgresStoreUserStoreId,
  invitePostgresStoreUser,
  listPostgresStoreIntegrations,
  listPostgresStoreUsers,
  removePostgresStoreUser,
  transferPostgresStoreAdmin,
  updatePostgresStoreInviteSettings,
  updatePostgresStoreSettings,
  updatePostgresStoreUser,
} from "@/lib/server/postgres-phase1";
import { selectStoreAdapter } from "@/lib/server/storage-runtime";

type MaybePromise<T> = T | Promise<T>;

export interface InviteStoreUserInput {
  storeId: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface UpdateStoreUserInput {
  userId: string;
  role?: UserRole;
  status?: ManagerUser["status"];
}

export interface UpdateStoreSettingsInput {
  storeId: string;
  settings: Partial<Omit<StoreSettingsRecord, "storeId" | "updatedAt">>;
}

export interface UpdateStoreInviteSettingsInput {
  storeId: string;
  inviteSettings: Partial<InviteSettings>;
}

export interface SettingsStore {
  getStoreSettings(storeId: string): MaybePromise<ReturnType<typeof getStoreSettings>>;
  updateStoreSettings(input: UpdateStoreSettingsInput): MaybePromise<ReturnType<typeof updateStoreSettings>>;
  listStoreUsers(storeId: string): MaybePromise<ReturnType<typeof listStoreUsers>>;
  inviteStoreUser(input: InviteStoreUserInput): MaybePromise<ReturnType<typeof inviteStoreUser> | undefined>;
  updateStoreUser(input: UpdateStoreUserInput): MaybePromise<ReturnType<typeof updateStoreUser>>;
  removeStoreUser(userId: string): MaybePromise<ReturnType<typeof removeStoreUser>>;
  transferStoreAdmin(input: { storeId: string; toUserId: string }): MaybePromise<ReturnType<typeof transferStoreAdmin>>;
  listStoreIntegrations(storeId: string): MaybePromise<ReturnType<typeof listStoreIntegrations>>;
  connectStoreIntegration(input: { storeId: string; provider: CalProvider }): MaybePromise<ReturnType<typeof connectStoreIntegration>>;
  disconnectStoreIntegration(input: { storeId: string; provider: CalProvider }): MaybePromise<ReturnType<typeof disconnectStoreIntegration>>;
  getStoreInviteSettings(storeId: string): MaybePromise<ReturnType<typeof getStoreInviteSettings>>;
  updateStoreInviteSettings(input: UpdateStoreInviteSettingsInput): MaybePromise<ReturnType<typeof updateStoreInviteSettings>>;
}

const localSettingsStore: SettingsStore = {
  async getStoreSettings(storeId) {
    return getStoreSettings(await requireStoreAccess(storeId, "settings.read"));
  },
  async updateStoreSettings(input) {
    await requireStoreAccess(input.storeId, "settings.update");
    return updateStoreSettings(input.storeId, input.settings);
  },
  async listStoreUsers(storeId) {
    return listStoreUsers(await requireStoreAccess(storeId, "settings.users.list"));
  },
  async inviteStoreUser(input) {
    await requireStoreAccess(input.storeId, "settings.users.invite");
    return inviteStoreUser(input.storeId, {
      name: input.name,
      email: input.email,
      role: input.role,
    });
  },
  updateStoreUser(input) {
    return updateStoreUser(input.userId, {
      role: input.role,
      status: input.status,
    });
  },
  removeStoreUser,
  async transferStoreAdmin(input) {
    await requireStoreAccess(input.storeId, "settings.admin.transfer");
    return transferStoreAdmin(input.storeId, input.toUserId);
  },
  async listStoreIntegrations(storeId) {
    return listStoreIntegrations(await requireStoreAccess(storeId, "settings.integrations.list"));
  },
  async connectStoreIntegration(input) {
    await requireStoreAccess(input.storeId, "settings.integrations.connect");
    return connectStoreIntegration(input.storeId, input.provider);
  },
  async disconnectStoreIntegration(input) {
    await requireStoreAccess(input.storeId, "settings.integrations.disconnect");
    return disconnectStoreIntegration(input.storeId, input.provider);
  },
  async getStoreInviteSettings(storeId) {
    return getStoreInviteSettings(await requireStoreAccess(storeId, "settings.invites.read"));
  },
  async updateStoreInviteSettings(input) {
    await requireStoreAccess(input.storeId, "settings.invites.update");
    return updateStoreInviteSettings(input.storeId, input.inviteSettings);
  },
};

const postgresSettingsStore: SettingsStore = {
  async getStoreSettings(storeId) {
    return getPostgresStoreSettings(await requireStoreAccess(storeId, "settings.read"));
  },
  async updateStoreSettings(input) {
    await requireStoreAccess(input.storeId, "settings.update");
    return updatePostgresStoreSettings(input);
  },
  async listStoreUsers(storeId) {
    return listPostgresStoreUsers(await requireStoreAccess(storeId, "settings.users.list"));
  },
  async inviteStoreUser(input) {
    await requireStoreAccess(input.storeId, "settings.users.invite");
    return invitePostgresStoreUser(input);
  },
  async updateStoreUser(input) {
    const storeId = await getPostgresStoreUserStoreId(input.userId);
    if (!storeId) return undefined;
    await requireStoreAccess(storeId, "settings.users.update");
    return updatePostgresStoreUser(input);
  },
  async removeStoreUser(userId) {
    const storeId = await getPostgresStoreUserStoreId(userId);
    if (!storeId) return undefined;
    await requireStoreAccess(storeId, "settings.users.remove");
    return removePostgresStoreUser(userId);
  },
  async transferStoreAdmin(input) {
    await requireStoreAccess(input.storeId, "settings.admin.transfer");
    return transferPostgresStoreAdmin(input);
  },
  async listStoreIntegrations(storeId) {
    return listPostgresStoreIntegrations(await requireStoreAccess(storeId, "settings.integrations.list"));
  },
  async connectStoreIntegration(input) {
    await requireStoreAccess(input.storeId, "settings.integrations.connect");
    return connectPostgresStoreIntegration(input);
  },
  async disconnectStoreIntegration(input) {
    await requireStoreAccess(input.storeId, "settings.integrations.disconnect");
    return disconnectPostgresStoreIntegration(input);
  },
  async getStoreInviteSettings(storeId) {
    return getPostgresStoreInviteSettings(await requireStoreAccess(storeId, "settings.invites.read"));
  },
  async updateStoreInviteSettings(input) {
    await requireStoreAccess(input.storeId, "settings.invites.update");
    return updatePostgresStoreInviteSettings(input);
  },
};

export function getSettingsStore(): SettingsStore {
  return selectStoreAdapter("settings-store", {
    local: localSettingsStore,
    postgres: postgresSettingsStore,
  });
}
