-- Modelo de leitura do portal: jogadores, clubes, temporadas, competições, partidas, notícias e banners.
-- Escrita à mão (ver ADR 0007): segue as convenções de nomes do Prisma.

-- CreateEnum
CREATE TYPE "game_platform" AS ENUM ('PLAYSTATION', 'XBOX', 'PC', 'MOBILE');

-- CreateEnum
CREATE TYPE "competition_format" AS ENUM ('LEAGUE', 'GROUPS', 'KNOCKOUT');

-- CreateEnum
CREATE TYPE "competition_status" AS ENUM ('DRAFT', 'REGISTRATION_OPEN', 'IN_PROGRESS', 'FINISHED');

-- CreateEnum
CREATE TYPE "match_status" AS ENUM ('SCHEDULED', 'AVAILABLE', 'AWAITING_RESULT', 'AWAITING_CONFIRMATION', 'UNDER_REVIEW', 'HOMOLOGATED', 'POSTPONED', 'CANCELED', 'WALKOVER');

-- CreateEnum
CREATE TYPE "news_status" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED');

-- CreateTable
CREATE TABLE "player_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "nickname" VARCHAR(24) NOT NULL,
    "slug" VARCHAR(24) NOT NULL,
    "country" CHAR(2) NOT NULL,
    "platform" "game_platform" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "player_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clubs" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(60) NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "tag" VARCHAR(4) NOT NULL,
    "primary_color" CHAR(7) NOT NULL,
    "secondary_color" CHAR(7) NOT NULL,
    "founded_on" DATE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clubs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "club_memberships" (
    "id" UUID NOT NULL,
    "club_id" UUID NOT NULL,
    "player_id" UUID NOT NULL,
    "started_on" DATE NOT NULL,
    "ended_on" DATE,

    CONSTRAINT "club_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seasons" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(40) NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "year" INTEGER NOT NULL,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE NOT NULL,
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competitions" (
    "id" UUID NOT NULL,
    "season_id" UUID NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "format" "competition_format" NOT NULL,
    "status" "competition_status" NOT NULL DEFAULT 'DRAFT',
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "max_participants" INTEGER NOT NULL,
    "rounds_total" INTEGER,
    "description" VARCHAR(400),
    "registration_closes_on" DATE,
    "starts_on" DATE,
    "ends_on" DATE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competition_entries" (
    "id" UUID NOT NULL,
    "competition_id" UUID NOT NULL,
    "player_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competition_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rounds" (
    "id" UUID NOT NULL,
    "competition_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "name" VARCHAR(60),
    "starts_on" DATE NOT NULL,
    "ends_on" DATE NOT NULL,

    CONSTRAINT "rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" UUID NOT NULL,
    "competition_id" UUID NOT NULL,
    "round_id" UUID NOT NULL,
    "home_player_id" UUID NOT NULL,
    "away_player_id" UUID NOT NULL,
    "scheduled_at" TIMESTAMPTZ(3) NOT NULL,
    "status" "match_status" NOT NULL DEFAULT 'SCHEDULED',
    "home_score" INTEGER,
    "away_score" INTEGER,
    "homologated_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "title" VARCHAR(140) NOT NULL,
    "summary" VARCHAR(300) NOT NULL,
    "body" TEXT NOT NULL,
    "category" VARCHAR(40) NOT NULL,
    "image_url" VARCHAR(500),
    "status" "news_status" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMPTZ(3),
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "author_user_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "news_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banners" (
    "id" UUID NOT NULL,
    "eyebrow" VARCHAR(60),
    "title" VARCHAR(120) NOT NULL,
    "subtitle" VARCHAR(200),
    "image_url" VARCHAR(500),
    "cta_label" VARCHAR(40),
    "cta_href" VARCHAR(200),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "starts_at" TIMESTAMPTZ(3),
    "ends_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "banners_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "player_profiles_user_id_key" ON "player_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "player_profiles_slug_key" ON "player_profiles"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "clubs_slug_key" ON "clubs"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "clubs_tag_key" ON "clubs"("tag");

-- CreateIndex
CREATE INDEX "club_memberships_club_id_idx" ON "club_memberships"("club_id");

-- CreateIndex
CREATE INDEX "club_memberships_player_id_idx" ON "club_memberships"("player_id");

-- CreateIndex
CREATE UNIQUE INDEX "seasons_slug_key" ON "seasons"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "competitions_slug_key" ON "competitions"("slug");

-- CreateIndex
CREATE INDEX "competitions_status_idx" ON "competitions"("status");

-- CreateIndex
CREATE INDEX "competitions_season_id_idx" ON "competitions"("season_id");

-- CreateIndex
CREATE INDEX "competition_entries_player_id_idx" ON "competition_entries"("player_id");

-- CreateIndex
CREATE UNIQUE INDEX "competition_entries_competition_id_player_id_key" ON "competition_entries"("competition_id", "player_id");

-- CreateIndex
CREATE UNIQUE INDEX "rounds_competition_id_number_key" ON "rounds"("competition_id", "number");

-- CreateIndex
CREATE INDEX "matches_competition_id_status_idx" ON "matches"("competition_id", "status");

-- CreateIndex
CREATE INDEX "matches_status_scheduled_at_idx" ON "matches"("status", "scheduled_at");

-- CreateIndex
CREATE INDEX "matches_homologated_at_idx" ON "matches"("homologated_at");

-- CreateIndex
CREATE INDEX "matches_round_id_idx" ON "matches"("round_id");

-- CreateIndex
CREATE INDEX "matches_home_player_id_idx" ON "matches"("home_player_id");

-- CreateIndex
CREATE INDEX "matches_away_player_id_idx" ON "matches"("away_player_id");

-- CreateIndex
CREATE UNIQUE INDEX "news_slug_key" ON "news"("slug");

-- CreateIndex
CREATE INDEX "news_status_published_at_idx" ON "news"("status", "published_at");

-- CreateIndex
CREATE INDEX "banners_is_active_created_at_idx" ON "banners"("is_active", "created_at");

-- AddForeignKey
ALTER TABLE "player_profiles" ADD CONSTRAINT "player_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_memberships" ADD CONSTRAINT "club_memberships_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_memberships" ADD CONSTRAINT "club_memberships_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_entries" ADD CONSTRAINT "competition_entries_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_entries" ADD CONSTRAINT "competition_entries_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "rounds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_home_player_id_fkey" FOREIGN KEY ("home_player_id") REFERENCES "player_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_away_player_id_fkey" FOREIGN KEY ("away_player_id") REFERENCES "player_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news" ADD CONSTRAINT "news_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Restrições que o Prisma não expressa
-- ---------------------------------------------------------------------------

ALTER TABLE "player_profiles"
  ADD CONSTRAINT "player_profiles_slug_format_check" CHECK ("slug" ~ '^[a-z0-9_]{3,24}$'),
  ADD CONSTRAINT "player_profiles_country_format_check" CHECK ("country" ~ '^[A-Z]{2}$');

ALTER TABLE "clubs"
  ADD CONSTRAINT "clubs_tag_format_check" CHECK ("tag" ~ '^[A-Z0-9]{2,4}$'),
  ADD CONSTRAINT "clubs_colors_format_check"
    CHECK ("primary_color" ~ '^#[0-9A-Fa-f]{6}$' AND "secondary_color" ~ '^#[0-9A-Fa-f]{6}$');

ALTER TABLE "club_memberships"
  ADD CONSTRAINT "club_memberships_period_check" CHECK ("ended_on" IS NULL OR "ended_on" >= "started_on");

-- Um jogador tem no máximo um vínculo ativo.
CREATE UNIQUE INDEX "club_memberships_one_active_per_player"
  ON "club_memberships"("player_id") WHERE "ended_on" IS NULL;

ALTER TABLE "seasons"
  ADD CONSTRAINT "seasons_period_check" CHECK ("ends_on" >= "starts_on");

-- No máximo uma temporada corrente e uma competição em destaque.
CREATE UNIQUE INDEX "seasons_one_current" ON "seasons"("is_current") WHERE "is_current";
CREATE UNIQUE INDEX "competitions_one_featured" ON "competitions"("is_featured") WHERE "is_featured";

ALTER TABLE "competitions"
  ADD CONSTRAINT "competitions_participants_check" CHECK ("max_participants" >= 2),
  ADD CONSTRAINT "competitions_rounds_check" CHECK ("rounds_total" IS NULL OR "rounds_total" >= 1);

ALTER TABLE "rounds"
  ADD CONSTRAINT "rounds_number_check" CHECK ("number" >= 1),
  ADD CONSTRAINT "rounds_period_check" CHECK ("ends_on" >= "starts_on");

ALTER TABLE "matches"
  ADD CONSTRAINT "matches_distinct_players_check" CHECK ("home_player_id" <> "away_player_id"),
  ADD CONSTRAINT "matches_score_pair_check"
    CHECK (("home_score" IS NULL) = ("away_score" IS NULL)),
  ADD CONSTRAINT "matches_score_range_check"
    CHECK ("home_score" IS NULL OR ("home_score" BETWEEN 0 AND 99 AND "away_score" BETWEEN 0 AND 99)),
  -- Resultado oficial exige placar e data de homologação.
  ADD CONSTRAINT "matches_official_result_check"
    CHECK ("status" NOT IN ('HOMOLOGATED', 'WALKOVER')
           OR ("home_score" IS NOT NULL AND "homologated_at" IS NOT NULL));

ALTER TABLE "news"
  ADD CONSTRAINT "news_published_at_check" CHECK ("status" = 'DRAFT' OR "published_at" IS NOT NULL);

ALTER TABLE "banners"
  ADD CONSTRAINT "banners_window_check" CHECK ("starts_at" IS NULL OR "ends_at" IS NULL OR "ends_at" > "starts_at");
