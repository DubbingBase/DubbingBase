// Movie-related types
export interface Movie {
    adult: boolean
    backdrop_path: string
    id: number
    title: string
    original_language: string
    original_title:string
    overview: string
    poster_path: string
    media_type: "movie"
    genre_ids: Array<number>
    popularity: number
    release_date: string
    video: boolean
    vote_average: number
    vote_count: number
}

export interface TrendingResponse {
    page: number
    results: Array<Movie>
    total_pages : number
    total_results : number
}

export interface VoiceActorDetails {
    id: number
    bio: any
    awards: any
    lastname: string
    firstname: string
    nationality: any
    years_active: any
    date_of_birth: any
    social_media_links: any
    profile_picture?: string
}

export interface WorkAndVoiceActor {
    id: number
    content_id: number
    actor_id: number
    voice_actor_id: number
    highlight: boolean
    suggestions: any
    status: string
    source_id: any
    voiceActorDetails: VoiceActorDetails
    performance?: string
}

export interface MovieResponse {
    movie: Movie & WithCast & WithExtrernalIds
    voiceActors: Array<WorkAndVoiceActor>
}

// Series-related types
export interface Season {
    air_date: string
    episode_count: number
    id: number
    name: string
    overview: string
    poster_path: string
    season_number: number
    vote_average: number
}

export interface Serie {
    adult: boolean
    backdrop_path: string
    id: number
    name: string
    original_language: string
    original_title:string
    overview: string
    poster_path: string
    media_type: "tv"
    genre_ids: Array<number>
    popularity: number
    release_date: string
    video: boolean
    vote_average: number
    vote_count: number
    seasons: Season[]
}

export interface SerieTrendingResponse {
    page: number
    results: Array<Serie>
    total_pages : number
    total_results : number
}

export interface SerieResponse {
    serie: Serie & WithCast & WithExtrernalIds
    voiceActors: Array<WorkAndVoiceActor>
}

// Actor-related types
export interface ActorCredits {
    cast: Array<Movie|Serie>
}

export interface Actor {
    biography: string
    birthday: string
    deathday: string
    gender: 1 | 2
    id: number
    name: string
    place_of_birth: string
    profile_path: string
    credits: ActorCredits
    roles?: {
        credit_id: string
        character: string
        episode_count: number
    }[]
    character?: string
}

// Common types
export interface Cast {
    gender: number
    id: number
    name: string
    profile_path: string
    cast_id: number
    character: string
}

export interface Genre {
    id: number
    name: string
}

export interface WithCast {
    genres: Array<Genre>
    credits: {
        cast: Array<Cast>
    }
}

export interface WithExtrernalIds {
    external_ids: {
        imdb_id?: string
        wikidata_id?: string
        facebook_id?: string
        instagram_id?: string
        twitter_id?: string
    }
}

// Mistral AI types
export interface MistralMovieExtractOutput {
    items?: MistralMovieExtractItemOutput[]
}

export interface MistralMovieExtractItemOutput {
    actor: string
    voiceActorName: string
    voiceActorFirstname: string
    performance?: string
}

export interface MistralVoiceActorExtractOutput {
    items?: MistralVoiceActorExtractItemOutput[]
}

export interface MistralVoiceActorExtractItemOutput {
    actor: string
    performance?: string
    production?: string
    year?: number
}
