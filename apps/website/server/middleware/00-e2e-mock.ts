import { defineEventHandler, getRequestURL, send } from "h3";

export const MOCK_VOICE_ACTOR = {
  voiceActor: {
    id: 1,
    firstname: "Richard",
    lastname: "Darbois",
    voice_actor_name: "Richard Darbois",
    bio: "Richard Darbois est un acteur franco-canadien spécialisé dans le doublage. Voix française régulière de Harrison Ford, Dan Aykroyd, Jeff Goldblum et Richard Gere.",
    nationality: "Français",
    date_of_birth: "1951-12-07",
    awards: "Voix d'or 2018",
    years_active: "1970 - présent",
    profile_picture: "https://image.tmdb.org/t/p/w185/richard_darbois.jpg",
    social_media_links: {
      twitter: "https://twitter.com/richard_darbois",
      website: "https://dubbingbase.com",
    },
    user_voice_actor_links: [{ id: "link-1" }],
    work: [
      {
        id: 101,
        actor_id: 3,
        voice_actor_id: 1,
        highlight: true,
        performance: "dialogues",
        source_id: null,
        status: "validated",
        suggestions: "Indiana Jones",
        dubbing_projects: {
          content_id: 85,
          content_type: "movie",
          studios: { id: 10, name: "Dubbing Brothers", logo_url: null },
        },
      },
      {
        id: 102,
        actor_id: 3,
        voice_actor_id: 1,
        highlight: true,
        performance: "dialogues",
        source_id: null,
        status: "validated",
        suggestions: "Rick Deckard",
        dubbing_projects: {
          content_id: 78,
          content_type: "movie",
          studios: { id: 10, name: "Dubbing Brothers", logo_url: null },
        },
      },
      {
        id: 103,
        actor_id: 5,
        voice_actor_id: 1,
        highlight: false,
        performance: "dialogues",
        source_id: null,
        status: "validated",
        suggestions: "Batman",
        dubbing_projects: {
          content_id: 201,
          content_type: "tv",
          studios: { id: 10, name: "Dubbing Brothers", logo_url: null },
        },
      },
      {
        id: 104,
        actor_id: 6,
        voice_actor_id: 1,
        highlight: false,
        performance: "dialogues",
        source_id: null,
        status: "validated",
        suggestions: "Geralt de Riv",
        dubbing_projects: {
          content_id: 301,
          content_type: "video_game",
          studios: { id: 12, name: "Keywords Studios", logo_url: null },
        },
      },
      {
        id: 105,
        actor_id: 7,
        voice_actor_id: 1,
        highlight: false,
        performance: "narration",
        source_id: null,
        status: "validated",
        suggestions: "Narrateur",
        dubbing_projects: {
          content_id: 401,
          content_type: "audiobook",
          studios: { id: 14, name: "Lizzie Audiolib", logo_url: null },
        },
      },
      {
        id: 106,
        actor_id: 8,
        voice_actor_id: 1,
        highlight: false,
        performance: "dialogues",
        source_id: null,
        status: "validated",
        suggestions: "Commandant",
        dubbing_projects: {
          content_id: 501,
          content_type: "podcast",
          studios: { id: 15, name: "Binge Audio", logo_url: null },
        },
      },
      {
        id: 107,
        actor_id: 9,
        voice_actor_id: 1,
        highlight: false,
        performance: "voiceover",
        source_id: null,
        status: "validated",
        suggestions: "Voix Off",
        dubbing_projects: {
          content_id: 601,
          content_type: "advertisement",
          studios: { id: 10, name: "Dubbing Brothers", logo_url: null },
        },
      },
      {
        id: 108,
        actor_id: 10,
        voice_actor_id: 1,
        highlight: false,
        performance: "narration",
        source_id: null,
        status: "validated",
        suggestions: "Héros Mystère",
        dubbing_projects: {
          content_id: 701,
          content_type: "toy",
          studios: { id: 16, name: "Lunii Studio", logo_url: null },
        },
      },
    ],
  },
  enhancedWorks: [
    {
      media: {
        id: 85,
        title: "Raiders of the Lost Ark",
        name: "Raiders of the Lost Ark",
        poster_path: "/raiders.jpg",
        release_date: "1981-06-12",
      },
      work: {
        id: 101,
        actor_id: 3,
        performance: "dialogues",
        dubbing_projects: {
          content_id: 85,
          content_type: "movie",
          studios: { id: 10, name: "Dubbing Brothers", logo_url: null },
        },
      },
      data: {
        character: "Indiana Jones",
        characterImage: "/indy_char.jpg",
        actor: {
          id: 3,
          name: "Harrison Ford",
          character: "Indiana Jones",
          profile_picture: "/harrison_ford.jpg",
        },
      },
      sortDate: "1981-06-12",
      searchText:
        "raiders of the lost ark indiana jones harrison ford dialogues",
    },
    {
      media: {
        id: 78,
        title: "Blade Runner",
        name: "Blade Runner",
        poster_path: "/blade_runner.jpg",
        release_date: "1982-06-25",
      },
      work: {
        id: 102,
        actor_id: 3,
        performance: "dialogues",
        dubbing_projects: {
          content_id: 78,
          content_type: "movie",
          studios: { id: 10, name: "Dubbing Brothers", logo_url: null },
        },
      },
      data: {
        character: "Rick Deckard",
        characterImage: "/deckard.jpg",
        actor: {
          id: 3,
          name: "Harrison Ford",
          character: "Rick Deckard",
          profile_picture: "/harrison_ford.jpg",
        },
      },
      sortDate: "1982-06-25",
      searchText: "blade runner rick deckard harrison ford dialogues",
    },
    {
      media: {
        id: 201,
        title: "Batman: The Animated Series",
        name: "Batman: The Animated Series",
        poster_path: "/batman_tas.jpg",
        first_air_date: "1992-09-05",
      },
      work: {
        id: 103,
        actor_id: 5,
        performance: "dialogues",
        dubbing_projects: {
          content_id: 201,
          content_type: "tv",
          studios: { id: 10, name: "Dubbing Brothers", logo_url: null },
        },
      },
      data: {
        character: "Batman / Bruce Wayne",
        characterImage: "/batman_char.jpg",
        actor: {
          id: 5,
          name: "Kevin Conroy",
          character: "Batman / Bruce Wayne",
          profile_picture: "/kevin_conroy.jpg",
        },
      },
      sortDate: "1992-09-05",
      searchText:
        "batman the animated series bruce wayne kevin conroy dialogues",
    },
    {
      media: {
        id: 301,
        title: "The Witcher 3: Wild Hunt",
        name: "The Witcher 3: Wild Hunt",
        poster_path: "/witcher3.jpg",
        release_date: "2015-05-19",
      },
      work: {
        id: 104,
        actor_id: 6,
        performance: "dialogues",
        dubbing_projects: {
          content_id: 301,
          content_type: "video_game",
          studios: { id: 12, name: "Keywords Studios", logo_url: null },
        },
      },
      data: {
        character: "Geralt de Riv",
        characterImage: "/geralt.jpg",
        actor: {
          id: 6,
          name: "Doug Cockle",
          character: "Geralt of Rivia",
          profile_picture: "/doug_cockle.jpg",
        },
      },
      sortDate: "2015-05-19",
      searchText:
        "the witcher 3 wild hunt geralt of rivia doug cockle dialogues",
    },
    {
      media: {
        id: 401,
        title: "L'Île au trésor",
        name: "L'Île au trésor",
        poster_path: "/treasure_island.jpg",
        release_date: "2020-01-01",
      },
      work: {
        id: 105,
        actor_id: 7,
        performance: "narration",
        dubbing_projects: {
          content_id: 401,
          content_type: "audiobook",
          studios: { id: 14, name: "Lizzie Audiolib", logo_url: null },
        },
      },
      data: {
        character: "Narrateur & Long John Silver",
        characterImage: "/long_john.jpg",
        actor: {
          id: 7,
          name: "Robert Louis Stevenson",
          character: "Auteur",
          profile_picture: null,
        },
      },
      sortDate: "2020-01-01",
      searchText: "l'île au trésor robert louis stevenson narration",
    },
    {
      media: {
        id: 501,
        title: "Projet Fiction Audio",
        name: "Projet Fiction Audio",
        poster_path: "/podcast_poster.jpg",
        release_date: "2022-03-10",
      },
      work: {
        id: 106,
        actor_id: 8,
        performance: "dialogues",
        dubbing_projects: {
          content_id: 501,
          content_type: "podcast",
          studios: { id: 15, name: "Binge Audio", logo_url: null },
        },
      },
      data: {
        character: "Commandant Rex",
        characterImage: null,
        actor: {
          id: 8,
          name: "Acteur Podcast",
          character: "Commandant Rex",
          profile_picture: null,
        },
      },
      sortDate: "2022-03-10",
      searchText: "projet fiction audio commandant rex dialogues",
    },
    {
      media: {
        id: 601,
        title: "Campagne Publicitaire TV",
        name: "Campagne Publicitaire TV",
        poster_path: "/ad_poster.jpg",
        release_date: "2023-01-15",
      },
      work: {
        id: 107,
        actor_id: 9,
        performance: "voiceover",
        dubbing_projects: {
          content_id: 601,
          content_type: "advertisement",
          studios: { id: 10, name: "Dubbing Brothers", logo_url: null },
        },
      },
      data: {
        character: "Voix Off Pub",
        characterImage: null,
        actor: {
          id: 9,
          name: "Voix Annonceur",
          character: "Voix Off",
          profile_picture: null,
        },
      },
      sortDate: "2023-01-15",
      searchText: "campagne publicitaire tv voix off voiceover",
    },
    {
      media: {
        id: 701,
        title: "Lunii - Les Aventures Fantastiques",
        name: "Lunii - Les Aventures Fantastiques",
        poster_path: "/lunii_poster.jpg",
        release_date: "2024-05-01",
      },
      work: {
        id: 108,
        actor_id: 10,
        performance: "narration",
        dubbing_projects: {
          content_id: 701,
          content_type: "toy",
          studios: { id: 16, name: "Lunii Studio", logo_url: null },
        },
      },
      data: {
        character: "Conteur Magique",
        characterImage: null,
        actor: {
          id: 10,
          name: "Auteur Lunii",
          character: "Conteur",
          profile_picture: null,
        },
      },
      sortDate: "2024-05-01",
      searchText: "lunii les aventures fantastiques conteur magique narration",
    },
  ],
  medias: [],
  characterProfilePictures: [],
  potentialWikipediaUrl: "https://fr.wikipedia.org/wiki/Richard_Darbois",
  profilePicture: "https://image.tmdb.org/t/p/w185/richard_darbois.jpg",
};

