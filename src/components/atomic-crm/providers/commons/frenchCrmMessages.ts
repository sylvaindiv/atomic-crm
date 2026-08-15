import type { CrmMessages } from "./englishCrmMessages";

export const frenchCrmMessages = {
  resources: {
    companies: {
      name: "Club |||| Clubs",
      forcedCaseName: "Club",
      fields: {
        name: "Nom du club",
        website: "Site web",
        linkedin_url: "LinkedIn",
        phone_number: "Numéro de téléphone",
        created_at: "Date de création",
        nb_contacts: "Nombre de juges-arbitres",
        nb_deals: "Nombre d'affaires",
        revenue: "Chiffre d'affaires",
        sector: "Secteur",
        size: "Taille",
        tax_identifier: "Identifiant fiscal",
        address: "Adresse",
        city: "Ville",
        zipcode: "Code postal",
        state_abbr: "État",
        country: "Pays",
        description: "Description",
        context_links: "URLs de contexte",
        sales_id: "Responsable de compte",
        status: "Statut",
      },
      empty: {
        description: "Il semble que la liste de vos clubs soit vide.",
        title: "Aucun club trouvé",
      },
      field_categories: {
        contact: "Informations du club",
        additional_info: "Informations supplémentaires",
        address: "Adresse",
        context: "Contexte",
      },
      action: {
        create: "Créer un club",
        edit: "Modifier le club",
        new: "Nouveau club",
        show: "Afficher le club",
      },
      added_on: "Ajouté le %{date}",
      followed_by: "Suivi par %{name}",
      followed_by_you: "Suivi par vous",
      no_contacts: "Aucun juge-arbitre",
      nb_contacts:
        "%{smart_count} juge-arbitre |||| %{smart_count} juges-arbitres",
      nb_deals: "%{smart_count} affaire |||| %{smart_count} affaires",
      sizes: {
        one_employee: "1 employé",
        two_to_nine_employees: "2-9 employés",
        ten_to_forty_nine_employees: "10-49 employés",
        fifty_to_two_hundred_forty_nine_employees: "50-249 employés",
        two_hundred_fifty_or_more_employees: "250 employés ou plus",
      },
      autocomplete: {
        create_error: "Une erreur s'est produite lors de la création du club",
        create_item: "Créer %{item}",
        create_label: "Commencez à taper pour créer un nouveau club",
      },
      merge: {
        action: "Fusionner avec un autre club",
        confirm: "Fusionner les clubs",
        current_contact: "Club actuel (sera supprimé)",
        description: "Fusionnez ce club avec un autre.",
        error: "Échec de la fusion des clubs",
        merging: "Fusion...",
        no_additional_data: "Aucune donnée supplémentaire à fusionner",
        select_target: "Veuillez sélectionner un club avec lequel fusionner",
        success: "Clubs fusionnés avec succès",
        target_contact: "Club cible (sera conservé)",
        title: "Fusionner le club",
        warning_description:
          "Toutes les données seront transférées au deuxième club. Cette action ne peut pas être annulée.",
        warning_title: "Avertissement : opération destructrice",
        what_will_be_merged: "Ce qui sera fusionné :",
      },
      filters: {
        only_mine: "Seulement les clubs que je gère",
      },
    },
    contacts: {
      name: "Juge-arbitre |||| Juges-arbitres",
      forcedCaseName: "Juge-arbitre",
      field_categories: {
        background_info: "Informations complémentaires",
        identity: "Identité",
        misc: "Divers",
        personal_info: "Informations personnelles",
        position: "Poste",
        case_info: "Infos de l'affaire",
      },
      fields: {
        first_name: "Prénom",
        last_name: "Nom",
        last_seen: "Dernière activité",
        title: "Titre",
        company_id: "Club",
        referred_by_id: "Connu par",
        email_jsonb: "Adresses e-mail",
        email: "E-mail",
        phone_jsonb: "Numéros de téléphone",
        phone_number: "Numéro de téléphone",
        linkedin_url: "URL LinkedIn",
        background: "Informations de contexte",
        amount: "Budget",
        description: "Description de l'affaire",
        has_newsletter: "Abonné à la newsletter",
        sales_id: "Responsable de compte",
        gender: "Genre",
        status: "Statut",
        tags: "Étiquettes",
        nb_tasks: "Tâches",
        first_seen: "Première activité",
        latest_note_text: "Dernière note",
        name: "Nom",
        postal_code: "Code postal",
        city: "Ville",
      },
      action: {
        add: "Ajouter un juge-arbitre",
        add_first: "Ajoutez votre premier juge-arbitre",
        create: "Créer un juge-arbitre",
        edit: "Modifier le juge-arbitre",
        export_vcard: "Exporter en vCard",
        new: "Nouveau juge-arbitre",
        show: "Afficher le juge-arbitre",
      },
      background: {
        last_activity_on: "Dernière activité le %{date}",
        added_on: "Ajouté le %{date}",
        followed_by: "Suivi par %{name}",
        followed_by_you: "Suivi par vous",
        status_none: "Aucun",
      },
      position_at: "%{title} chez",
      position_at_company: "%{title} chez %{company}",
      empty: {
        description: "Il semble que votre liste de juges-arbitres soit vide.",
        title: "Aucun juge-arbitre trouvé",
      },
      import: {
        title: "Importer des juges-arbitres",
        button: "Importer un fichier CSV",
        complete:
          "Import des juges-arbitres terminé. %{importCount} juges-arbitres importés, %{errorCount} erreurs",
        progress:
          "%{importCount} / %{rowCount} juges-arbitres importés, avec %{errorCount} erreurs.",
        error:
          "Échec de l'importation de ce fichier. Veuillez vous assurer que vous avez fourni un fichier CSV valide.",
        imported: "Importé",
        remaining_time: "Temps restant estimé :",
        running: "L'import est en cours, merci de ne pas fermer cet onglet.",
        sample_download: "Télécharger un exemple CSV",
        sample_hint:
          "Voici un exemple de fichier CSV que vous pouvez utiliser comme modèle",
        stop: "Arrêter l'importation",
        csv_file: "Fichier CSV",
        contacts_label: "juge-arbitre |||| juges-arbitres",
      },
      inputs: {
        genders: {
          male: "Monsieur",
          female: "Madame",
          nonbinary: "Indéterminé",
        },
        personal_info_types: {
          work: "Pro",
          home: "Perso",
          other: "Autre",
        },
      },
      list: {
        error_loading: "Erreur lors du chargement des juges-arbitres",
      },
      bulk_tag: {
        action: "Étiqueter",
        back: "Retour aux étiquettes",
        create_description:
          "Créez une nouvelle étiquette et appliquez-la aux juges-arbitres sélectionnés.",
        description:
          "Choisissez une étiquette existante ou créez-en une pour les juges-arbitres sélectionnés.",
        empty:
          "Aucune étiquette pour le moment. Créez-en une pour étiqueter les juges-arbitres sélectionnés.",
        error: "Impossible d'ajouter l'étiquette aux juges-arbitres",
        noop: "Les juges-arbitres sélectionnés ont déjà cette étiquette",
        success:
          "Étiquette ajoutée à %{smart_count} juge-arbitre |||| Étiquette ajoutée à %{smart_count} juges-arbitres",
        title: "Ajouter une étiquette aux juges-arbitres",
      },
      merge: {
        action: "Fusionner avec un autre juge-arbitre",
        confirm: "Fusionner les juges-arbitres",
        current_contact: "Juge-arbitre actuel (sera supprimé)",
        description: "Fusionnez ce juge-arbitre avec un autre.",
        error: "Échec de la fusion des juges-arbitres",
        merging: "Fusion...",
        no_additional_data: "Aucune donnée supplémentaire à fusionner",
        select_target:
          "Veuillez sélectionner un juge-arbitre avec lequel fusionner",
        success: "Juges-arbitres fusionnés avec succès",
        target_contact: "Juge-arbitre cible (sera conservé)",
        title: "Fusionner les juges-arbitres",
        warning_description:
          "Toutes les données seront transférées au deuxième juge-arbitre. Cette action ne peut pas être annulée.",
        warning_title: "Avertissement : opération destructrice",
        what_will_be_merged: "Ce qui sera fusionné :",
      },
      filters: {
        before_last_month: "Avant le mois dernier",
        before_this_month: "Avant ce mois-ci",
        before_this_week: "Avant cette semaine",
        managed_by_me: "Géré par moi",
        search: "Rechercher nom, club...",
        this_week: "Cette semaine",
        today: "Aujourd'hui",
        tags: "Étiquettes",
        tasks: "Tâches",
      },
      hot: {
        empty_change_status:
          'Changez le statut d\'un juge-arbitre en ajoutant une note à ce juge-arbitre et en cliquant sur "afficher les options".',
        empty_hint:
          'Les juges-arbitres avec un statut "Visio" apparaîtront ici.',
        title: "Prospects chauds",
      },
    },
    deals: {
      name: "Affaire |||| Affaires",
      fields: {
        name: "Nom",
        description: "Description",
        company_id: "Club",
        // Singular: capped at one linked contact, for both case types. See
        // the same convention on notes.fields.contact_id / tasks.fields.contact_id.
        contact_ids: "Juge-arbitre",
        category: "Catégorie",
        amount: "Budget",
        stage: "Étape",
        case_type: "Type d'affaire",
        club_name: "Club",
      },
      case_types: {
        judge: "Juge",
        club: "Club",
      },
      action: {
        back_to_deal: "Retour à l'affaire",
        create: "Créer une affaire",
        new: "Nouvelle affaire",
      },
      field_categories: {
        misc: "Divers",
      },
      filters: {
        needs_action: "À traiter",
      },
      archived: {
        action: "Archiver",
        error: "Erreur : affaire non archivée",
        list_title: "Affaires archivées",
        success: "Affaire archivée",
        title: "Affaire archivée",
        view: "Afficher les affaires archivées",
      },
      inputs: {
        linked_to: "Lié à",
        next_action: "Prochaine action",
        next_action_text: "Prochaine étape",
      },
      next_action_save_error:
        "La prochaine action n'a pas pu être enregistrée. L'affaire n'a pas été enregistrée non plus.",
      next_action_due: {
        overdue: "En retard",
        today: "Aujourd'hui",
        tomorrow: "Demain",
        in_days: "%{smart_count}j",
      },
      unarchived: {
        action: "Renvoyer au tableau",
        error: "Erreur : affaire non désarchivée",
        success: "Affaire désarchivée",
      },
      updated: "Affaire mise à jour",
      empty: {
        before_create: "avant de créer une affaire.",
        description: "Il semble que votre liste d'affaires soit vide.",
        title: "Aucune affaire trouvée",
      },
    },
    notes: {
      name: "Note |||| Notes",
      forcedCaseName: "Note",
      fields: {
        status: "Statut",
        date: "Date",
        attachments: "Pièces jointes",
        contact_id: "Juge-arbitre",
        deal_id: "Affaire",
      },
      action: {
        add: "Ajouter une note",
        add_first: "Ajoutez votre première note",
        delete: "Supprimer la note",
        edit: "Modifier la note",
        update: "Mettre à jour la note",
        add_this: "Ajouter cette note",
      },
      sheet: {
        create: "Créer une note",
        create_for: "Créer une note pour %{name}",
        edit: "Modifier la note",
        edit_for: "Modifier la note pour %{name}",
      },
      deleted: "Note supprimée",
      empty: "Aucune note pour l'instant",
      author_added: "%{name} a ajouté une note",
      you_added: "Vous avez ajouté une note",
      me: "Moi",
      list: {
        error_loading: "Erreur lors du chargement des notes",
      },
      note_for_contact: "Note pour %{name}",
      stepper: {
        hint: "Accédez à une page de juge-arbitre et ajoutez une note",
      },
      added: "Note ajoutée",
      inputs: {
        add_note: "Ajouter une note",
        options_hint: "(joindre des fichiers ou modifier les détails)",
        show_options: "Afficher les options",
      },
      actions: {
        attach_document: "Joindre un document",
      },
      validation: {
        note_or_attachment_required: "Une note ou une pièce jointe est requise",
      },
    },
    sales: {
      name: "Utilisateur |||| Utilisateurs",
      fields: {
        first_name: "Prénom",
        last_name: "Nom",
        email: "E-mail",
        administrator: "Admin",
        disabled: "Désactivé",
      },
      create: {
        error:
          "Une erreur s'est produite lors de la création de l'utilisateur.",
        success:
          "Utilisateur créé. Ils recevront prochainement un email pour définir leur mot de passe.",
        title: "Créer un nouvel utilisateur",
      },
      edit: {
        error: "Une erreur s'est produite. Veuillez réessayer.",
        record_not_found: "Enregistrement introuvable",
        success: "Utilisateur mis à jour avec succès",
        title: "Modifier %{name}",
      },
      action: {
        new: "Nouvel utilisateur",
      },
    },
    tasks: {
      name: "Tâche |||| Tâches",
      forcedCaseName: "Tâche",
      fields: {
        text: "Description",
        due_date: "Date d'échéance",
        type: "Type",
        contact_id: "Juge-arbitre",
        due_short: "échéance",
      },
      action: {
        add: "Ajouter une tâche",
        create: "Créer une tâche",
        edit: "Modifier la tâche",
      },
      actions: {
        postpone_next_week: "Reporté à la semaine prochaine",
        postpone_tomorrow: "Reporter à demain",
        title: "Actions de tâche",
      },
      added: "Tâche ajoutée",
      deleted: "Tâche supprimée avec succès",
      dialog: {
        create: "Créer une tâche",
        create_for: "Créer une tâche pour %{name}",
      },
      sheet: {
        edit: "Modifier la tâche",
        edit_for: "Modifier la tâche pour %{name}",
      },
      empty: "Aucune tâche pour l'instant",
      empty_list_hint:
        "Les tâches ajoutées à vos juges-arbitres apparaîtront ici.",
      filters: {
        later: "Plus tard",
        overdue: "En retard",
        this_week: "Cette semaine",
        today: "Aujourd'hui",
        tomorrow: "Demain",
        with_pending: "Avec des tâches en attente",
      },
      regarding_contact: "(Concernant : %{name})",
      updated: "Tâche mise à jour",
    },
    tags: {
      name: "Étiquette |||| Étiquettes",
      action: {
        add: "Ajouter une étiquette",
        create: "Créer une nouvelle étiquette",
      },
      dialog: {
        color: "Couleur",
        create_title: "Créer une nouvelle étiquette",
        edit_title: "Modifier l'étiquette",
        name_label: "Nom de l'étiquette",
        name_placeholder: "Saisir le nom de l'étiquette",
      },
    },
  },
  crm: {
    action: {
      reset_password: "Réinitialiser le mot de passe",
    },
    auth: {
      first_name: "Prénom",
      last_name: "Nom",
      confirm_password: "Confirmer le mot de passe",
      confirmation_required:
        "Veuillez suivre le lien que nous venons de vous envoyer par email pour confirmer votre compte.",
      recovery_email_sent:
        "Si vous êtes un utilisateur enregistré, vous devriez recevoir prochainement un e-mail de récupération de mot de passe.",
      sign_in_failed: "Échec de la connexion.",
      sign_in_google_workspace: "Connectez-vous avec Google Workplace",
      signup: {
        create_account: "Créer un compte",
        create_first_user:
          "Créez le premier compte utilisateur pour terminer la configuration.",
        creating: "Création...",
        initial_user_created: "Utilisateur initial créé avec succès",
      },
      welcome_title: "Bienvenue sur Atomic CRM",
    },
    common: {
      activity: "Activité",
      added: "ajoutée",
      details: "Détails",
      last_activity_with_date: "dernière activité %{date}",
      load_more: "Charger plus",
      misc: "Divers",
      past: "Passé",
      read_more: "En savoir plus",
      retry: "Réessayer",
      show_less: "Afficher moins",
      task_count: "%{smart_count} tâche |||| %{smart_count} tâches",
      copied: "Copié !",
      copy: "Copier",
      loading: "Chargement...",
      me: "Moi",
    },
    changelog: {
      title: "Notes de version",
    },
    activity: {
      added_company: "%{name} a ajouté le club",
      you_added_company: "Vous avez ajouté le club",
      added_contact: "%{name} a ajouté le juge-arbitre",
      you_added_contact: "Vous avez ajouté le juge-arbitre",
      added_note: "%{name} a ajouté une note sur",
      you_added_note: "Vous avez ajouté une note sur",
      added_note_about_deal: "%{name} a ajouté une note sur l'affaire",
      you_added_note_about_deal: "Vous avez ajouté une note sur l'affaire",
      added_deal: "%{name} a ajouté l'affaire",
      you_added_deal: "Vous avez ajouté l'affaire",
      at_company: "chez",
      to: "à",
      load_more: "Charger plus d'activité",
    },
    dashboard: {
      amount_chart: "Montant à venir",
      deals_pipeline: "Pipeline des affaires",
      latest_activity: "Dernière activité",
      latest_activity_error:
        "Erreur lors du chargement de la dernière activité",
      latest_notes: "Mes dernières notes",
      latest_notes_added_ago: "ajouté %{timeAgo}",
      stepper: {
        install: "Installer Atomic CRM",
        progress: "%{step}/3 terminé",
        whats_next: "Et ensuite ?",
      },
      upcoming_tasks: "Tâches à venir",
    },
    header: {
      import_data: "Importer des données",
    },
    image_editor: {
      change: "Changer",
      drop_hint:
        "Déposez un fichier à télécharger ou cliquez pour le sélectionner.",
      editable_content: "Contenu modifiable",
      title: "Télécharger et redimensionner l'image",
      update_image: "Mettre à jour l'image",
    },
    import: {
      action: {
        download_error_report: "Téléchargez le rapport d'erreur",
        import: "Importer",
        import_another: "Importer un autre fichier",
      },
      error: {
        unable: "Impossible d'importer ce fichier.",
      },
      idle: {
        description_1:
          "Vous pouvez importer des ventes, des clubs, des juges-arbitres, des notes et des tâches.",
        description_2:
          "Les données doivent se trouver dans un fichier JSON correspondant à l'exemple suivant :",
      },
      status: {
        all_success: "Tous les enregistrements ont été importés avec succès.",
        complete: "Importation terminée.",
        failed: "Échoué",
        imported: "Importé",
        in_progress: "Import en cours, veuillez ne pas quitter cette page.",
        some_failed: "Certains enregistrements n'ont pas été importés.",
        table_caption: "Statut d'importation",
      },
      title: "Importer des données",
    },
    settings: {
      about: "À propos",
      companies: {
        sectors: "Secteurs",
      },
      dark_mode_logo: "Logo du mode sombre",
      deals: {
        categories: "Catégories",
        currency: "Devise",
        pipeline_help:
          "Sélectionnez les étapes d'affaire à considérer comme des affaires dans le pipeline.",
        pipeline_statuses: "Statuts des pipelines",
        stages: "Étapes",
      },
      light_mode_logo: "Logo du mode clair",
      notes: {
        statuses: "Statuts",
        visible_in_kanban: "Visible dans le Kanban des affaires",
      },
      reset_defaults: "Réinitialiser aux valeurs par défaut",
      save_error: "Échec de l'enregistrement de la configuration",
      saved: "Configuration enregistrée avec succès",
      saving: "Enregistrement...",
      tasks: {
        types: "Types",
      },
      preferences: "Préférences",
      title: "Paramètres",
      app_title: "Titre de l'application",
      sections: {
        branding: "Image de marque",
      },
      validation: {
        duplicate: "%{display_name} en double : %{items}",
        in_use:
          "Impossible de supprimer %{display_name} encore utilisés par des affaires : %{items}",
        validating: "Validation…",
        entities: {
          categories: "catégories",
          stages: "étapes",
        },
      },
    },
    theme: {
      dark: "Sombre",
      label: "Thème",
      light: "Clair",
      system: "Système",
    },
    language: "Langue",
    navigation: {
      label: "Navigation CRM",
    },
    profile: {
      inbound: {
        description:
          "Vous pouvez commencer à envoyer des e-mails vers l'adresse de réception de votre serveur, par exemple en l'ajoutant au champ %{field}. Atomic CRM traitera les e-mails et ajoutera des notes aux juges-arbitres correspondants.",
        title: "E-mail entrant",
      },
      mcp: {
        title: "Serveur MCP",
        description:
          "Utilisez cette URL pour connecter votre assistant IA aux données de votre CRM via le Model Context Protocol (MCP).",
      },
      password: {
        change: "Changer le mot de passe",
      },
      password_reset_sent:
        "Un e-mail de réinitialisation du mot de passe a été envoyé à votre adresse e-mail",
      record_not_found: "Enregistrement introuvable",
      title: "Profil",
      updated: "Votre profil a été mis à jour",
      update_error: "Une erreur s'est produite. Veuillez réessayer",
    },
    validation: {
      invalid_url: "Doit être une URL valide",
      invalid_linkedin_url: "L'URL doit provenir de linkedin.com",
    },
  },
} satisfies CrmMessages;
