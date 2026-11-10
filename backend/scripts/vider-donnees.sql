-- Vider les donnees de travail de la base (a lancer a la main).
--
-- SUPPRIME : avis, reponses, suivis, alertes, notifications, agregats, scans, sites,
--   points de contact (tables), questionnaires de l'organisation (avec leurs versions et
--   leurs questions), invitations, jetons de reinitialisation, acces support, journal d'audit.
-- CONSERVE : utilisateurs, organisations, sessions, secteurs, themes et modeles de
--   questionnaires (avec leurs versions et leurs questions).
--
-- Tout se passe dans UNE transaction : si une ligne echoue, rien n'est supprime.

\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP VIEW comptes AS
SELECT 1 AS n, 'supprime' AS groupe, 'reponse' AS nom_table, (SELECT count(*) FROM reponse) AS lignes
UNION ALL SELECT 2, 'supprime', 'avis_suivi', (SELECT count(*) FROM avis_suivi)
UNION ALL SELECT 3, 'supprime', 'alerte', (SELECT count(*) FROM alerte)
UNION ALL SELECT 4, 'supprime', 'notification', (SELECT count(*) FROM notification)
UNION ALL SELECT 5, 'supprime', 'agregat_quotidien', (SELECT count(*) FROM agregat_quotidien)
UNION ALL SELECT 6, 'supprime', 'scan', (SELECT count(*) FROM scan)
UNION ALL SELECT 7, 'supprime', 'avis', (SELECT count(*) FROM avis)
UNION ALL SELECT 8, 'supprime', 'utilisateur_site', (SELECT count(*) FROM utilisateur_site)
UNION ALL SELECT 9, 'supprime', 'point_contact', (SELECT count(*) FROM point_contact)
UNION ALL SELECT 10, 'supprime', 'site', (SELECT count(*) FROM site)
UNION ALL SELECT 11, 'supprime', 'question (organisation)', (SELECT count(*) FROM question q JOIN questionnaire_version v ON v.id = q.version_id JOIN questionnaire z ON z.id = v.questionnaire_id WHERE z.est_modele = false)
UNION ALL SELECT 12, 'supprime', 'questionnaire_version (organisation)', (SELECT count(*) FROM questionnaire_version v JOIN questionnaire z ON z.id = v.questionnaire_id WHERE z.est_modele = false)
UNION ALL SELECT 13, 'supprime', 'questionnaire (organisation)', (SELECT count(*) FROM questionnaire WHERE est_modele = false)
UNION ALL SELECT 14, 'supprime', 'jeton_invitation', (SELECT count(*) FROM jeton_invitation)
UNION ALL SELECT 15, 'supprime', 'jeton_reinitialisation_mdp', (SELECT count(*) FROM jeton_reinitialisation_mdp)
UNION ALL SELECT 16, 'supprime', 'acces_support', (SELECT count(*) FROM acces_support)
UNION ALL SELECT 17, 'supprime', 'audit_log', (SELECT count(*) FROM audit_log)
UNION ALL SELECT 18, 'conserve', 'utilisateur', (SELECT count(*) FROM utilisateur)
UNION ALL SELECT 19, 'conserve', 'organisation', (SELECT count(*) FROM organisation)
UNION ALL SELECT 20, 'conserve', 'session', (SELECT count(*) FROM session)
UNION ALL SELECT 21, 'conserve', 'secteur', (SELECT count(*) FROM secteur)
UNION ALL SELECT 22, 'conserve', 'theme', (SELECT count(*) FROM theme)
UNION ALL SELECT 23, 'conserve', 'questionnaire (modeles)', (SELECT count(*) FROM questionnaire WHERE est_modele = true)
UNION ALL SELECT 24, 'conserve', 'questionnaire_version (modeles)', (SELECT count(*) FROM questionnaire_version v JOIN questionnaire z ON z.id = v.questionnaire_id WHERE z.est_modele = true)
UNION ALL SELECT 25, 'conserve', 'question (modeles)', (SELECT count(*) FROM question q JOIN questionnaire_version v ON v.id = q.version_id JOIN questionnaire z ON z.id = v.questionnaire_id WHERE z.est_modele = true);

\echo
\echo === AVANT ===
SELECT groupe, nom_table, lignes FROM comptes ORDER BY n;

-- Du plus dependant au moins dependant (chaque table est videe avant celles qu'elle reference).
DELETE FROM reponse;
DELETE FROM avis_suivi;
DELETE FROM alerte;
DELETE FROM notification;
DELETE FROM agregat_quotidien;
DELETE FROM scan;
DELETE FROM avis;
DELETE FROM utilisateur_site;
DELETE FROM point_contact;
DELETE FROM site;
DELETE FROM question WHERE version_id IN (
  SELECT v.id FROM questionnaire_version v
  JOIN questionnaire z ON z.id = v.questionnaire_id
  WHERE z.est_modele = false);
DELETE FROM questionnaire_version WHERE questionnaire_id IN (
  SELECT id FROM questionnaire WHERE est_modele = false);
DELETE FROM questionnaire WHERE est_modele = false;
DELETE FROM jeton_invitation;
DELETE FROM jeton_reinitialisation_mdp;
DELETE FROM acces_support;
DELETE FROM audit_log;

\echo
\echo === APRES ===
SELECT groupe, nom_table, lignes FROM comptes ORDER BY n;

COMMIT;
\echo
\echo Termine : les donnees de travail sont supprimees.