export const MOCK_MOVIE = {
  movie: {
    id: 85,
    title: "Raiders of the Lost Ark",
    name: "Raiders of the Lost Ark",
    poster_path: "/raiders.jpg",
    backdrop_path: "/raiders_bg.jpg",
    overview:
      "When Dr. Indiana Jones is hired by the government to locate the legendary Ark of the Covenant, he finds himself up against the entire Nazi machine.",
    release_date: "1981-06-12",
    vote_average: 8.4,
    vote_count: 12000,
    runtime: 115,
    credits: {
      cast: [
        {
          id: 3,
          name: "Harrison Ford",
          character: "Indiana Jones",
          profile_path: "/harrison_ford.jpg",
        },
        {
          id: 102,
          name: "Karen Allen",
          character: "Marion Ravenwood",
          profile_path: "/karen_allen.jpg",
        },
        {
          id: 103,
          name: "John Rhys-Davies",
          character: "Sallah",
          profile_path: "/rhys_davies.jpg",
        },
      ],
      crew: [
        {
          id: 488,
          name: "Steven Spielberg",
          job: "Director",
        },
      ],
    },
  },
  characterProfilePictures: [
    {
      movieId: 85,
      name: "Indiana Jones",
      image: "/indy_char.jpg",
    },
  ],
  dubbingProjects: [
    {
      id: 8501,
      content_id: 85,
      content_type: "movie",
      language: "fr-FR",
      studios: {
        id: 10,
        name: "Dubbing Brothers",
        logo_url: null,
      },
      studio_data: {
        id: 10,
        name: "Dubbing Brothers",
        logo_url: null,
      },
      work: [
        {
          id: 101,
          actor_id: 3,
          voice_actor_id: 1,
          character_name: "Indiana Jones",
          performance: "dialogues",
          voice_actor: {
            id: 1,
            firstname: "Richard",
            lastname: "Darbois",
            profile_picture:
              "https://image.tmdb.org/t/p/w185/richard_darbois.jpg",
          },
          voice_actors: {
            id: 1,
            firstname: "Richard",
            lastname: "Darbois",
            profile_picture:
              "https://image.tmdb.org/t/p/w185/richard_darbois.jpg",
          },
        },
      ],
      works: [
        {
          id: 101,
          actor_id: 3,
          voice_actor_id: 1,
          character_name: "Indiana Jones",
          performance: "dialogues",
          voice_actor: {
            id: 1,
            firstname: "Richard",
            lastname: "Darbois",
            profile_picture:
              "https://image.tmdb.org/t/p/w185/richard_darbois.jpg",
          },
          voice_actors: {
            id: 1,
            firstname: "Richard",
            lastname: "Darbois",
            profile_picture:
              "https://image.tmdb.org/t/p/w185/richard_darbois.jpg",
          },
        },
      ],
      crew: [],
    },
  ],
  collection: null,
  tvdbId: null,
};

