import { AdminCompanyUser, CompanyStatus, PlanTier } from "@/lib/admin";
import {
  createAdminCompany,
  getAdminAnalytics,
  getAdminBilling,
  getAdminCompany,
  getAdminOverview,
  getAdminSupport,
  createAdminAssessment,
  inviteAdminCompanyUser,
  listAdminAssessments,
  listAdminCompanies,
  removeAdminAssessment,
  updateAdminAssessment,
  removeAdminCompany,
  removeAdminUser,
  resendAdminUserInvite,
  startAdminImpersonation,
  updateAdminCompany,
  updateAdminUser,
} from "@/lib/local-admin-store";
import {
  createPostgresAdminCompany,
  getPostgresAdminAnalytics,
  getPostgresAdminBilling,
  getPostgresAdminCompany,
  getPostgresAdminOverview,
  getPostgresAdminSupport,
  invitePostgresAdminCompanyUser,
  listPostgresAdminCompanies,
  removePostgresAdminCompany,
  removePostgresAdminUser,
  resendPostgresAdminUserInvite,
  startPostgresAdminImpersonation,
  updatePostgresAdminCompany,
  updatePostgresAdminUser,
} from "@/lib/server/postgres-phase1";
import { selectStoreAdapter } from "@/lib/server/storage-runtime";

type MaybePromise<T> = T | Promise<T>;

export interface CreateAdminCompanyInput {
  name: string;
  owner: string;
  plan: PlanTier;
  ownerEmail?: string;
}

export interface UpdateAdminCompanyInput {
  companyId: string;
  plan?: PlanTier;
  status?: CompanyStatus;
}

export interface InviteAdminCompanyUserInput {
  companyId: string;
  name: string;
  email: string;
  role?: AdminCompanyUser["role"];
}

export interface UpdateAdminUserInput {
  userId: string;
  role?: AdminCompanyUser["role"];
  status?: AdminCompanyUser["status"];
}

export interface AdminStore {
  listCompanies(query?: string): MaybePromise<ReturnType<typeof listAdminCompanies>>;
  getCompany(companyId: string): MaybePromise<ReturnType<typeof getAdminCompany>>;
  createCompany(input: CreateAdminCompanyInput): MaybePromise<ReturnType<typeof createAdminCompany>>;
  updateCompany(input: UpdateAdminCompanyInput): MaybePromise<ReturnType<typeof updateAdminCompany>>;
  removeCompany(companyId: string): MaybePromise<ReturnType<typeof removeAdminCompany>>;
  inviteCompanyUser(input: InviteAdminCompanyUserInput): MaybePromise<ReturnType<typeof inviteAdminCompanyUser>>;
  updateUser(input: UpdateAdminUserInput): MaybePromise<ReturnType<typeof updateAdminUser>>;
  removeUser(userId: string): MaybePromise<ReturnType<typeof removeAdminUser>>;
  resendUserInvite(userId: string): MaybePromise<ReturnType<typeof resendAdminUserInvite>>;
  startImpersonation(companyId: string): MaybePromise<ReturnType<typeof startAdminImpersonation>>;
  listAssessments: typeof listAdminAssessments;
  createAssessment: typeof createAdminAssessment;
  updateAssessment: typeof updateAdminAssessment;
  removeAssessment: typeof removeAdminAssessment;
  getOverview(): MaybePromise<ReturnType<typeof getAdminOverview>>;
  getBilling(): MaybePromise<ReturnType<typeof getAdminBilling>>;
  getAnalytics(): MaybePromise<ReturnType<typeof getAdminAnalytics>>;
  getSupport(query?: string): MaybePromise<ReturnType<typeof getAdminSupport>>;
}

const localAdminStore: AdminStore = {
  listCompanies: listAdminCompanies,
  getCompany: getAdminCompany,
  createCompany: createAdminCompany,
  updateCompany(input) {
    return updateAdminCompany(input.companyId, { plan: input.plan, status: input.status });
  },
  removeCompany: removeAdminCompany,
  inviteCompanyUser(input) {
    return inviteAdminCompanyUser(input.companyId, {
      name: input.name,
      email: input.email,
      role: input.role,
    });
  },
  updateUser(input) {
    return updateAdminUser(input.userId, {
      role: input.role,
      status: input.status,
    });
  },
  removeUser: removeAdminUser,
  resendUserInvite: resendAdminUserInvite,
  startImpersonation: startAdminImpersonation,
  listAssessments: listAdminAssessments,
  createAssessment: createAdminAssessment,
  updateAssessment: updateAdminAssessment,
  removeAssessment: removeAdminAssessment,
  getOverview: getAdminOverview,
  getBilling: getAdminBilling,
  getAnalytics: getAdminAnalytics,
  getSupport: getAdminSupport,
};

const postgresAdminStore: AdminStore = {
  listCompanies: listPostgresAdminCompanies,
  getCompany: getPostgresAdminCompany,
  createCompany: createPostgresAdminCompany,
  updateCompany(input) {
    return updatePostgresAdminCompany(input);
  },
  removeCompany: removePostgresAdminCompany,
  inviteCompanyUser(input) {
    return invitePostgresAdminCompanyUser(input);
  },
  updateUser(input) {
    return updatePostgresAdminUser(input);
  },
  removeUser: removePostgresAdminUser,
  resendUserInvite: resendPostgresAdminUserInvite,
  startImpersonation: startPostgresAdminImpersonation,
  listAssessments: listAdminAssessments,
  createAssessment: createAdminAssessment,
  updateAssessment: updateAdminAssessment,
  removeAssessment: removeAdminAssessment,
  getOverview: getPostgresAdminOverview,
  getBilling: getPostgresAdminBilling,
  getAnalytics: getPostgresAdminAnalytics,
  getSupport: getPostgresAdminSupport,
};

export function getAdminStore(): AdminStore {
  return selectStoreAdapter("admin-store", {
    local: localAdminStore,
    postgres: postgresAdminStore,
  });
}
