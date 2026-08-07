-- Migration to update existing 'fr' language tags to standard BCP 47 'fr-FR'
UPDATE dubbing_projects SET language = 'fr-FR' WHERE language = 'fr';