export const MOCK_SHOW = {
  serie: {
    id: 1396,
    title: "Breaking Bad",
    name: "Breaking Bad",
    poster_path: "/breaking_bad.jpg",
    backdrop_path: "/bb_backdrop.jpg",
    overview:
      "A chemistry teacher diagnosed with inoperable lung cancer turns to manufacturing and selling methamphetamine with a former student in order to secure his family's future.",
    first_air_date: "2008-01-20",
    vote_average: 9.5,
    vote_count: 14000,
    number_of_seasons: 5,
    number_of_episodes: 62,
    credits: {
      cast: [
        {
          id: 17419,
          name: "Bryan Cranston",
          character: "Walter White",
          profile_path: "/bryan_cranston.jpg",
        },
        {
          id: 84497,
          name: "Aaron Paul",
          character: "Jesse Pinkman",
          profile_path: "/aaron_paul.jpg",
        },
      ],
    },
  },
  show: {
    id: 1396,
    title: "Breaking Bad",
    name: "Breaking Bad",
    poster_path: "/breaking_bad.jpg",
    backdrop_path: "/bb_backdrop.jpg",
    overview:
      "A chemistry teacher diagnosed with inoperable lung cancer turns to manufacturing and selling methamphetamine with a former student in order to secure his family's future.",
    first_air_date: "2008-01-20",
    vote_average: 9.5,
    vote_count: 14000,
    number_of_seasons: 5,
    number_of_episodes: 62,
    credits: {
      cast: [
        {
          id: 17419,
          name: "Bryan Cranston",
          character: "Walter White",
          profile_path: "/bryan_cranston.jpg",
        },
        {
          id: 84497,
          name: "Aaron Paul",
          character: "Jesse Pinkman",
          profile_path: "/aaron_paul.jpg",
        },
      ],
    },
  },
  characterProfilePictures: [],
  aggregateCredits: {
    cast: [
      {
        id: 17419,
        name: "Bryan Cranston",
        character: "Walter White",
        roles: [{ character: "Walter White" }],
        profile_path: "/bryan_cranston.jpg",
      },
      {
        id: 84497,
        name: "Aaron Paul",
        character: "Jesse Pinkman",
        roles: [{ character: "Jesse Pinkman" }],
        profile_path: "/aaron_paul.jpg",
      },
    ],
  },
  dubbingProjects: [
    {
      id: 139601,
      content_id: 1396,
      content_type: "tv",
      language: "fr-FR",
      studios: {
        id: 10,
        name: "Dubbing Brothers",
        logo_url: null,
      },
      studio_data: {
        id: 10,
        name: "Dubbing Brothers",
        logo_url: null,
      },
      work: [
        {
          id: 1396001,
          actor_id: 17419,
          voice_actor_id: 25,
          character_name: "Walter White",
          performance: "dialogues",
          voice_actor: {
            id: 25,
            firstname: "Jean-Louis",
            lastname: "Faure",
            profile_picture: "/jean_louis_faure.jpg",
          },
          voice_actors: {
            id: 25,
            firstname: "Jean-Louis",
            lastname: "Faure",
            profile_picture: "/jean_louis_faure.jpg",
          },
        },
      ],
      works: [
        {
          id: 1396001,
          actor_id: 17419,
          voice_actor_id: 25,
          character_name: "Walter White",
          performance: "dialogues",
          voice_actor: {
            id: 25,
            firstname: "Jean-Louis",
            lastname: "Faure",
            profile_picture: "/jean_louis_faure.jpg",
          },
          voice_actors: {
            id: 25,
            firstname: "Jean-Louis",
            lastname: "Faure",
            profile_picture: "/jean_louis_faure.jpg",
          },
        },
      ],
      crew: [],
    },
  ],
};

