-- CreateEnum
CREATE TYPE "StatutOrganisation" AS ENUM ('ESSAI', 'ACTIF', 'SUSPENDU');

-- CreateEnum
CREATE TYPE "RoleUtilisateur" AS ENUM ('RESPONSABLE', 'GESTIONNAIRE', 'ADMINISTRATEUR');

-- CreateEnum
CREATE TYPE "StatutQuestionnaire" AS ENUM ('BROUILLON', 'ACTIF', 'INACTIF');

-- CreateEnum
CREATE TYPE "TypeQuestion" AS ENUM ('ETOILES', 'EMOJIS', 'NPS', 'CHOIX_UNIQUE', 'CHOIX_MULTIPLE', 'OUI_NON', 'ECHELLE', 'TEXTE_LIBRE');

-- CreateEnum
CREATE TYPE "StatutTraitement" AS ENUM ('NOUVEAU', 'EN_COURS', 'TRAITE', 'IGNORE');

-- CreateEnum
CREATE TYPE "TypeSuivi" AS ENUM ('CHANGEMENT_STATUT', 'NOTE');

-- CreateEnum
CREATE TYPE "NiveauAlerte" AS ENUM ('NORMAL', 'PRIORITAIRE');

-- CreateEnum
CREATE TYPE "MotifAlerte" AS ENUM ('NOTE_BASSE', 'NPS_BAS', 'RAPPEL_DEMANDE');

