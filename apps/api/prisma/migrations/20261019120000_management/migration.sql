-- Fase 2 (gestão): perfil de jogador completo, clubes com situação e responsável,
-- transferências com decisão em duas etapas e configurações gerais.
-- Gerada com `prisma migrate diff`; as restrições do fim são manuais (ver ADR 0007).

-- CreateEnum
CREATE TYPE "club_status" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "transfer_status" AS ENUM ('PENDING_CLUB', 'PENDING_ADMIN', 'APPROVED', 'REJECTED', 'CANCELED');

-- AlterTable
ALTER TABLE "clubs" ADD COLUMN     "crest_key" VARCHAR(200),
ADD COLUMN     "manager_user_id" UUID,
ADD COLUMN     "status" "club_status" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "player_profiles" ADD COLUMN     "avatar_key" VARCHAR(200),
ADD COLUMN     "efootball_id" VARCHAR(32),
ADD COLUMN     "region" VARCHAR(60);

-- CreateTable
CREATE TABLE "club_transfers" (
    "id" UUID NOT NULL,
    "player_id" UUID NOT NULL,
    "from_club_id" UUID,
    "to_club_id" UUID NOT NULL,
    "status" "transfer_status" NOT NULL,
    "note" VARCHAR(300),
    "club_decided_by_id" UUID,
    "club_decided_at" TIMESTAMPTZ(3),
    "decided_by_id" UUID,
    "decided_at" TIMESTAMPTZ(3),
    "decision_reason" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "club_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "key" VARCHAR(80) NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by_id" UUID,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "club_transfers_status_created_at_idx" ON "club_transfers"("status", "created_at");

-- CreateIndex
CREATE INDEX "club_transfers_player_id_idx" ON "club_transfers"("player_id");

-- CreateIndex
CREATE INDEX "club_transfers_to_club_id_status_idx" ON "club_transfers"("to_club_id", "status");

-- CreateIndex
CREATE INDEX "clubs_status_idx" ON "clubs"("status");

-- CreateIndex
CREATE INDEX "clubs_manager_user_id_idx" ON "clubs"("manager_user_id");

-- AddForeignKey
ALTER TABLE "clubs" ADD CONSTRAINT "clubs_manager_user_id_fkey" FOREIGN KEY ("manager_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_transfers" ADD CONSTRAINT "club_transfers_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_transfers" ADD CONSTRAINT "club_transfers_from_club_id_fkey" FOREIGN KEY ("from_club_id") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_transfers" ADD CONSTRAINT "club_transfers_to_club_id_fkey" FOREIGN KEY ("to_club_id") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_transfers" ADD CONSTRAINT "club_transfers_club_decided_by_id_fkey" FOREIGN KEY ("club_decided_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_transfers" ADD CONSTRAINT "club_transfers_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Restrições que o Prisma não expressa
-- ---------------------------------------------------------------------------

-- ID do eFootball: único por plataforma sem diferenciar maiúsculas (decisão D2, ADR 0010).
ALTER TABLE "player_profiles"
  ADD CONSTRAINT "player_profiles_efootball_id_format_check"
    CHECK ("efootball_id" IS NULL OR "efootball_id" ~ '^[A-Za-z0-9_.-]{3,32}$');
CREATE UNIQUE INDEX "player_profiles_platform_efootball_id_key"
  ON "player_profiles"("platform", lower("efootball_id"))
  WHERE "efootball_id" IS NOT NULL;

-- No máximo um pedido de transferência em aberto por jogador.
CREATE UNIQUE INDEX "club_transfers_one_open_per_player"
  ON "club_transfers"("player_id")
  WHERE "status" IN ('PENDING_CLUB', 'PENDING_ADMIN');

ALTER TABLE "club_transfers"
  ADD CONSTRAINT "club_transfers_distinct_clubs_check"
    CHECK ("from_club_id" IS NULL OR "from_club_id" <> "to_club_id"),
  -- Pedido decidido pela federação tem autor e data; pedido em aberto não tem.
  ADD CONSTRAINT "club_transfers_decision_check"
    CHECK (("status" IN ('PENDING_CLUB', 'PENDING_ADMIN')) = ("decided_at" IS NULL));