export const MOCK_GAME = {
  game: {
    id: 1942,
    title: "The Witcher 3: Wild Hunt",
    name: "The Witcher 3: Wild Hunt",
    slug: "the-witcher-3-wild-hunt",
    summary:
      "As war rages on throughout the Northern Realms, you take on the greatest conflict of your life: tracking down the Child of Prophecy.",
    cover: {
      url: "https://images.igdb.com/igdb/image/upload/t_cover_big/witcher3.jpg",
    },
    cover_url:
      "https://images.igdb.com/igdb/image/upload/t_cover_big/witcher3.jpg",
    first_release_date: 1431993600,
    rating: 94.5,
  },
  characters: [
    {
      id: 1001,
      name: "Geralt de Riv",
      mug_shot: {
        url: "/geralt.jpg",
      },
    },
  ],
  dubbingProjects: [
    {
      id: 194201,
      content_id: 1942,
      content_type: "video_game",
      language: "fr-FR",
      studios: {
        id: 12,
        name: "Keywords Studios",
        logo_url: null,
      },
      studio_data: {
        id: 12,
        name: "Keywords Studios",
        logo_url: null,
      },
      work: [
        {
          id: 1942001,
          actor_id: 1001,
          character_id: 1001,
          voice_actor_id: 30,
          character_name: "Geralt de Riv",
          performance: "dialogues",
          voice_actor: {
            id: 30,
            firstname: "Daniel",
            lastname: "Lobé",
            profile_picture: "/daniel_lobe.jpg",
          },
          voice_actors: {
            id: 30,
            firstname: "Daniel",
            lastname: "Lobé",
            profile_picture: "/daniel_lobe.jpg",
          },
        },
      ],
      works: [
        {
          id: 1942001,
          actor_id: 1001,
          character_id: 1001,
          voice_actor_id: 30,
          character_name: "Geralt de Riv",
          performance: "dialogues",
          voice_actor: {
            id: 30,
            firstname: "Daniel",
            lastname: "Lobé",
            profile_picture: "/daniel_lobe.jpg",
          },
          voice_actors: {
            id: 30,
            firstname: "Daniel",
            lastname: "Lobé",
            profile_picture: "/daniel_lobe.jpg",
          },
        },
      ],
      crew: [],
    },
  ],
};

