export const frenchMaleDubber = (cmContinue = "") =>
    `https://fr.wikipedia.org/w/api.php?action=query&list=categorymembers&cmtitle=Category:Acteur_fran%C3%A7ais_de_doublage&cmlimit=100&format=json&cmcontinue=${cmContinue}`;
export const frenchFemaleDubber = (cmContinue = "") =>
    `https://fr.wikipedia.org/w/api.php?action=query&list=categorymembers&cmtitle=Catégorie:Actrice_française_de_doublage&cmlimit=100&format=json&cmcontinue=${cmContinue}`;

export const wikipediaPageFindSections = (pageId: number) =>
    `https://fr.wikipedia.org/w/api.php?action=parse&format=json&pageid=${pageId}&prop=sections&formatversion=2`;

export const parseDubberPageAsHTML = (pageId: number, sectionId: string) =>
    `https://fr.wikipedia.org/w/api.php?action=parse&format=json&pageid=${pageId}&prop=text&formatversion=2&section=${sectionId}`;

export const parseDubberPageAsWikitext = (pageId: number, sectionId: string) =>
    `https://fr.wikipedia.org/w/api.php?action=parse&format=json&pageid=${pageId}&prop=wikitext&formatversion=2&section=${sectionId}`;

export const searchEntities = (search: string) => {
    return `https://wikidata.org/w/api.php?action=wbsearchentities&format=json&search=${encodeURI(search)}&language=fr`
}

/** Get wikidata entity by id */
export const getEntity = (entityId: string, language = "fr") => {
    return `https://www.wikidata.org/w/api.php?action=wbgetentities&props=sitelinks&format=json&ids=${entityId}&sitefilter=${language}wiki`
}

/** Get wikiepdia page by id */
export const getWikipediaPageSectionAsWikitext = (pageId: number, sectionId: string) =>
    `https://fr.wikipedia.org/w/api.php?action=parse&format=json&pageid=${pageId}&prop=wikitext&formatversion=2&section=${sectionId}`;

export const getWikipediaPage = (title: string, language = "fr") =>
    `https://${language}.wikipedia.org/w/api.php?action=query&prop=pageprops&format=json&titles=${encodeURI(title)}`;



export const getImageFromFilename = (filename: string) => {
    return `https://fr.wikipedia.org/w/api.php?action=query&titles=File:${encodeURI(filename)}&prop=imageinfo&iiprop=url&format=json`
}

export const categories = [frenchMaleDubber, frenchFemaleDubber];
export const dubbingTerm = [/doublage|voix|voxographie/gim];
export const acceptedDubbingSubSectionMovie =
    /film|film d'animation|t[eé]l[eé]film|t[eé]l[eé]film d'animation|longs[- ]m[eé]trage|courts[- ]m[eé]trage/i;
export const acceptedDubbingSubSectionShows =
    /t[eé]l[eé]vision|s[eé]ries t[eé]l[eé]vis[eé]e|s[eé]rie/i;
export const acceptedDubbingSubSectionGames = /jeux? vid[eé]o/i;
export const acceptedDubbingSubSectionGenericDubbing =
    /doublage|cin[eé]ma|voix[ -]off|voix|clips|autres|voice[ -]over|documentaire|[eé]mission|radio|publicit[ée]|livres? audio|animation|spectacles|musique|romans/i;

export const acceptedDubbingSubSections = [
    acceptedDubbingSubSectionMovie,
    acceptedDubbingSubSectionShows,
    acceptedDubbingSubSectionGames,
    acceptedDubbingSubSectionGenericDubbing,
];