-- CreateTable
CREATE TABLE "secteur" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "nom_fr" TEXT NOT NULL,
    "nom_en" TEXT NOT NULL,
    "vocabulaire" JSONB NOT NULL DEFAULT '{}',
    "indicateurs_suggeres" JSONB NOT NULL DEFAULT '[]',
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "secteur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "theme" (
    "id" UUID NOT NULL,
    "secteur_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "libelle_fr" TEXT NOT NULL,
    "libelle_en" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "theme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organisation" (
    "id" UUID NOT NULL,
    "secteur_id" UUID NOT NULL,
    "nom" TEXT NOT NULL,
    "logo_url" TEXT,
    "couleur_principale" TEXT,
    "pays" TEXT NOT NULL DEFAULT 'TG',
    "langue_defaut" TEXT NOT NULL DEFAULT 'fr',
    "fuseau_horaire" TEXT NOT NULL DEFAULT 'Africa/Lome',
    "statut" "StatutOrganisation" NOT NULL DEFAULT 'ESSAI',
    "seuil_alerte_note" INTEGER NOT NULL DEFAULT 2,
    "seuil_alerte_nps" INTEGER NOT NULL DEFAULT 6,
    "periode_anti_doublon_heures" INTEGER NOT NULL DEFAULT 6,
    "duree_conservation_mois" INTEGER NOT NULL DEFAULT 24,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMP(3) NOT NULL,
    "supprime_le" TIMESTAMP(3),

    CONSTRAINT "organisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site" (
    "id" UUID NOT NULL,
    "organisation_id" UUID NOT NULL,
    "nom" TEXT NOT NULL,
    "adresse" TEXT,
    "ville" TEXT,
    "telephone" TEXT,
    "horaires" JSONB,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMP(3) NOT NULL,
    "supprime_le" TIMESTAMP(3),

    CONSTRAINT "site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "point_contact" (
    "id" UUID NOT NULL,
    "organisation_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "questionnaire_id" UUID,
    "nom" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'table',
    "zone" TEXT,
    "code_public" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "revoque_le" TIMESTAMP(3),
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMP(3) NOT NULL,
    "supprime_le" TIMESTAMP(3),

    CONSTRAINT "point_contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "utilisateur" (
    "id" UUID NOT NULL,
    "organisation_id" UUID,
    "email" TEXT NOT NULL,
    "mot_de_passe_hash" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "role" "RoleUtilisateur" NOT NULL,
    "langue" TEXT NOT NULL DEFAULT 'fr',
    "alertes_groupees" BOOLEAN NOT NULL DEFAULT false,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "tentatives_echec" INTEGER NOT NULL DEFAULT 0,
    "verrouille_jusqua" TIMESTAMP(3),
    "derniere_connexion" TIMESTAMP(3),
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMP(3) NOT NULL,
    "supprime_le" TIMESTAMP(3),

    CONSTRAINT "utilisateur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "utilisateur_site" (
    "utilisateur_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,

    CONSTRAINT "utilisateur_site_pkey" PRIMARY KEY ("utilisateur_id","site_id")
);

-- CreateTable
CREATE TABLE "questionnaire" (
    "id" UUID NOT NULL,
    "organisation_id" UUID,
    "secteur_id" UUID,
    "est_modele" BOOLEAN NOT NULL DEFAULT false,
    "titre" JSONB NOT NULL,
    "message_accueil" JSONB,
    "message_remerciement" JSONB,
    "langue_defaut" TEXT NOT NULL DEFAULT 'fr',
    "statut" "StatutQuestionnaire" NOT NULL DEFAULT 'BROUILLON',
    "date_debut" TIMESTAMP(3),
    "date_fin" TIMESTAMP(3),
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMP(3) NOT NULL,
    "supprime_le" TIMESTAMP(3),

    CONSTRAINT "questionnaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questionnaire_version" (
    "id" UUID NOT NULL,
    "questionnaire_id" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "publie_le" TIMESTAMP(3),
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "questionnaire_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question" (
    "id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "theme_id" UUID,
    "ordre" INTEGER NOT NULL,
    "type" "TypeQuestion" NOT NULL,
    "libelle" JSONB NOT NULL,
    "aide" JSONB,
    "obligatoire" BOOLEAN NOT NULL DEFAULT true,
    "options" JSONB,
    "echelle_min" INTEGER,
    "echelle_max" INTEGER,
    "libelles_extremites" JSONB,
    "condition" JSONB,

    CONSTRAINT "question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan" (
    "id" UUID NOT NULL,
    "organisation_id" UUID NOT NULL,
    "point_contact_id" UUID NOT NULL,
    "empreinte" TEXT,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avis" (
    "id" UUID NOT NULL,
    "organisation_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "point_contact_id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "soumis_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "langue" TEXT NOT NULL DEFAULT 'fr',
    "appareil" TEXT,
    "note_globale" DOUBLE PRECISION,
    "nps" INTEGER,
    "commentaire" TEXT,
    "contact_nom" TEXT,
    "contact_tel" TEXT,
    "contact_email" TEXT,
    "consentement" BOOLEAN NOT NULL DEFAULT false,
    "rappel_demande" BOOLEAN NOT NULL DEFAULT false,
    "statut_traitement" "StatutTraitement" NOT NULL DEFAULT 'NOUVEAU',
    "empreinte" TEXT,
    "produit_ou_lot" TEXT,
    "cle_idempotence" TEXT,
    "supprime_le" TIMESTAMP(3),

    CONSTRAINT "avis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reponse" (
    "id" UUID NOT NULL,
    "organisation_id" UUID NOT NULL,
    "avis_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "valeur_numerique" DOUBLE PRECISION,
    "valeur_texte" TEXT,
    "valeur_choix" JSONB,

    CONSTRAINT "reponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avis_suivi" (
    "id" UUID NOT NULL,
    "organisation_id" UUID NOT NULL,
    "avis_id" UUID NOT NULL,
    "utilisateur_id" UUID NOT NULL,
    "type" "TypeSuivi" NOT NULL,
    "ancien_statut" "StatutTraitement",
    "nouveau_statut" "StatutTraitement",
    "commentaire" TEXT,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "avis_suivi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerte" (
    "id" UUID NOT NULL,
    "organisation_id" UUID NOT NULL,
    "avis_id" UUID NOT NULL,
    "niveau" "NiveauAlerte" NOT NULL DEFAULT 'NORMAL',
    "motifs" "MotifAlerte"[],
    "assigne_a_id" UUID,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" UUID NOT NULL,
    "organisation_id" UUID NOT NULL,
    "utilisateur_id" UUID NOT NULL,
    "avis_id" UUID,
    "type" TEXT NOT NULL DEFAULT 'ALERTE_AVIS',
    "titre" TEXT NOT NULL,
    "message" TEXT,
    "lue_le" TIMESTAMP(3),
    "email_envoye_le" TIMESTAMP(3),
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" UUID NOT NULL,
    "utilisateur_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "se_souvenir" BOOLEAN NOT NULL DEFAULT false,
    "derniere_activite_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expire_le" TIMESTAMP(3) NOT NULL,
    "user_agent" TEXT,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jeton_reinitialisation_mdp" (
    "id" UUID NOT NULL,
    "utilisateur_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expire_le" TIMESTAMP(3) NOT NULL,
    "utilise_le" TIMESTAMP(3),
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jeton_reinitialisation_mdp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jeton_invitation" (
    "id" UUID NOT NULL,
    "organisation_id" UUID NOT NULL,
    "invite_par_id" UUID,
    "email" TEXT NOT NULL,
    "role" "RoleUtilisateur" NOT NULL,
    "site_ids" JSONB NOT NULL DEFAULT '[]',
    "token_hash" TEXT NOT NULL,
    "expire_le" TIMESTAMP(3) NOT NULL,
    "utilise_le" TIMESTAMP(3),
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jeton_invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "utilisateur_id" UUID,
    "organisation_id" UUID,
    "action" TEXT NOT NULL,
    "entite" TEXT,
    "entite_id" TEXT,
    "details" JSONB,
    "ip" TEXT,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acces_support" (
    "id" UUID NOT NULL,
    "organisation_id" UUID NOT NULL,
    "accorde_par_id" UUID NOT NULL,
    "expire_le" TIMESTAMP(3) NOT NULL,
    "revoque_le" TIMESTAMP(3),
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "acces_support_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agregat_quotidien" (
    "id" UUID NOT NULL,
    "organisation_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "point_contact_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "nb_avis" INTEGER NOT NULL DEFAULT 0,
    "nb_avis_notes" INTEGER NOT NULL DEFAULT 0,
    "somme_notes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "nb_satisfaits" INTEGER NOT NULL DEFAULT 0,
    "nb_nps" INTEGER NOT NULL DEFAULT 0,
    "nb_promoteurs" INTEGER NOT NULL DEFAULT 0,
    "nb_detracteurs" INTEGER NOT NULL DEFAULT 0,
    "nb_scans" INTEGER NOT NULL DEFAULT 0,
    "repartition_notes" JSONB NOT NULL DEFAULT '{}',
    "scores_themes" JSONB NOT NULL DEFAULT '{}',
    "modifie_le" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agregat_quotidien_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "secteur_code_key" ON "secteur"("code");

-- CreateIndex
CREATE UNIQUE INDEX "theme_secteur_id_code_key" ON "theme"("secteur_id", "code");

-- CreateIndex
CREATE INDEX "organisation_secteur_id_idx" ON "organisation"("secteur_id");

-- CreateIndex
CREATE INDEX "site_organisation_id_idx" ON "site"("organisation_id");

-- CreateIndex
CREATE UNIQUE INDEX "point_contact_code_public_key" ON "point_contact"("code_public");

-- CreateIndex
CREATE INDEX "point_contact_organisation_id_idx" ON "point_contact"("organisation_id");

-- CreateIndex
CREATE INDEX "point_contact_site_id_idx" ON "point_contact"("site_id");

-- CreateIndex
CREATE INDEX "point_contact_questionnaire_id_idx" ON "point_contact"("questionnaire_id");

-- CreateIndex
CREATE UNIQUE INDEX "utilisateur_email_key" ON "utilisateur"("email");

-- CreateIndex
CREATE INDEX "utilisateur_organisation_id_idx" ON "utilisateur"("organisation_id");

-- CreateIndex
CREATE INDEX "utilisateur_site_site_id_idx" ON "utilisateur_site"("site_id");

-- CreateIndex
CREATE INDEX "questionnaire_organisation_id_idx" ON "questionnaire"("organisation_id");

-- CreateIndex
CREATE INDEX "questionnaire_secteur_id_idx" ON "questionnaire"("secteur_id");

-- CreateIndex
CREATE UNIQUE INDEX "questionnaire_version_questionnaire_id_numero_key" ON "questionnaire_version"("questionnaire_id", "numero");

-- CreateIndex
CREATE INDEX "question_version_id_ordre_idx" ON "question"("version_id", "ordre");

-- CreateIndex
CREATE INDEX "question_theme_id_idx" ON "question"("theme_id");

-- CreateIndex
CREATE INDEX "scan_point_contact_id_cree_le_idx" ON "scan"("point_contact_id", "cree_le");

-- CreateIndex
CREATE INDEX "scan_organisation_id_cree_le_idx" ON "scan"("organisation_id", "cree_le");

-- CreateIndex
CREATE UNIQUE INDEX "avis_cle_idempotence_key" ON "avis"("cle_idempotence");

-- CreateIndex
CREATE INDEX "avis_organisation_id_soumis_le_idx" ON "avis"("organisation_id", "soumis_le");

-- CreateIndex
CREATE INDEX "avis_point_contact_id_soumis_le_idx" ON "avis"("point_contact_id", "soumis_le");

-- CreateIndex
CREATE INDEX "avis_site_id_soumis_le_idx" ON "avis"("site_id", "soumis_le");

-- CreateIndex
CREATE INDEX "avis_organisation_id_statut_traitement_idx" ON "avis"("organisation_id", "statut_traitement");

-- CreateIndex
CREATE INDEX "avis_point_contact_id_empreinte_soumis_le_idx" ON "avis"("point_contact_id", "empreinte", "soumis_le");

-- CreateIndex
CREATE INDEX "reponse_organisation_id_question_id_idx" ON "reponse"("organisation_id", "question_id");

-- CreateIndex
CREATE INDEX "reponse_question_id_idx" ON "reponse"("question_id");

-- CreateIndex
CREATE UNIQUE INDEX "reponse_avis_id_question_id_key" ON "reponse"("avis_id", "question_id");

-- CreateIndex
CREATE INDEX "avis_suivi_avis_id_cree_le_idx" ON "avis_suivi"("avis_id", "cree_le");

-- CreateIndex
CREATE INDEX "avis_suivi_organisation_id_idx" ON "avis_suivi"("organisation_id");

-- CreateIndex
CREATE UNIQUE INDEX "alerte_avis_id_key" ON "alerte"("avis_id");

-- CreateIndex
CREATE INDEX "alerte_organisation_id_cree_le_idx" ON "alerte"("organisation_id", "cree_le");

-- CreateIndex
CREATE INDEX "alerte_assigne_a_id_idx" ON "alerte"("assigne_a_id");

-- CreateIndex
CREATE INDEX "notification_utilisateur_id_lue_le_idx" ON "notification"("utilisateur_id", "lue_le");

-- CreateIndex
CREATE INDEX "notification_organisation_id_idx" ON "notification"("organisation_id");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_hash_key" ON "session"("token_hash");

-- CreateIndex
CREATE INDEX "session_utilisateur_id_idx" ON "session"("utilisateur_id");

-- CreateIndex
CREATE INDEX "session_expire_le_idx" ON "session"("expire_le");

-- CreateIndex
CREATE UNIQUE INDEX "jeton_reinitialisation_mdp_token_hash_key" ON "jeton_reinitialisation_mdp"("token_hash");

-- CreateIndex
CREATE INDEX "jeton_reinitialisation_mdp_utilisateur_id_idx" ON "jeton_reinitialisation_mdp"("utilisateur_id");

-- CreateIndex
CREATE UNIQUE INDEX "jeton_invitation_token_hash_key" ON "jeton_invitation"("token_hash");

-- CreateIndex
CREATE INDEX "jeton_invitation_organisation_id_idx" ON "jeton_invitation"("organisation_id");

-- CreateIndex
CREATE INDEX "jeton_invitation_email_idx" ON "jeton_invitation"("email");

-- CreateIndex
CREATE INDEX "audit_log_organisation_id_cree_le_idx" ON "audit_log"("organisation_id", "cree_le");

-- CreateIndex
CREATE INDEX "audit_log_utilisateur_id_cree_le_idx" ON "audit_log"("utilisateur_id", "cree_le");

-- CreateIndex
CREATE INDEX "audit_log_action_cree_le_idx" ON "audit_log"("action", "cree_le");

-- CreateIndex
CREATE INDEX "acces_support_organisation_id_expire_le_idx" ON "acces_support"("organisation_id", "expire_le");

-- CreateIndex
CREATE INDEX "agregat_quotidien_organisation_id_date_idx" ON "agregat_quotidien"("organisation_id", "date");

-- CreateIndex
CREATE INDEX "agregat_quotidien_site_id_date_idx" ON "agregat_quotidien"("site_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "agregat_quotidien_point_contact_id_date_key" ON "agregat_quotidien"("point_contact_id", "date");

-- AddForeignKey
ALTER TABLE "theme" ADD CONSTRAINT "theme_secteur_id_fkey" FOREIGN KEY ("secteur_id") REFERENCES "secteur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organisation" ADD CONSTRAINT "organisation_secteur_id_fkey" FOREIGN KEY ("secteur_id") REFERENCES "secteur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site" ADD CONSTRAINT "site_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_contact" ADD CONSTRAINT "point_contact_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_contact" ADD CONSTRAINT "point_contact_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_contact" ADD CONSTRAINT "point_contact_questionnaire_id_fkey" FOREIGN KEY ("questionnaire_id") REFERENCES "questionnaire"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "utilisateur" ADD CONSTRAINT "utilisateur_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "utilisateur_site" ADD CONSTRAINT "utilisateur_site_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "utilisateur_site" ADD CONSTRAINT "utilisateur_site_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questionnaire" ADD CONSTRAINT "questionnaire_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questionnaire" ADD CONSTRAINT "questionnaire_secteur_id_fkey" FOREIGN KEY ("secteur_id") REFERENCES "secteur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questionnaire_version" ADD CONSTRAINT "questionnaire_version_questionnaire_id_fkey" FOREIGN KEY ("questionnaire_id") REFERENCES "questionnaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question" ADD CONSTRAINT "question_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "questionnaire_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question" ADD CONSTRAINT "question_theme_id_fkey" FOREIGN KEY ("theme_id") REFERENCES "theme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan" ADD CONSTRAINT "scan_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan" ADD CONSTRAINT "scan_point_contact_id_fkey" FOREIGN KEY ("point_contact_id") REFERENCES "point_contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avis" ADD CONSTRAINT "avis_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avis" ADD CONSTRAINT "avis_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avis" ADD CONSTRAINT "avis_point_contact_id_fkey" FOREIGN KEY ("point_contact_id") REFERENCES "point_contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avis" ADD CONSTRAINT "avis_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "questionnaire_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reponse" ADD CONSTRAINT "reponse_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reponse" ADD CONSTRAINT "reponse_avis_id_fkey" FOREIGN KEY ("avis_id") REFERENCES "avis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reponse" ADD CONSTRAINT "reponse_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avis_suivi" ADD CONSTRAINT "avis_suivi_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avis_suivi" ADD CONSTRAINT "avis_suivi_avis_id_fkey" FOREIGN KEY ("avis_id") REFERENCES "avis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avis_suivi" ADD CONSTRAINT "avis_suivi_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerte" ADD CONSTRAINT "alerte_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerte" ADD CONSTRAINT "alerte_avis_id_fkey" FOREIGN KEY ("avis_id") REFERENCES "avis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerte" ADD CONSTRAINT "alerte_assigne_a_id_fkey" FOREIGN KEY ("assigne_a_id") REFERENCES "utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_avis_id_fkey" FOREIGN KEY ("avis_id") REFERENCES "avis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jeton_reinitialisation_mdp" ADD CONSTRAINT "jeton_reinitialisation_mdp_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jeton_invitation" ADD CONSTRAINT "jeton_invitation_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jeton_invitation" ADD CONSTRAINT "jeton_invitation_invite_par_id_fkey" FOREIGN KEY ("invite_par_id") REFERENCES "utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acces_support" ADD CONSTRAINT "acces_support_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acces_support" ADD CONSTRAINT "acces_support_accorde_par_id_fkey" FOREIGN KEY ("accorde_par_id") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agregat_quotidien" ADD CONSTRAINT "agregat_quotidien_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agregat_quotidien" ADD CONSTRAINT "agregat_quotidien_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agregat_quotidien" ADD CONSTRAINT "agregat_quotidien_point_contact_id_fkey" FOREIGN KEY ("point_contact_id") REFERENCES "point_contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