export const MOCK_AUDIOBOOK = {
  audiobook: {
    id: 401,
    title: "Dune",
    name: "Dune",
    description:
      "Set on the desert planet Arrakis, Dune is the story of the boy Paul Atreides.",
    cover_url: "https://covers.openlibrary.org/b/id/8225266-L.jpg",
    first_publish_year: 1965,
    release_date: "1965-08-01",
    author: "Frank Herbert",
    author_name: "Frank Herbert",
    authors: [{ name: "Frank Herbert" }],
  },
  book: {
    id: 401,
    title: "Dune",
    name: "Dune",
    description:
      "Set on the desert planet Arrakis, Dune is the story of the boy Paul Atreides.",
    cover_url: "https://covers.openlibrary.org/b/id/8225266-L.jpg",
    first_publish_year: 1965,
    release_date: "1965-08-01",
    author_name: "Frank Herbert",
  },
  dubbingProjects: [
    {
      id: 40101,
      content_id: 401,
      content_type: "audiobook",
      language: "fr-FR",
      studios: {
        id: 14,
        name: "Lizzie Audiolib",
        logo_url: null,
      },
      studio_data: {
        id: 14,
        name: "Lizzie Audiolib",
        logo_url: null,
      },
      work: [
        {
          id: 40101,
          voice_actor_id: 1,
          character_name: "Narrateur",
          performance: "narration",
          voice_actor: {
            id: 1,
            firstname: "Richard",
            lastname: "Darbois",
            profile_picture:
              "https://image.tmdb.org/t/p/w185/richard_darbois.jpg",
          },
          voice_actors: {
            id: 1,
            firstname: "Richard",
            lastname: "Darbois",
            profile_picture:
              "https://image.tmdb.org/t/p/w185/richard_darbois.jpg",
          },
        },
      ],
      works: [
        {
          id: 40101,
          voice_actor_id: 1,
          character_name: "Narrateur",
          performance: "narration",
          voice_actor: {
            id: 1,
            firstname: "Richard",
            lastname: "Darbois",
            profile_picture:
              "https://image.tmdb.org/t/p/w185/richard_darbois.jpg",
          },
          voice_actors: {
            id: 1,
            firstname: "Richard",
            lastname: "Darbois",
            profile_picture:
              "https://image.tmdb.org/t/p/w185/richard_darbois.jpg",
          },
        },
      ],
      crew: [],
    },
  ],
};

