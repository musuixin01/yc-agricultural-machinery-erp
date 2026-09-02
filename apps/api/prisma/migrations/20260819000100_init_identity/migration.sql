CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'LOCKED', 'INACTIVE');
CREATE TYPE "AuditResult" AS ENUM ('SUCCESS', 'FAILURE');

CREATE TABLE "users" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "username" VARCHAR(64) NOT NULL,
  "display_name" VARCHAR(80) NOT NULL, "password_hash" VARCHAR(512) NOT NULL,
  "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE', "failed_login_count" INTEGER NOT NULL DEFAULT 0,
  "locked_until" TIMESTAMPTZ(3), "last_login_at" TIMESTAMPTZ(3), "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id"), CONSTRAINT "users_version_check" CHECK ("version" > 0),
  CONSTRAINT "users_failed_login_count_check" CHECK ("failed_login_count" >= 0)
);
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE INDEX "users_status_username_idx" ON "users"("status", "username");

CREATE TABLE "roles" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "code" VARCHAR(64) NOT NULL, "name" VARCHAR(80) NOT NULL,
  "description" VARCHAR(240), "is_system" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

CREATE TABLE "permissions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "code" VARCHAR(100) NOT NULL, "name" VARCHAR(100) NOT NULL,
  "description" VARCHAR(240), "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

CREATE TABLE "user_roles" (
  "user_id" UUID NOT NULL, "role_id" UUID NOT NULL, "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id", "role_id")
);
CREATE INDEX "user_roles_role_id_idx" ON "user_roles"("role_id");

CREATE TABLE "role_permissions" (
  "role_id" UUID NOT NULL, "permission_id" UUID NOT NULL, "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id", "permission_id")
);
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");

CREATE TABLE "auth_sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "user_id" UUID NOT NULL,
  "access_token_hash" CHAR(64) NOT NULL, "refresh_token_hash" CHAR(64) NOT NULL,
  "access_expires_at" TIMESTAMPTZ(3) NOT NULL, "refresh_expires_at" TIMESTAMPTZ(3) NOT NULL,
  "device_name" VARCHAR(120), "user_agent" VARCHAR(500), "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revoked_at" TIMESTAMPTZ(3), "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "auth_sessions_access_token_hash_key" ON "auth_sessions"("access_token_hash");
CREATE UNIQUE INDEX "auth_sessions_refresh_token_hash_key" ON "auth_sessions"("refresh_token_hash");
CREATE INDEX "auth_sessions_user_id_revoked_at_idx" ON "auth_sessions"("user_id", "revoked_at");
CREATE INDEX "auth_sessions_refresh_expires_at_idx" ON "auth_sessions"("refresh_expires_at");

CREATE TABLE "audit_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "actor_user_id" UUID, "action" VARCHAR(100) NOT NULL,
  "entity_type" VARCHAR(80) NOT NULL, "entity_id" VARCHAR(100), "result" "AuditResult" NOT NULL,
  "ip_address" VARCHAR(64), "metadata" JSONB NOT NULL DEFAULT '{}', "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "audit_events_actor_user_id_created_at_idx" ON "audit_events"("actor_user_id", "created_at");
CREATE INDEX "audit_events_entity_type_entity_id_created_at_idx" ON "audit_events"("entity_type", "entity_id", "created_at");
CREATE INDEX "audit_events_action_created_at_idx" ON "audit_events"("action", "created_at");

ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE;
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE;
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE;
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