export const MOCK_PODCAST = {
  podcast: {
    id: 101,
    title: "L'Ombre du Doute",
    name: "L'Ombre du Doute",
    description: "Une saga audio policière captivante.",
    cover_url:
      "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=500",
    poster_path:
      "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=500",
    release_date: "2023-09-01",
    author: "Studio Sonore",
    author_name: "Studio Sonore",
    episodes_count: 10,
  },
  dubbingProjects: [
    {
      id: 501,
      content_id: 101,
      content_type: "podcast",
      language: "fr-FR",
      studios: {
        id: 15,
        name: "Binge Audio",
        logo_url: null,
      },
      studio_data: {
        id: 15,
        name: "Binge Audio",
        logo_url: null,
      },
      work: [
        {
          id: 50101,
          voice_actor_id: 1,
          character_name: "Commandant Rex",
          performance: "dialogues",
          voice_actor: {
            id: 1,
            firstname: "Richard",
            lastname: "Darbois",
            profile_picture:
              "https://image.tmdb.org/t/p/w185/richard_darbois.jpg",
          },
          voice_actors: {
            id: 1,
            firstname: "Richard",
            lastname: "Darbois",
            profile_picture:
              "https://image.tmdb.org/t/p/w185/richard_darbois.jpg",
          },
        },
      ],
      works: [
        {
          id: 50101,
          voice_actor_id: 1,
          character_name: "Commandant Rex",
          performance: "dialogues",
          voice_actor: {
            id: 1,
            firstname: "Richard",
            lastname: "Darbois",
            profile_picture:
              "https://image.tmdb.org/t/p/w185/richard_darbois.jpg",
          },
          voice_actors: {
            id: 1,
            firstname: "Richard",
            lastname: "Darbois",
            profile_picture:
              "https://image.tmdb.org/t/p/w185/richard_darbois.jpg",
          },
        },
      ],
      crew: [],
    },
  ],
};

export const MOCK_ACTOR = {
  actor: {
    id: 3,
    name: "Harrison Ford",
    biography:
      "Harrison Ford est un acteur américain né le 13 juillet 1942 à Chicago. Mondialement célèbre pour les rôles de Han Solo et d'Indiana Jones.",
    profile_path: "/harrison_ford.jpg",
    birthday: "1942-07-13",
    deathday: null,
    place_of_birth: "Chicago, Illinois, USA",
    known_for_department: "Acting",
    credits: {
      cast: [
        {
          id: 85,
          title: "Raiders of the Lost Ark",
          name: "Raiders of the Lost Ark",
          character: "Indiana Jones",
          poster_path: "/raiders.jpg",
          release_date: "1981-06-12",
          media_type: "movie",
        },
      ],
    },
    voice_roles: [
      {
        id: 101,
        performance: "dialogues",
        highlight: true,
        voice_actors: [
          {
            id: 1,
            firstname: "Richard",
            lastname: "Darbois",
            profile_picture:
              "https://image.tmdb.org/t/p/w185/richard_darbois.jpg",
          },
        ],
        mediaDetails: {
          id: 85,
          title: "Raiders of the Lost Ark",
          original_title: "Raiders of the Lost Ark",
          poster_path: "/raiders.jpg",
          release_date: "1981-06-12",
          media_type: "movie",
          overview:
            "When Dr. Indiana Jones is hired by the government to locate the legendary Ark of the Covenant.",
        },
        dubbing_projects: {
          language: "fr-FR",
        },
      },
    ],
  },
  voiceActors: [
    {
      id: 1,
      firstname: "Richard",
      lastname: "Darbois",
      profile_picture: "https://image.tmdb.org/t/p/w185/richard_darbois.jpg",
    },
  ],
};

export const MOCK_STUDIO = {
  studio: {
    id: 10,
    name: "Dubbing Brothers",
    country: "France",
    city: "La Plaine Saint-Denis",
    logo_url: "https://dubbingbase.com/studios/dubbing_brothers.png",
    description:
      "L'un des plus grands studios de doublage en France et en Europe.",
  },
  dubbedProjects: [
    {
      id: 8501,
      content_id: 85,
      content_type: "movie",
      language: "fr-FR",
      media: {
        id: 85,
        title: "Raiders of the Lost Ark",
        poster_path: "/raiders.jpg",
      },
    },
    {
      id: 20101,
      content_id: 201,
      content_type: "tv",
      language: "fr-FR",
      media: {
        id: 201,
        title: "Batman: The Animated Series",
        poster_path: "/batman_tas.jpg",
      },
    },
  ],
  voiceActorsRoster: [
    {
      id: 1,
      firstname: "Richard",
      lastname: "Darbois",
      profile_picture: "https://image.tmdb.org/t/p/w185/richard_darbois.jpg",
      project_count: 24,
    },
  ],
};

export const MOCK_SEARCH_RESULTS = [
  {
    id: 1,
    firstname: "Richard",
    lastname: "Darbois",
    voice_actor_name: "Richard Darbois",
    profile_path: "https://image.tmdb.org/t/p/w185/richard_darbois.jpg",
    media_type: "voice_actor",
    popularity: 95,
  },
  {
    id: 85,
    title: "Raiders of the Lost Ark",
    poster_path: "/raiders.jpg",
    release_date: "1981-06-12",
    media_type: "movie",
    popularity: 90,
  },
  {
    id: 1396,
    name: "Breaking Bad",
    poster_path: "/breaking_bad.jpg",
    first_air_date: "2008-01-20",
    media_type: "tv",
    popularity: 88,
  },
  {
    id: 1942,
    name: "The Witcher 3: Wild Hunt",
    poster_path:
      "https://images.igdb.com/igdb/image/upload/t_cover_big/witcher3.jpg",
    media_type: "video_game",
    popularity: 85,
  },
  {
    id: "OL12345M",
    title: "Dune",
    author_name: "Frank Herbert",
    poster_path: "https://covers.openlibrary.org/b/id/8225266-L.jpg",
    media_type: "audiobook",
    popularity: 80,
  },
];

export const MOCK_HOME_DATA = {
  trendingMovies: [
    {
      id: 85,
      title: "Raiders of the Lost Ark",
      poster_path: "/raiders.jpg",
      release_date: "1981-06-12",
      vote_average: 8.4,
    },
  ],
  trendingShows: [
    {
      id: 1396,
      name: "Breaking Bad",
      poster_path: "/breaking_bad.jpg",
      first_air_date: "2008-01-20",
      vote_average: 9.5,
    },
  ],
  trendingGames: [
    {
      id: 1942,
      name: "The Witcher 3: Wild Hunt",
      cover_url:
        "https://images.igdb.com/igdb/image/upload/t_cover_big/witcher3.jpg",
      first_release_date: 1431993600,
    },
  ],
  topVoiceActors: [
    {
      id: 1,
      firstname: "Richard",
      lastname: "Darbois",
      profile_picture: "https://image.tmdb.org/t/p/w185/richard_darbois.jpg",
      work_count: 142,
    },
  ],
};

export default defineEventHandler((event) => {
  // Only activate mock interceptor when E2E_TEST is true
  if (process.env.E2E_TEST !== "true") {
    return;
  }

  const url = getRequestURL(event);
  const path = url.pathname;

  // 1. Voice Actor Detail
  if (path.startsWith("/api/voice-actor/")) {
    return send(event, JSON.stringify(MOCK_VOICE_ACTOR), "application/json");
  }

  // 2. Movie Detail
  if (path.startsWith("/api/movie/")) {
    return send(event, JSON.stringify(MOCK_MOVIE), "application/json");
  }

  // 3. TV Show Detail
  if (path.startsWith("/api/show/")) {
    return send(event, JSON.stringify(MOCK_SHOW), "application/json");
  }

  // 4. Video Game Detail
  if (path.startsWith("/api/game/")) {
    return send(event, JSON.stringify(MOCK_GAME), "application/json");
  }

  // 5. Audiobook Detail
  if (path.startsWith("/api/audiobook/")) {
    return send(event, JSON.stringify(MOCK_AUDIOBOOK), "application/json");
  }

  // 6. Podcast Detail
  if (path.startsWith("/api/podcast/")) {
    return send(event, JSON.stringify(MOCK_PODCAST), "application/json");
  }

  // 7. Original Actor Detail
  if (path.startsWith("/api/actor/")) {
    return send(event, JSON.stringify(MOCK_ACTOR), "application/json");
  }

  // 8. Studio Details
  if (path.includes("/api/get-studio-details")) {
    return send(event, JSON.stringify(MOCK_STUDIO), "application/json");
  }

  // 9. Search API
  if (path.startsWith("/api/search")) {
    return send(event, JSON.stringify(MOCK_SEARCH_RESULTS), "application/json");
  }

  // 10. Trending & Home APIs
  if (path.includes("/api/trending/movies")) {
    return send(
      event,
      JSON.stringify(MOCK_HOME_DATA.trendingMovies),
      "application/json",
    );
  }
  if (path.includes("/api/trending/shows")) {
    return send(
      event,
      JSON.stringify(MOCK_HOME_DATA.trendingShows),
      "application/json",
    );
  }
  if (path.includes("/api/trending/games")) {
    return send(
      event,
      JSON.stringify(MOCK_HOME_DATA.trendingGames),
      "application/json",
    );
  }
  if (
    path.includes("/api/trending/voice-actors") ||
    path.includes("/api/top-voice-actors") ||
    path.includes("/api/recent-voice-actors")
  ) {
    return send(
      event,
      JSON.stringify(MOCK_HOME_DATA.topVoiceActors),
      "application/json",
    );
  }

  // 11. Home stats
  if (path.includes("/api/home-stats")) {
    return send(
      event,
      JSON.stringify({
        voice_actors: 2500,
        dubbing_projects: 8500,
        contributions: 12000,
      }),
      "application/json",
    );
  }
});
